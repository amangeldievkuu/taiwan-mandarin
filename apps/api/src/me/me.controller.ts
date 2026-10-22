// The signed-in learner's data, for the web app and for other apps using a personal access token.

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  cardCounts,
  dailyFromActivity,
  dayKeyIn,
  kintsugi,
  LEVEL_IDS,
  practicedDays,
  retentionOf,
  totalXp,
  windowTotals,
  xpForDay,
} from '@taiwan-mandarin/shared';
import {
  DeckEntrySchema,
  LevelSchema,
  TimeZoneSchema,
  TokenCreateSchema,
  type CardRecordDto,
  type StatsDto,
  type TokenCreatedDto,
  type TokenDto,
} from '@taiwan-mandarin/shared/api';
import { z } from 'zod';
import { AuthGuard, CurrentUser, TokenAllowed, type AuthUser } from '../auth/auth.guard.js';
import { ApiZodBody, ZodBody, ZodPipe } from '../common/zod.js';
import { ContentService } from '../content/content.service.js';
import { FsrsService } from '../fsrs/fsrs.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityService } from '../sync/activity.service.js';
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
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  @Get('stats')
  @TokenAllowed()
  @ApiOperation({ summary: 'Streak, XP, words learned, retention and the last 30 days' })
  @ApiQuery({
    name: 'tz',
    required: false,
    description: 'IANA time zone the calendar days are counted in (default UTC)',
  })
  async stats(
    @CurrentUser() user: AuthUser,
    @Query('tz', new ZodPipe(TimeZoneSchema.default('UTC'))) tz = 'UTC',
  ): Promise<StatsDto> {
    const zone = (await this.activity.knows(tz)) ? tz : 'UTC';
    const [cards, total, days] = await Promise.all([
      this.db.card.findMany({
        where: { userId: user.id },
        select: { stability: true, suspended: true, level: true },
      }),
      this.db.reviewLog.count({ where: { userId: user.id } }),
      this.activity.days(user.id, zone),
    ]);
    const map = Object.fromEntries((days ?? []).map((d) => [d.date, d]));
    const today = dayKeyIn(Date.now(), zone);
    const last30 = windowTotals(map, today, 30);
    const streak = kintsugi(practicedDays(map), today);
    const counts = cardCounts(
      Object.fromEntries(cards.map((c, i) => [i, { card: c, suspended: c.suspended }])),
    );
    const byLevel = Object.fromEntries(
      LEVEL_IDS.map((l) => [l, cards.filter((c) => c.level === l).length]),
    );
    return {
      cards: { ...counts, byLevel },
      reviews: { total, last30Days: last30.reviews, retention: retentionOf(last30) },
      streak: {
        current: streak.count,
        longest: streak.longest,
        crack: streak.crack,
        seams: streak.seams,
      },
      xp: { total: totalXp(map), today: xpForDay(map[today]) },
      days: dailyFromActivity(map, today, 30),
    };
  }

  @Get('cards')
  @TokenAllowed()
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
  @TokenAllowed()
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
  @TokenAllowed()
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

  @Delete('progress')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Start over: delete every card, review, the deck and the personal FSRS weights',
  })
  async resetProgress(@CurrentUser() user: AuthUser): Promise<void> {
    await this.db.$transaction([
      this.db.card.deleteMany({ where: { userId: user.id } }),
      this.db.reviewLog.deleteMany({ where: { userId: user.id } }),
      this.db.user.update({
        where: { id: user.id },
        data: {
          deck: [],
          deckUpdatedAt: BigInt(Date.now()),
          fsrsWeights: [],
          fsrsTrainedAt: null,
          fsrsReviewCount: 0,
        },
      }),
    ]);
  }

  @Get('tokens')
  @ApiOperation({ summary: 'Personal access tokens' })
  listTokens(@CurrentUser() user: AuthUser): Promise<TokenDto[]> {
    return this.tokens.list(user.id);
  }

  @Post('tokens')
  @ApiOperation({ summary: 'Create a personal access token for the public API (shown once)' })
  @ApiZodBody(TokenCreateSchema)
  createToken(
    @CurrentUser() user: AuthUser,
    @ZodBody(TokenCreateSchema) body: z.infer<typeof TokenCreateSchema>,
  ): Promise<TokenCreatedDto> {
    return this.tokens.create(user.id, body.name);
  }

  @Delete('tokens/:id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a personal access token' })
  revokeToken(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
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
}
