// Speech-to-text for the pronunciation check (OPENAI_TRANSCRIBE_MODEL, default whisper-1). The
// prompt sets the language and script only, never the target sentence: a checker has to report
// what was said, and a prompt holding the answer makes the recognizer hear it (or invent it from
// silence). Whisper often answers in Simplified characters, so the caller converts to Taiwan
// characters.

import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { ENV, type Env } from '../config/env.js';
import { apiError } from '@taiwan-mandarin/shared/api';

export interface Transcript {
  text: string;
  /** Word timings (whisper-1 only); empty when the model gives none. */
  words: { word: string; start: number; end: number }[];
}

/** Neutral context: Traditional characters, Taiwan Mandarin. */
const PROMPT = '臺灣華語。';

@Injectable()
export class WhisperService implements OnModuleInit {
  private readonly logger = new Logger(WhisperService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;
  /** whisper-1 times every word; the newer models return text only. */
  private readonly timestamps: boolean;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.OPENAI_API_KEY
      ? new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          timeout: env.OPENAI_TIMEOUT_MS,
          maxRetries: env.OPENAI_MAX_RETRIES,
        })
      : null;
    this.model = env.OPENAI_TRANSCRIBE_MODEL;
    this.timestamps = /^whisper/.test(this.model);
  }

  get available(): boolean {
    return this.client !== null;
  }

  onModuleInit(): void {
    if (!this.client) return;
    this.logger.log(
      `Speech: ${this.model}` +
        (this.timestamps
          ? ' with word timestamps'
          : ' (no word timestamps: tones timed from audio)'),
    );
  }

  async transcribe(wav: Buffer): Promise<Transcript> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Pronunciation checks are not set up on this server (OPENAI_API_KEY).',
      );
    }
    const started = performance.now();
    try {
      const file = await toFile(wav, 'speech.wav', { type: 'audio/wav' });
      const request = { file, model: this.model, language: 'zh', prompt: PROMPT, temperature: 0 };
      const transcript: Transcript = this.timestamps
        ? await this.client.audio.transcriptions
            .create({
              ...request,
              response_format: 'verbose_json',
              timestamp_granularities: ['word'],
            })
            .then((r) => ({ text: r.text ?? '', words: r.words ?? [] }))
        : await this.client.audio.transcriptions
            .create({ ...request, response_format: 'json' })
            .then((r) => ({ text: r.text ?? '', words: [] }));
      // 16 kHz mono 16-bit: 32,000 bytes a second after the 44-byte header.
      const audio = Math.max(0, wav.length - 44) / 32_000;
      this.logger.log(
        `transcribe ${this.model} · ${((performance.now() - started) / 1000).toFixed(2)} s · ` +
          `${audio.toFixed(1)} s audio`,
      );
      return transcript;
    } catch (error) {
      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        this.logger.warn(`transcribe ${this.model}: timed out (OPENAI_TIMEOUT_MS)`);
        throw new GatewayTimeoutException(apiError('speechTimeout'));
      }
      if (error instanceof OpenAI.RateLimitError) {
        throw new ServiceUnavailableException(apiError('speechBusy'));
      }
      if (error instanceof OpenAI.APIError) {
        this.logger.warn(`transcribe ${this.model}: error ${error.status}: ${error.message}`);
        throw new BadGatewayException(apiError('speechFailed'));
      }
      throw error;
    }
  }
}
