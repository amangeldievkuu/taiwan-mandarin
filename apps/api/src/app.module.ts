import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiController } from './ai/ai.controller.js';
import { LlmService } from './ai/llm.service.js';
import { ExplainService } from './ai/explain.service.js';
import { QuotaService } from './ai/quota.service.js';
import { TalkService } from './ai/talk.service.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { ENV, loadEnv, type Env } from './config/env.js';
import { ContentService } from './content/content.service.js';
import { PublicController } from './content/public.controller.js';
import { FsrsService } from './fsrs/fsrs.service.js';
import { HealthController } from './health/health.controller.js';
import { MeController } from './me/me.controller.js';
import { TokensService } from './me/tokens.service.js';
import { PrismaService } from './prisma/prisma.service.js';
import { SpeechController } from './speech/speech.controller.js';
import { SpeechService } from './speech/speech.service.js';
import { WhisperService } from './speech/whisper.service.js';
import { ActivityService } from './sync/activity.service.js';
import { SyncController } from './sync/sync.controller.js';
import { SyncService } from './sync/sync.service.js';

const env = loadEnv();

@Module({
  imports: [
    JwtModule.register({ secret: env.JWT_SECRET, signOptions: { algorithm: 'HS256' } }),
    // 120 requests a minute per client by default; auth routes are stricter.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
  ],
  controllers: [
    HealthController,
    AuthController,
    SyncController,
    MeController,
    PublicController,
    AiController,
    SpeechController,
  ],
  providers: [
    { provide: ENV, useValue: env satisfies Env },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    PrismaService,
    ContentService,
    AuthService,
    AuthGuard,
    SyncService,
    ActivityService,
    TokensService,
    FsrsService,
    LlmService,
    QuotaService,
    ExplainService,
    TalkService,
    WhisperService,
    SpeechService,
  ],
})
export class AppModule {}
