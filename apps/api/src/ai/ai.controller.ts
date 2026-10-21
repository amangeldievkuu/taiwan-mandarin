import { Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ExplainRequestSchema,
  TalkRequestSchema,
  type ExplainRequest,
  type ExplainResult,
  type TalkResponse,
} from '@taiwan-mandarin/shared/api';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ApiZodBody, ZodBody } from '../common/zod.js';
import { LlmService } from './llm.service.js';
import { ExplainService } from './explain.service.js';
import { QuotaService } from './quota.service.js';
import { TalkService } from './talk.service.js';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/ai')
export class AiController {
  constructor(
    @Inject(LlmService) private readonly llm: LlmService,
    @Inject(QuotaService) private readonly quota: QuotaService,
    @Inject(ExplainService) private readonly explainer: ExplainService,
    @Inject(TalkService) private readonly talker: TalkService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Whether AI features are available, and today’s usage' })
  async status(@CurrentUser() user: AuthUser) {
    return {
      available: this.llm.available,
      used: await this.quota.used(user.id, 'ai'),
      limit: this.quota.limit('ai'),
    };
  }

  @Post('explain')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Explain a sign, menu or message (text or photo) word by word' })
  @ApiZodBody(ExplainRequestSchema)
  async explain(
    @CurrentUser() user: AuthUser,
    @ZodBody(ExplainRequestSchema) body: ExplainRequest,
  ): Promise<ExplainResult> {
    await this.quota.consume(user.id, 'ai');
    return this.explainer.explain(body);
  }

  @Post('talk')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a message to the conversation partner (or start a conversation)' })
  @ApiZodBody(TalkRequestSchema)
  async talk(
    @CurrentUser() user: AuthUser,
    @ZodBody(TalkRequestSchema) body: z.output<typeof TalkRequestSchema>,
  ): Promise<TalkResponse> {
    await this.quota.consume(user.id, 'ai');
    return this.talker.talk(user.id, body);
  }

  @Get('talk')
  @ApiOperation({ summary: 'Recent conversations' })
  conversations(@CurrentUser() user: AuthUser) {
    return this.talker.list(user.id);
  }

  @Get('talk/:id')
  @ApiOperation({ summary: 'A conversation with all its messages' })
  conversation(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.talker.messages(user.id, id);
  }
}
