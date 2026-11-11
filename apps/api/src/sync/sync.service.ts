// Offline-first sync. The client sends what changed since its last sync; the server merges:
//   cards     last-write-wins on the client's updatedAt (per word);
//   reviews, practice   append-only, keyed by the client's UUID (retries are harmless);
//   deck, settings   whole-value last-write-wins.
// It answers with every card the server has that changed since the client's cursor, plus its copy
// of any card the client sent an older version of, and, when asked, practice totals per day in the
// client's time zone (so every device shows the same streak).

import { Inject, Injectable, PayloadTooLargeException } from '@nestjs/common';
import type { CardRecordDto, SyncRequest, SyncResponse } from '@taiwan-mandarin/shared/api';
import { apiError, SettingsSchema, DeckEntrySchema } from '@taiwan-mandarin/shared/api';
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

/** Client clocks may run this far ahead of the server's; later timestamps are clamped. */
const MAX_CLOCK_AHEAD_MS = 5 * 60_000;
/**
 * Re-sent margin before the cursor: a card is stamped when its write is built, so one committed
 * just after another device's cursor can carry an earlier time. Merging is idempotent.
 */
const CURSOR_OVERLAP_MS = 60_000;

/**
 * The most one account may store. Sign-up is open and sync takes whatever a client sends, so
 * without these one account could fill the disk. Far beyond any learner: the path has about
 * 15,000 words, and a million reviews is a hundred a day for 27 years.
 */
export const MAX_CARDS = 50_000;
export const MAX_REVIEWS = 1_000_000;
export const MAX_PRACTICE = 200_000;

@Injectable()
export class SyncService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ActivityService) private readonly activity: ActivityService,
  ) {}

  async sync(userId: string, request: SyncRequest): Promise<SyncResponse> {
    await this.requireRoom(userId, request);

    // Cursor first: anything written from here on is newer than what this response returns.
    const cursor = Date.now();
    // A device whose clock runs ahead would otherwise win every merge for as long as it does.
    const latest = cursor + MAX_CLOCK_AHEAD_MS;
    const clamp = (updatedAt: number) => Math.min(updatedAt, latest);

    // Cards: keep the newer side of each. Each write is conditional, so a parallel sync from
    // another device can't replace a newer card with an older one.
    const lost = new Set<string>();
    if (request.cards.length) {
      const existing = new Map(
        (
          await this.db.card.findMany({
            where: { userId, wordId: { in: request.cards.map((c) => c.wordId) } },
            select: { wordId: true, updatedAt: true },
          })
        ).map((c) => [c.wordId, Number(c.updatedAt)]),
      );
      const rows = request.cards.map((c) => toRow(userId, { ...c, updatedAt: clamp(c.updatedAt) }));
      for (const row of rows) {
        const stored = existing.get(row.wordId);
        if (stored !== undefined && stored >= Number(row.updatedAt)) lost.add(row.wordId);
      }
      const fresh = rows.filter((r) => !existing.has(r.wordId));
      const newer = rows.filter((r) => existing.has(r.wordId) && !lost.has(r.wordId));
      for (let i = 0; i < fresh.length; i += 1000) {
        const batch = fresh.slice(i, i + 1000);
        const created = await this.db.card.createManyAndReturn({
          data: batch,
          skipDuplicates: true,
          select: { wordId: true },
        });
        // Created by a parallel sync since we looked: settle these like the existing ones.
        const made = new Set(created.map((c) => c.wordId));
        newer.push(...batch.filter((r) => !made.has(r.wordId)));
      }
      for (let i = 0; i < newer.length; i += 500) {
        const batch = newer.slice(i, i + 500);
        const results = await this.db.$transaction(
          batch.map((row) =>
            this.db.card.updateMany({
              where: { userId, wordId: row.wordId, updatedAt: { lt: row.updatedAt } },
              data: row,
            }),
          ),
        );
        batch.forEach((row, j) => {
          if (results[j]?.count === 0) lost.add(row.wordId);
        });
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

    if (request.practice.length) {
      const storedAt = new Date();
      await this.db.practiceLog.createMany({
        data: request.practice.map((p) => ({
          id: p.id,
          userId,
          kind: p.kind,
          ref: p.ref,
          at: new Date(p.at),
          createdAt: storedAt,
        })),
        skipDuplicates: true,
      });
    }

    // Settings and deck: each replaced only when the incoming one is newer, in the same statement.
    if (request.settings) {
      const updatedAt = BigInt(clamp(request.settings.updatedAt));
      await this.db.user.updateMany({
        where: { id: userId, settingsUpdatedAt: { lt: updatedAt } },
        data: { settings: request.settings.value, settingsUpdatedAt: updatedAt },
      });
    }
    if (request.deck) {
      const updatedAt = BigInt(clamp(request.deck.updatedAt));
      await this.db.user.updateMany({
        where: { id: userId, deckUpdatedAt: { lt: updatedAt } },
        data: { deck: request.deck.entries, deckUpdatedAt: updatedAt },
      });
    }
    let saved = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    // Where the learner is, for server-side jobs that count days (the nightly FSRS fit).
    if (request.activity && saved.timeZone !== request.activity.timeZone) {
      saved = await this.db.user.update({
        where: { id: userId },
        data: { timeZone: request.activity.timeZone },
      });
    }

    // Changed since the cursor, with a margin for writes that were in flight when it was taken,
    // and the server's copy of every card the client sent an older version of.
    const changed = await this.db.card.findMany({
      where: {
        userId,
        OR: [
          { serverUpdatedAt: { gt: new Date(request.since - CURSOR_OVERLAP_MS) } },
          ...(lost.size ? [{ wordId: { in: [...lost] } }] : []),
        ],
      },
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
      acceptedPractice: request.practice.map((p) => p.id),
      ...(asked && days
        ? { activity: { timeZone: asked.timeZone, full: asked.since === 0, days } }
        : {}),
    };
  }

  /**
   * Refuses a request that could take the account past its limits, before anything is written.
   * What is sent counts in full, even entries already stored: that only matters at the limit.
   */
  private async requireRoom(userId: string, request: SyncRequest): Promise<void> {
    const where = { userId };
    const [cards, reviews, practice] = await Promise.all([
      request.cards.length ? this.db.card.count({ where }) : 0,
      request.reviews.length ? this.db.reviewLog.count({ where }) : 0,
      request.practice.length ? this.db.practiceLog.count({ where }) : 0,
    ]);
    if (
      cards + request.cards.length > MAX_CARDS ||
      reviews + request.reviews.length > MAX_REVIEWS ||
      practice + request.practice.length > MAX_PRACTICE
    ) {
      throw new PayloadTooLargeException(apiError('accountFull'));
    }
  }
}
