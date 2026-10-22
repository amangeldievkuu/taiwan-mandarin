import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  ExplainRequestSchema,
  TalkRequestSchema,
  type ExplainRequest,
  type ExplainResult,
  type TalkConversation,
  type TalkEndResponse,
  type TalkListItem,
  type TalkResponse,
} from '@taiwan-mandarin/shared/api';
import type { Response } from 'express';
import type { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { writeNdjson } from '../common/ndjson.js';
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
    this.requireAi();
    return this.quota.spend(user.id, 'ai', () => this.explainer.explain(body));
  }

  @Post('explain/stream')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Explain text or a photo, streamed as NDJSON: the translation first, then each word',
  })
  @ApiProduces('application/x-ndjson')
  @ApiZodBody(ExplainRequestSchema)
  async explainStream(
    @CurrentUser() user: AuthUser,
    @ZodBody(ExplainRequestSchema) body: ExplainRequest,
    @Res() res: Response,
  ): Promise<void> {
    // Checked before the stream starts, so these still come back as plain HTTP errors.
    this.requireAi();
    await this.quota.consume(user.id, 'ai');
    await writeNdjson(res, (signal) => this.explainer.explainStream(body, signal));
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
    this.requireAi();
    return this.quota.spend(user.id, 'ai', () => this.talker.talk(user.id, body));
  }

  @Get('talk')
  @ApiOperation({ summary: 'Recent conversations' })
  conversations(@CurrentUser() user: AuthUser): Promise<TalkListItem[]> {
    return this.talker.list(user.id);
  }

  @Get('talk/:id')
  @ApiOperation({ summary: 'A conversation with all its messages (and its summary, once ended)' })
  conversation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TalkConversation> {
    return this.talker.messages(user.id, id);
  }

  @Post('talk/:id/end')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'End a conversation: a goodbye from the partner, then a summary' })
  end(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TalkEndResponse> {
    // The goodbye uses one AI message when there is one left today; without it the chat still ends.
    const mayClose = () =>
      this.quota.consume(user.id, 'ai').then(
        () => true,
        (error: unknown) => {
          if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS)
            return false;
          throw error;
        },
      );
    return this.talker.end(user.id, id, mayClose);
  }

  @Delete('talk/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a conversation' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.talker.remove(user.id, id);
  }

  /** Before charging the quota: a server without OpenAI answers 503 and keeps the learner's quota. */
  private requireAi(): void {
    if (!this.llm.available) {
      throw new ServiceUnavailableException(
        'AI features are not set up on this server (OPENAI_API_KEY).',
      );
    }
  }
}
