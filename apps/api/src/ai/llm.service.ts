// The language model behind "explain a sentence" and conversation practice: OpenAI's Responses
// API with structured outputs, so every answer is validated against a zod schema. One key
// (OPENAI_API_KEY) serves this and Whisper; the model is OPENAI_MODEL.

import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { ENV, type Env } from '../config/env.js';

export type Effort = 'low' | 'medium' | 'high';

export type LlmContent =
  { type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string };

export interface LlmMessage {
  /** "developer" carries instructions mid-conversation (e.g. a rewrite request). */
  role: 'user' | 'assistant' | 'developer';
  content: string | LlmContent[];
}

export interface StructuredRequest<T extends z.ZodType> {
  schema: T;
  /** Schema name for the response format, e.g. "explanation". */
  name: string;
  /** Stable instructions; kept identical across requests so the provider can cache them. */
  system: string;
  messages: LlmMessage[];
  effort: Effort;
  maxTokens?: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI | null;
  readonly model: string;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
    this.model = env.OPENAI_MODEL;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async structured<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features are not set up on this server (OPENAI_API_KEY).',
      );
    }
    try {
      const response = await this.client.responses.parse({
        model: this.model,
        instructions: request.system,
        input: request.messages.map((m) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content
              : m.content.map((part) =>
                  part.type === 'text'
                    ? { type: 'input_text' as const, text: part.text }
                    : {
                        type: 'input_image' as const,
                        image_url: `data:${part.mediaType};base64,${part.data}`,
                        detail: 'high' as const,
                      },
                ),
        })),
        reasoning: { effort: request.effort },
        max_output_tokens: request.maxTokens ?? 16_000,
        text: { format: zodTextFormat(request.schema, request.name) },
      });
      if (response.status === 'incomplete') {
        throw new BadGatewayException('The AI answer was cut off. Try again.');
      }
      if (response.output_parsed == null) {
        throw new UnprocessableEntityException(
          'The AI declined to answer this one. Try different text.',
        );
      }
      return response.output_parsed as z.infer<T>;
    } catch (error) {
      if (error instanceof OpenAI.RateLimitError) {
        throw new ServiceUnavailableException('The AI is busy right now. Try again in a minute.');
      }
      if (error instanceof OpenAI.APIError) {
        this.logger.warn(`OpenAI API error ${error.status}: ${error.message}`);
        throw new BadGatewayException('The AI service failed. Try again.');
      }
      throw error;
    }
  }
}
