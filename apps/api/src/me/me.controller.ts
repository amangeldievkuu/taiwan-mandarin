// The signed-in learner's data, for the web app and for other apps using a personal access token.

import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { cardCounts, dailyReviews, LEVEL_IDS, retention, streaks } from '@taiwan-mandarin/shared';
import {
  DeckEntrySchema,
  LevelSchema,
  TokenCreateSchema,
  type CardRecordDto,
  type StatsDto,
  type TokenCreatedDto,
  type TokenDto,
} from '@taiwan-mandarin/shared/api';
import { z } from 'zod';
import { AuthGuard, CurrentUser, type AuthUser } from '../auth/auth.guard.js';
import { ApiZodBody, ZodBody, ZodPipe } from '../common/zod.js';
import { ContentService } from '../content/content.service.js';
import { FsrsService } from '../fsrs/fsrs.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDto } from '../sync/sync.service.js';
import { TokensService } from './tokens.service.js';

const OptimizeSchema = z.object({
  utcOffsetMinutes: z.number().int().min(-720).max(840).default(480),
});

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('v1/me')
export class MeController {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(TokensService) private readonly tokens: TokensService,
    @Inject(FsrsService) private readonly fsrs: FsrsService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Streak, words learned, retention and the last 30 days' })
  async stats(@CurrentUser() user: AuthUser): Promise<StatsDto> {
    const [cards, reviews] = await Promise.all([
      this.db.card.findMany({
        where: { userId: user.id },
        select: { stability: true, suspended: true, level: true },
      }),
      this.db.reviewLog.findMany({
        where: { userId: user.id },
        select: { reviewedAt: true, rating: true, state: true },
      }),
    ]);
    const points = reviews.map((r) => ({
      review: r.reviewedAt.getTime(),
      rating: r.rating,
      state: r.state,
    }));
    const now = new Date();
    const since = now.getTime() - 30 * 86_400_000;
    const recent = points.filter((r) => r.review >= since);
    const counts = cardCounts(
      Object.fromEntries(cards.map((c, i) => [i, { card: c, suspended: c.suspended }])),
    );
    const byLevel = Object.fromEntries(
      LEVEL_IDS.map((l) => [l, cards.filter((c) => c.level === l).length]),
    );
    return {
      cards: { ...counts, byLevel },
      reviews: { total: points.length, last30Days: recent.length, retention: retention(recent) },
      streak: streaks(points, now),
      days: dailyReviews(points, now, 30),
    };
  }

  @Get('cards')
  @ApiOperation({ summary: 'FSRS cards, optionally only due ones or one level' })
  @ApiQuery({ name: 'due', required: false, type: Boolean })
  @ApiQuery({ name: 'level', required: false, enum: LEVEL_IDS })
  async cards(
    @CurrentUser() user: AuthUser,
    @Query('due') due?: string,
    @Query('level', new ZodPipe(LevelSchema.optional())) level?: string,
  ): Promise<(CardRecordDto & { hanzi?: string; en?: string })[]> {
    const rows = await this.db.card.findMany({
      where: {
        userId: user.id,
        ...(level ? { level } : {}),
        ...(due === 'true' ? { due: { lte: new Date() }, suspended: false } : {}),
      },
      orderBy: { due: 'asc' },
    });
    return rows.map((row) => {
      const word = this.content.word(row.wordId);
      return { ...toDto(row), ...(word ? { hanzi: word.hanzi, en: word.en } : {}) };
    });
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Review log, newest first' })
  @ApiQuery({ name: 'since', required: false, description: 'Epoch ms' })
  @ApiQuery({ name: 'limit', required: false })
  async reviews(
    @CurrentUser() user: AuthUser,
    @Query('since', new ZodPipe(z.coerce.number().int().min(0).default(0))) since = 0,
    @Query('limit', new ZodPipe(z.coerce.number().int().min(1).max(5000).default(500))) limit = 500,
  ) {
    const rows = await this.db.reviewLog.findMany({
      where: { userId: user.id, reviewedAt: { gte: new Date(since) } },
      orderBy: { reviewedAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      wordId: r.wordId,
      rating: r.rating,
      state: r.state,
      review: r.reviewedAt.getTime(),
      durationMs: r.durationMs,
    }));
  }

  @Post('deck/:wordId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Add a word to the learner’s deck (studied before the path’s new words)',
  })
  async addToDeck(@CurrentUser() user: AuthUser, @Param('wordId') wordId: string): Promise<void> {
    const word = this.content.word(wordId);
    if (!word) throw new NotFoundException('No such word');
    const row = await this.db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { deck: true },
    });
    const deck = z.array(DeckEntrySchema).catch([]).parse(row.deck);
    if (deck.some((d) => d.id === wordId)) return;
    const now = Date.now();
    await this.db.user.update({
      where: { id: user.id },
      data: {
        deck: [...deck, { id: wordId, level: word.level, addedAt: now }],
        deckUpdatedAt: BigInt(now),
      },
    });
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Personal access tokens' })
  listTokens(@CurrentUser() user: AuthUser): Promise<TokenDto[]> {
    this.sessionOnly(user);
    return this.tokens.list(user.id);
  }

  @Post('tokens')
  @ApiOperation({ summary: 'Create a personal access token for the public API (shown once)' })
  @ApiZodBody(TokenCreateSchema)
  createToken(
    @CurrentUser() user: AuthUser,
    @ZodBody(TokenCreateSchema) body: z.infer<typeof TokenCreateSchema>,
  ): Promise<TokenCreatedDto> {
    this.sessionOnly(user);
    return this.tokens.create(user.id, body.name);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a personal access token' })
  revokeToken(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<void> {
    this.sessionOnly(user);
    return this.tokens.revoke(user.id, id);
  }

  @Post('fsrs/optimize')
  @ApiOperation({ summary: 'Fit personal FSRS parameters to this learner’s review history now' })
  @ApiZodBody(OptimizeSchema)
  optimize(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(OptimizeSchema)) body: z.infer<typeof OptimizeSchema>,
  ) {
    return this.fsrs.optimize(user.id, body.utcOffsetMinutes);
  }

  /** Tokens can't mint or list other tokens. */
  private sessionOnly(user: AuthUser): void {
    if (user.via !== 'session') throw new ForbiddenException('Sign in to manage tokens');
  }
}
