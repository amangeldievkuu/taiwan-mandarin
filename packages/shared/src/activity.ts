// Learning activity per calendar day, summed from the review log and the practice log (stories,
// Talk, writing): what the streak, XP, the 30-day chart and retention are made of. The server sends the same totals for all of a learner's
// devices (sync), so every device shows the same numbers.

import { shiftDay } from './days.ts';
import { dayKey, type DayStats, type ReviewLike } from './stats.ts';

export interface DayActivity {
  /** "2026-10-21". */
  date: string;
  reviews: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
  /** New cards seen for the first time. */
  learned: number;
  /** Reviews of cards in the Review state, and how many of those were remembered (Hard or better). */
  graded: number;
  kept: number;
  /** Time spent answering, ms. */
  ms: number;
  /** Stories read to the end (each once a day). */
  read: number;
  /** Messages sent in Talk. */
  talk: number;
  /** Characters written in the stroke writer (each once a day). */
  write: number;
}

/** Day → activity. */
export type ActivityMap = Readonly<Record<string, DayActivity>>;

export interface ReviewEntry extends ReviewLike {
  durationMs?: number;
}

/** Practice outside the flashcards, kept in its own log: what was done, to what, when. */
export const PRACTICE_KINDS = ['read', 'talk', 'write'] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

export interface PracticeEntry {
  kind: PracticeKind;
  /** The story id, the Talk message id or the character. Counted once per day. */
  ref: string;
  /** Epoch ms. */
  at: number;
}

const COUNTS = [
  'reviews',
  'again',
  'hard',
  'good',
  'easy',
  'learned',
  'graded',
  'kept',
  'ms',
  ...PRACTICE_KINDS,
] as const;
const RATING = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const;

export const emptyDay = (date: string): DayActivity => ({
  date,
  reviews: 0,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
  learned: 0,
  graded: 0,
  kept: 0,
  ms: 0,
  read: 0,
  talk: 0,
  write: 0,
});

const localDay = (ms: number) => dayKey(new Date(ms));

function count(day: DayActivity, review: ReviewEntry): void {
  day.reviews++;
  const rating = RATING[review.rating as 1 | 2 | 3 | 4];
  if (rating) day[rating]++;
  if (review.state === 0) day.learned++;
  if (review.state === 2) {
    day.graded++;
    if (review.rating >= 2) day.kept++;
  }
  day.ms += review.durationMs ?? 0;
}

/** The map with one more review; the old map is left as it was. */
export function addToActivity(
  map: ActivityMap,
  review: ReviewEntry,
  dayOf: (ms: number) => string = localDay,
): ActivityMap {
  const date = dayOf(review.review);
  const day = { ...(map[date] ?? emptyDay(date)) };
  count(day, review);
  return { ...map, [date]: day };
}

export function activityFromReviews(
  reviews: readonly ReviewEntry[],
  dayOf: (ms: number) => string = localDay,
): ActivityMap {
  const map: Record<string, DayActivity> = {};
  for (const review of reviews) {
    const date = dayOf(review.review);
    count((map[date] ??= emptyDay(date)), review);
  }
  return map;
}

/** The map with one more practice entry; the old map is left as it was. */
export function addPractice(
  map: ActivityMap,
  entry: PracticeEntry,
  dayOf: (ms: number) => string = localDay,
): ActivityMap {
  const date = dayOf(entry.at);
  const day = { ...emptyDay(date), ...map[date] };
  day[entry.kind]++;
  return { ...map, [date]: day };
}

/** Practice entries counted into the map, the same thing on the same day only once. */
export function activityWithPractice(
  map: ActivityMap,
  entries: readonly PracticeEntry[],
  dayOf: (ms: number) => string = localDay,
): ActivityMap {
  const seen = new Set<string>();
  let result = map;
  for (const entry of entries) {
    const key = `${entry.kind}\n${entry.ref}\n${dayOf(entry.at)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result = addPractice(result, entry, dayOf);
  }
  return result;
}

/** Both maps added up, day by day. */
export function sumActivity(a: ActivityMap, b: ActivityMap): ActivityMap {
  const map: Record<string, DayActivity> = { ...a };
  for (const [date, day] of Object.entries(b)) {
    const other = map[date];
    if (!other) {
      map[date] = day;
      continue;
    }
    const sum = { ...other };
    // Days saved before a count existed lack it.
    for (const key of COUNTS) sum[key] = (sum[key] ?? 0) + (day[key] ?? 0);
    map[date] = sum;
  }
  return map;
}

/** Days with at least one review. */
export const practicedDays = (map: ActivityMap): string[] =>
  Object.values(map).flatMap((d) => (d.reviews > 0 ? [d.date] : []));

/** The `days` days up to `today`, oldest first, empty days included: the 30-day chart. */
export function dailyFromActivity(map: ActivityMap, today: string, days = 30): DayStats[] {
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDay(today, i - days + 1);
    const d = map[date] ?? emptyDay(date);
    return { date, again: d.again, hard: d.hard, good: d.good, easy: d.easy, total: d.reviews };
  });
}

/** Totals over the `days` days up to `today`. */
export function windowTotals(
  map: ActivityMap,
  today: string,
  days = 30,
): Pick<DayActivity, 'reviews' | 'graded' | 'kept' | 'ms'> {
  const totals = { reviews: 0, graded: 0, kept: 0, ms: 0 };
  for (let i = 0; i < days; i++) {
    const d = map[shiftDay(today, -i)];
    if (!d) continue;
    totals.reviews += d.reviews;
    totals.graded += d.graded;
    totals.kept += d.kept;
    totals.ms += d.ms;
  }
  return totals;
}

/** Share of review-state cards remembered, or null before there are any. */
export const retentionOf = (t: { graded: number; kept: number }): number | null =>
  t.graded ? t.kept / t.graded : null;

/**
 * XP rewards effort, never the grade, so honest grading costs nothing: every answer is worth the
 * same, and meeting a new word a little more. Practice away from the cards counts too: a message
 * in Talk or a character written is worth an answer, a story read to the end five.
 */
export const XP = { review: 10, newWord: 5, read: 50, talk: 10, write: 10 } as const;

export const xpForDay = (day?: DayActivity): number =>
  day
    ? day.reviews * XP.review +
      day.learned * XP.newWord +
      PRACTICE_KINDS.reduce((sum, kind) => sum + (day[kind] ?? 0) * XP[kind], 0)
    : 0;

export const totalXp = (map: ActivityMap): number =>
  Object.values(map).reduce((sum, d) => sum + xpForDay(d), 0);
