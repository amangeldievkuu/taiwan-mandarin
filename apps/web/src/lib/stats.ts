// Learning statistics from the review log and card states. Pure functions, so they are easy to
// test and the API can compute the same numbers.

import { dayKey } from './srs';
import type { CardRecord, ReviewRecord } from './storage';

export interface DayStats {
  /** Local day, "2026-10-21". */
  date: string;
  again: number;
  hard: number;
  good: number;
  easy: number;
  total: number;
}

const RATING_KEY = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Reviews per day for the last `days` days, oldest first, including empty days. */
export function dailyReviews(reviews: readonly ReviewRecord[], now: Date, days = 30): DayStats[] {
  const byDay = new Map<string, DayStats>();
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey(addDays(now, -i));
    byDay.set(date, { date, again: 0, hard: 0, good: 0, easy: 0, total: 0 });
  }
  for (const r of reviews) {
    const day = byDay.get(dayKey(new Date(r.review)));
    const key = RATING_KEY[r.rating as 1 | 2 | 3 | 4];
    if (!day || !key) continue;
    day[key]++;
    day.total++;
  }
  return [...byDay.values()];
}

/**
 * Days in a row with at least one review. Today counts once reviewed; until then the streak
 * still stands on yesterday.
 */
export function streaks(
  reviews: readonly ReviewRecord[],
  now: Date,
): { current: number; longest: number } {
  const days = new Set(reviews.map((r) => dayKey(new Date(r.review))));
  let current = 0;
  let cursor = days.has(dayKey(now)) ? now : addDays(now, -1);
  while (days.has(dayKey(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let previous: string | undefined;
  for (const day of sorted) {
    const expected = previous ? dayKey(addDays(new Date(`${previous}T12:00:00`), 1)) : undefined;
    run = day === expected ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return { current, longest: Math.max(longest, current) };
}

/** Share of review-state cards remembered (rated Hard or better). */
export function retention(reviews: readonly ReviewRecord[]): number | null {
  const graded = reviews.filter((r) => r.state === 2);
  if (graded.length === 0) return null;
  return graded.filter((r) => r.rating >= 2).length / graded.length;
}

export interface CardCounts {
  /** Seen at least once. */
  learned: number;
  /** Stability of three weeks or more. */
  mature: number;
  suspended: number;
}

export function cardCounts(cards: Readonly<Record<string, CardRecord>>): CardCounts {
  let learned = 0;
  let mature = 0;
  let suspended = 0;
  for (const { card, suspended: off } of Object.values(cards)) {
    if (off) suspended++;
    learned++;
    if (card.stability >= 21) mature++;
  }
  return { learned, mature, suspended };
}
