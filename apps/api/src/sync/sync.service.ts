// Offline-first sync. The client sends what changed since its last sync; the server merges:
//   cards     last-write-wins on the client's updatedAt (per word);
//   reviews   append-only, keyed by the client's UUID (retries are harmless);
//   deck, settings   whole-value last-write-wins.
// It answers with every card the server has that changed since the client's cursor, and, when asked,
// practice totals per day in the client's time zone (so every device shows the same streak).

import { Inject, Injectable } from '@nestjs/common';
import type { CardRecordDto, SyncRequest, SyncResponse } from '@taiwan-mandarin/shared/api';
import { SettingsSchema, DeckEntrySchema } from '@taiwan-mandarin/shared/api';
import { z } from 'zod';
import type { Card as CardRow } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActivityService } from './activity.service.js';

export function toDto(row: CardRow): CardRecordDto {
  return {
    wordId: row.wordId,
    updatedAt: Number(row.updatedAt),
    ...(row.level ? { level: row.level as CardRecordDto['level'] } : {}),
    ...(row.suspended ? { suspended: true } : {}),
    card: {
      due: row.due.toISOString(),
      stability: row.stability,
      difficulty: row.difficulty,
      elapsed_days: row.elapsedDays,
      scheduled_days: row.scheduledDays,
      learning_steps: row.learningSteps,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      last_review: row.lastReview?.toISOString() ?? null,
    },
  };
}

function toRow(userId: string, r: CardRecordDto) {
  return {
    userId,
    wordId: r.wordId,
    level: r.level ?? null,
    suspended: r.suspended ?? false,
    due: new Date(r.card.due),
    stability: r.card.stability,
    difficulty: r.card.difficulty,
    elapsedDays: r.card.elapsed_days,
    scheduledDays: r.card.scheduled_days,
    learningSteps: r.card.learning_steps,
    reps: r.card.reps,
    lapses: r.card.lapses,
    state: r.card.state,
    lastReview: r.card.last_review ? new Date(r.card.last_review) : null,
    updatedAt: BigInt(r.updatedAt),
  };
}

@Injectable()
export class SyncService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  async sync(userId: string, request: SyncRequest): Promise<SyncResponse> {
    // Cursor first: anything written from here on is newer than what this response returns.
    const cursor = Date.now();

    // Cards: keep the newer side of each.
    if (request.cards.length) {
      const existing = new Map(
        (
          await this.db.card.findMany({
            where: { userId, wordId: { in: request.cards.map((c) => c.wordId) } },
            select: { wordId: true, updatedAt: true },
          })
        ).map((c) => [c.wordId, Number(c.updatedAt)]),
      );
      const winners = request.cards.filter((c) => (existing.get(c.wordId) ?? -1) < c.updatedAt);
      for (let i = 0; i < winners.length; i += 500) {
        await this.db.$transaction(
          winners.slice(i, i + 500).map((c) => {
            const row = toRow(userId, c);
            return this.db.card.upsert({
              where: { userId_wordId: { userId, wordId: c.wordId } },
              create: row,
              update: row,
            });
          }),
        );
      }
    }

    // Reviews: insert, ignoring ids we already have.
    if (request.reviews.length) {
      // Stored-at time set here rather than by the database, whose default depends on its zone.
      const storedAt = new Date();
      await this.db.reviewLog.createMany({
        data: request.reviews.map((r) => ({
          id: r.id,
          userId,
          wordId: r.wordId,
          rating: r.rating,
          state: r.state,
          reviewedAt: new Date(r.review),
          due: new Date(r.due),
          stability: r.stability,
          difficulty: r.difficulty,
          elapsedDays: r.elapsedDays,
          scheduledDays: r.scheduledDays,
          durationMs: r.durationMs,
          createdAt: storedAt,
        })),
        skipDuplicates: true,
      });
    }

    const user = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    const patch: Record<string, unknown> = {};
    if (request.settings && request.settings.updatedAt > Number(user.settingsUpdatedAt)) {
      patch['settings'] = request.settings.value;
      patch['settingsUpdatedAt'] = BigInt(request.settings.updatedAt);
    }
    if (request.deck && request.deck.updatedAt > Number(user.deckUpdatedAt)) {
      patch['deck'] = request.deck.entries;
      patch['deckUpdatedAt'] = BigInt(request.deck.updatedAt);
    }
    const saved = Object.keys(patch).length
      ? await this.db.user.update({ where: { id: userId }, data: patch })
      : user;

    const changed = await this.db.card.findMany({
      where: { userId, serverUpdatedAt: { gt: new Date(request.since) } },
    });

    const settings = SettingsSchema.safeParse(saved.settings);
    const deck = z.array(DeckEntrySchema).safeParse(saved.deck);
    const asked = request.activity;
    const days = asked ? await this.activity.days(userId, asked.timeZone, asked.since) : undefined;
    return {
      cursor,
      cards: changed.map(toDto),
      ...(settings.success
        ? { settings: { value: settings.data, updatedAt: Number(saved.settingsUpdatedAt) } }
        : {}),
      ...(deck.success
        ? { deck: { entries: deck.data, updatedAt: Number(saved.deckUpdatedAt) } }
        : {}),
      ...(saved.fsrsTrainedAt && saved.fsrsWeights.length
        ? {
            fsrs: {
              w: saved.fsrsWeights,
              trainedAt: saved.fsrsTrainedAt.toISOString(),
              reviewCount: saved.fsrsReviewCount,
            },
          }
        : {}),
      acceptedReviews: request.reviews.map((r) => r.id),
      ...(asked && days
        ? { activity: { timeZone: asked.timeZone, full: asked.since === 0, days } }
        : {}),
    };
  }
}
