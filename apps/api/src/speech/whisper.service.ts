// Speech-to-text with OpenAI Whisper. The target sentence goes in as the prompt, which biases
// recognition toward the expected words without forcing them; Whisper often answers in
// Simplified characters, so the caller converts to Taiwan characters.

import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import OpenAI, { toFile } from 'openai';
import { ENV, type Env } from '../config/env.js';

export interface Transcript {
  text: string;
  words: { word: string; start: number; end: number }[];
}

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);
  private readonly client: OpenAI | null;

  constructor(@Inject(ENV) env: Env) {
    this.client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }

  get available(): boolean {
    return this.client !== null;
  }

  async transcribe(wav: Buffer, prompt: string): Promise<Transcript> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Pronunciation checks are not set up on this server (OPENAI_API_KEY).',
      );
    }
    try {
      const result = await this.client.audio.transcriptions.create({
        file: await toFile(wav, 'speech.wav', { type: 'audio/wav' }),
        model: 'whisper-1',
        language: 'zh',
        prompt: `臺灣華語。${prompt}`,
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
        temperature: 0,
      });
      return { text: result.text ?? '', words: result.words ?? [] };
    } catch (error) {
      if (error instanceof OpenAI.APIError) {
        this.logger.warn(`Whisper error ${error.status}: ${error.message}`);
        throw new BadGatewayException('Speech recognition failed. Try again.');
      }
      throw error;
    }
  }
}
