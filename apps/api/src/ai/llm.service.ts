// The language model behind "explain a sentence" and conversation practice: OpenAI's Responses
// API with structured outputs, so every answer is validated against a zod schema. One key
// (OPENAI_API_KEY) serves this and speech-to-text. Each feature has its own model and reasoning
// effort (config/env.ts), and every call logs how long it took and the tokens it used.

import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { parsePartialJson } from '@taiwan-mandarin/shared';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import {
  aiSettings,
  ENV,
  type AiFeature,
  type AiSettings,
  type Effort,
  type Env,
} from '../config/env.js';
import { apiError, type ApiErrorCode } from '@taiwan-mandarin/shared/api';

export type { AiFeature, Effort };

export type LlmContent =
  { type: 'text'; text: string } | { type: 'image'; mediaType: string; data: string };

export interface LlmMessage {
  /** "developer" carries instructions mid-conversation (e.g. a rewrite request). */
  role: 'user' | 'assistant' | 'developer';
  content: string | LlmContent[];
}

export interface StructuredRequest<T extends z.ZodType> {
  /** Picks the model and reasoning effort. */
  feature: AiFeature;
  schema: T;
  /** Schema name for the response format, e.g. "explanation". */
  name: string;
  /** Stable instructions; kept identical across requests so the provider can cache them. */
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  /** Requests sharing a prompt prefix (e.g. one learner's conversations); defaults to the feature. */
  cacheKey?: string;
}

/** What a streamed answer yields: the JSON so far, then the whole validated answer. */
export type LlmStreamEvent<T> =
  | { type: 'partial'; value: unknown }
  /** Cut off (e.g. at the output limit): whatever arrived, parsed as far as possible. */
  | { type: 'incomplete'; value: unknown; reason: string }
  | { type: 'done'; value: T };

/** Efforts some models reject, and the nearest one to try instead. */
const EFFORT_FALLBACK: Partial<Record<Effort, Effort>> = {
  none: 'low',
  minimal: 'low',
  xhigh: 'high',
  max: 'high',
};

/** The model wanted `effort` changed: the effort to use instead, or undefined. */
export function effortFallback(error: unknown, effort: Effort): Effort | undefined {
  if (!(error instanceof OpenAI.BadRequestError)) return undefined;
  const aboutEffort =
    error.param === 'reasoning.effort' || /reasoning[._ ]effort/i.test(error.message);
  return aboutEffort ? EFFORT_FALLBACK[effort] : undefined;
}

