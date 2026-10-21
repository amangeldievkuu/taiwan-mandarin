// Claude, for structured answers. Every call:
//   - validates the answer against a zod schema (structured outputs);
//   - caches the stable system prompt;
//   - opts into server-side fallback ("default"): if the model declines for policy reasons, the
//     API retries on Anthropic's recommended substitute instead of returning a refusal.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { z } from 'zod';
import { ENV, type Env } from '../config/env.js';

export type Effort = 'low' | 'medium' | 'high';

export interface StructuredRequest<T extends z.ZodType> {
  schema: T;
  /** Stable instructions; cached across requests. */
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort: Effort;
  maxTokens?: number;
}

@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic | null;
  readonly model: string;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;
    this.model = env.ANTHROPIC_MODEL;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async structured<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features are not set up on this server (ANTHROPIC_API_KEY).',
      );
    }
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: request.maxTokens ?? 16_000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: request.messages,
        output_config: { effort: request.effort, format: betaZodOutputFormat(request.schema) },
      });
      if (response.stop_reason === 'refusal') {
        throw new UnprocessableEntityException(
          'The AI declined to answer this one. Try different text.',
        );
      }
      if (response.stop_reason === 'max_tokens' || response.parsed_output == null) {
        throw new BadGatewayException('The AI answer was cut off or malformed. Try again.');
      }
      return response.parsed_output as z.infer<T>;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException('The AI is busy right now. Try again in a minute.');
      }
      if (error instanceof Anthropic.APIError) {
        this.logger.warn(`Claude API error ${error.status}: ${error.message}`);
        throw new BadGatewayException('The AI service failed. Try again.');
      }
      throw error;
    }
  }
}
