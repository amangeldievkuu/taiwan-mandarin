import { Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  PronounceRequestSchema,
  type PronounceRequest,
  type PronounceResult,
} from '@taiwan-mandarin/shared/api';
import { QuotaService } from '../ai/quota.service.js';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ApiZodBody, ZodBody } from '../common/zod.js';
import { SpeechService } from './speech.service.js';
import { WhisperService } from './whisper.service.js';

@ApiTags('speech')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/speech')
export class SpeechController {
  constructor(
    @Inject(SpeechService) private readonly speech: SpeechService,
    @Inject(WhisperService) private readonly whisper: WhisperService,
    @Inject(QuotaService) private readonly quota: QuotaService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether pronunciation checks are available' })
  async status(@CurrentUser() user: AuthUser) {
    return {
      available: this.whisper.available,
      used: await this.quota.used(user.id, 'speech'),
      limit: this.quota.limit('speech'),
    };
  }

  @Post('check')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Check a recording against a word or sentence: syllables (speech-to-text) and tones',
  })
  @ApiZodBody(PronounceRequestSchema)
  async check(
    @CurrentUser() user: AuthUser,
    @ZodBody(PronounceRequestSchema) body: PronounceRequest,
  ): Promise<PronounceResult> {
    // The quota is only charged for recordings that get sent for recognition.
    return this.speech.check(body, () => this.quota.consume(user.id, 'speech'));
  }
}