interface Usage {
  input_tokens: number;
  input_tokens_details?: { cached_tokens?: number } | null;
  output_tokens: number;
  output_tokens_details?: { reasoning_tokens?: number } | null;
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const count = (n: number) => n.toLocaleString('en-US');

/**
 * One log line per call:
 * "explain gpt-6-luna effort=low · 3.42 s (first output 0.91 s) · in 1,104 (cached 1,024) ·
 * out 1,380 (reasoning 210)". First output is the wait a learner notices; reasoning tokens are
 * the part a lower effort saves.
 */
export function formatUsage(call: {
  feature: string;
  model: string;
  effort: string;
  ms: number;
  firstOutputMs?: number;
  usage?: Usage | null;
  serviceTier?: string | null;
  status?: string | null;
}): string {
  const { usage } = call;
  return [
    `${call.feature} ${call.model} effort=${call.effort}`,
    seconds(call.ms) + (call.firstOutputMs ? ` (first output ${seconds(call.firstOutputMs)})` : ''),
    usage &&
      `in ${count(usage.input_tokens)} (cached ${count(usage.input_tokens_details?.cached_tokens ?? 0)})`,
    usage &&
      `out ${count(usage.output_tokens)} (reasoning ${count(usage.output_tokens_details?.reasoning_tokens ?? 0)})`,
    call.serviceTier && call.serviceTier !== 'default' ? call.serviceTier : undefined,
    call.status && call.status !== 'completed' ? call.status : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** No event from a streamed answer for longer than the request timeout. */
class StreamStalled extends Error {}

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: OpenAI | null;
  /** Efforts a model turned down, and what it took instead: "gpt-6-astra|none" → "low". */
  private readonly fallbacks = new Map<string, Effort>();

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = env.OPENAI_API_KEY
      ? new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          timeout: env.OPENAI_TIMEOUT_MS,
          maxRetries: env.OPENAI_MAX_RETRIES,
        })
      : null;
  }

  get available(): boolean {
    return this.client !== null;
  }

  onModuleInit(): void {
    if (!this.client) return;
    const feature = (f: AiFeature) => {
      const s = this.settings(f);
      return `${f} ${s.model}/${s.effort}`;
    };
    const retries = this.env.OPENAI_MAX_RETRIES;
    this.logger.log(
      `AI: ${feature('explain')}, ${feature('talk')} · service tier ${this.env.OPENAI_SERVICE_TIER} · ` +
        `timeout ${this.env.OPENAI_TIMEOUT_MS / 1000} s, ${retries} ${retries === 1 ? 'retry' : 'retries'}`,
    );
  }

  /** The configured model and effort, unless the model already turned that effort down. */
  private settings(feature: AiFeature): AiSettings {
    const base = aiSettings(this.env, feature);
    const effort = this.fallbacks.get(`${base.model}|${base.effort}`);
    return effort ? { ...base, effort } : base;
  }

  private params<T extends z.ZodType>(request: StructuredRequest<T>, s: AiSettings) {
    const { OPENAI_SERVICE_TIER: tier, OPENAI_VERBOSITY: verbosity } = this.env;
    return {
      model: s.model,
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
                      // Signs and menus have small print.
                      detail: 'high' as const,
                    },
              ),
      })),
      reasoning: { effort: s.effort },
      max_output_tokens: request.maxTokens ?? 16_000,
      text: {
        format: zodTextFormat(request.schema, request.name),
        ...(verbosity ? { verbosity } : {}),
      },
      prompt_cache_key: request.cacheKey ?? request.feature,
      // Learners' photos and messages aren't kept on OpenAI's side.
      store: false,
      ...(tier !== 'auto' ? { service_tier: tier } : {}),
    };
  }

  async structured<T extends z.ZodType>(request: StructuredRequest<T>): Promise<z.infer<T>> {
    const client = this.require();
    for (let attempt = 0; ; attempt++) {
      const s = this.settings(request.feature);
      const started = performance.now();
      try {
        const response = await client.responses.parse(this.params(request, s));
        this.logUsage(request.feature, s, started, response);
        if (response.status === 'incomplete') {
          throw new BadGatewayException(apiError('aiCutOff'));
        }
        if (response.output_parsed == null) {
          throw new UnprocessableEntityException(
            'The AI declined to answer this one. Try different text.',
          );
        }
        return response.output_parsed as z.infer<T>;
      } catch (error) {
        if (attempt === 0 && this.useFallback(error, s)) continue;
        throw this.toHttpError(error, request.feature, s, started);
      }
    }
  }

  /**
   * The same request, streamed: the JSON parsed so far (at most every 40 ms), then the validated
   * answer. Stops when `signal` aborts (the learner left) or the stream stalls.
   */
  async *stream<T extends z.ZodType>(
    request: StructuredRequest<T>,
    signal?: AbortSignal,
  ): AsyncGenerator<LlmStreamEvent<z.infer<T>>> {
    const client = this.require();
    for (let attempt = 0; ; attempt++) {
      const s = this.settings(request.feature);
      const started = performance.now();
      const stalled = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const alive = () => {
        clearTimeout(timer);
        timer = setTimeout(() => stalled.abort(), this.env.OPENAI_TIMEOUT_MS);
      };
      let yielded = false;
      try {
        alive();
        const stream = client.responses.stream(this.params(request, s), {
          signal: signal ? AbortSignal.any([signal, stalled.signal]) : stalled.signal,
        });
        let text = '';
        let firstOutput = 0;
        let parsedAt = 0;
        for await (const event of stream) {
          alive();
          if (event.type !== 'response.output_text.delta') continue;
          text += event.delta;
          const now = performance.now();
          firstOutput ||= now;
          if (now - parsedAt < 40) continue;
          parsedAt = now;
          const value = parsePartialJson(text);
          if (value === undefined) continue;
          yielded = true;
          yield { type: 'partial', value };
        }
        const response = await stream.finalResponse();
        this.logUsage(request.feature, s, started, response, firstOutput);
        if (response.status === 'incomplete') {
          const reason = response.incomplete_details?.reason ?? 'unknown';
          if (reason === 'content_filter') {
            throw new UnprocessableEntityException(
              'The AI declined to answer this one. Try different text.',
            );
          }
          yield { type: 'incomplete', value: parsePartialJson(text), reason };
          return;
        }
        if (response.output_parsed == null) {
          throw new UnprocessableEntityException(
            'The AI declined to answer this one. Try different text.',
          );
        }
        yield { type: 'done', value: response.output_parsed as z.infer<T> };
        return;
      } catch (error) {
        // An effort the model rejects fails before the first token, so a retry is still clean.
        if (attempt === 0 && !yielded && this.useFallback(error, s)) continue;
        const cause = stalled.signal.aborted && !signal?.aborted ? new StreamStalled() : error;
        throw this.toHttpError(cause, request.feature, s, started);
      } finally {
        clearTimeout(timer);
      }
    }
  }

  private require(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI features are not set up on this server (OPENAI_API_KEY).',
      );
    }
    return this.client;
  }

  /** True when the model rejected the effort and a fallback is now remembered for it. */
  private useFallback(error: unknown, s: AiSettings): boolean {
    const effort = effortFallback(error, s.effort);
    if (!effort) return false;
    this.fallbacks.set(`${s.model}|${s.effort}`, effort);
    this.logger.warn(
      `${s.model} doesn't accept reasoning effort "${s.effort}", using "${effort}". ` +
        `Set ${s.effortVar}=${effort} to make it permanent. (OpenAI: ${(error as Error).message})`,
    );
    return true;
  }

  private logUsage(
    feature: AiFeature,
    s: AiSettings,
    started: number,
    response: {
      usage?: Usage | null;
      service_tier?: string | null;
      status?: string | null;
    },
    firstOutput = 0,
  ): void {
    this.logger.log(
      formatUsage({
        feature,
        model: s.model,
        effort: s.effort,
        ms: performance.now() - started,
        ...(firstOutput ? { firstOutputMs: firstOutput - started } : {}),
        usage: response.usage,
        serviceTier: response.service_tier,
        status: response.status,
      }),
    );
  }

  /** An HTTP error for the learner, and a log line that says what to fix for the operator. */
  private toHttpError(error: unknown, feature: AiFeature, s: AiSettings, started: number): unknown {
    if (error instanceof HttpException || error instanceof OpenAI.APIUserAbortError) return error;
    const what = `${feature} ${s.model} effort=${s.effort}`;
    const after = seconds(performance.now() - started);
    // Development shows OpenAI's own words; production keeps them in the log.
    const detail = (code: ApiErrorCode, e: Error) => {
      const body = apiError(code);
      return this.env.NODE_ENV === 'production'
        ? body
        : { ...body, message: `${body.message} (OpenAI: ${e.message})` };
    };

    if (error instanceof StreamStalled || error instanceof OpenAI.APIConnectionTimeoutError) {
      this.logger.warn(`${what}: no answer after ${after} (OPENAI_TIMEOUT_MS)`);
      return new GatewayTimeoutException(apiError('aiTimeout'));
    }
    if (error instanceof OpenAI.APIConnectionError) {
      this.logger.warn(`${what}: can't reach OpenAI: ${error.message}`);
      return new BadGatewayException(apiError('aiUnreachable'));
    }
    if (error instanceof OpenAI.RateLimitError) {
      if (error.code === 'insufficient_quota') {
        this.logger.error(`OpenAI account is out of credit (insufficient_quota): ${error.message}`);
        return new ServiceUnavailableException(detail('aiUnavailable', error));
      }
      this.logger.warn(`${what}: rate limited after ${after}`);
      return new ServiceUnavailableException(apiError('aiBusy'));
    }
    if (
      error instanceof OpenAI.AuthenticationError ||
      error instanceof OpenAI.PermissionDeniedError
    ) {
      this.logger.error(`OpenAI rejected OPENAI_API_KEY (${error.status}): ${error.message}`);
      return new ServiceUnavailableException(detail('aiMisconfigured', error));
    }
    if (error instanceof OpenAI.NotFoundError) {
      this.logger.error(`${what}: unknown model, check ${s.modelVar}: ${error.message}`);
      return new BadGatewayException(detail('aiFailed', error));
    }
    if (error instanceof OpenAI.BadRequestError) {
      const param = error.param ? ` (${error.param})` : '';
      this.logger.error(`${what}: OpenAI rejected the request${param}: ${error.message}`);
      if (/image/i.test(`${error.param ?? ''} ${error.message}`)) {
        return new BadRequestException(apiError('photoUnreadable'));
      }
      return new BadGatewayException(detail('aiFailed', error));
    }
    if (error instanceof OpenAI.APIError) {
      this.logger.warn(
        `${what}: OpenAI API error ${error.status} after ${after}: ${error.message}`,
      );
      return new BadGatewayException(apiError('aiFailed'));
    }
    return error;
  }
}
