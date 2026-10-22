import { describe, expect, it } from 'vitest';
import {
  activityFromReviews,
  addToActivity,
  dailyFromActivity,
  practicedDays,
  retentionOf,
  sumActivity,
  totalXp,
  windowTotals,
  xpForDay,
  type ReviewEntry,
} from './activity.ts';

const at = (day: string, rating = 3, state = 2, durationMs = 1000): ReviewEntry => ({
  rating,
  state,
  durationMs,
  review: Date.parse(`${day}T10:00:00Z`),
});
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('activity', () => {
  const map = activityFromReviews(
    [at('2026-10-21', 1), at('2026-10-21', 4, 0), at('2026-10-21', 3), at('2026-10-20', 2)],
    utc,
  );

  it('counts each day', () => {
    expect(map['2026-10-21']).toMatchObject({
      reviews: 3,
      again: 1,
      easy: 1,
      good: 1,
      learned: 1,
      graded: 2,
      kept: 1,
      ms: 3000,
    });
    expect(practicedDays(map).sort()).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('adds one review without changing the old map', () => {
    const next = addToActivity(map, at('2026-10-21', 3), utc);
    expect(next['2026-10-21']?.reviews).toBe(4);
    expect(map['2026-10-21']?.reviews).toBe(3);
  });

  it('adds two maps day by day', () => {
    const sum = sumActivity(map, activityFromReviews([at('2026-10-21'), at('2026-10-01')], utc));
    expect(sum['2026-10-21']?.reviews).toBe(4);
    expect(sum['2026-10-01']?.reviews).toBe(1);
  });

  it('fills the chart window, oldest first', () => {
    const days = dailyFromActivity(map, '2026-10-21', 3);
    expect(days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(days[2]).toMatchObject({ again: 1, easy: 1, total: 3 });
    expect(days[0]?.total).toBe(0);
  });

  it('works out retention over a window', () => {
    const totals = windowTotals(map, '2026-10-21', 30);
    expect(totals).toEqual({ reviews: 4, graded: 3, kept: 2, ms: 4000 });
    expect(retentionOf(totals)).toBeCloseTo(2 / 3);
    expect(retentionOf({ graded: 0, kept: 0 })).toBeNull();
  });

  it('gives XP for effort, the same for every grade', () => {
    // 12 reviews, 3 of them new words: 12 × 10 + 3 × 5.
    const day = activityFromReviews(
      [
        ...Array.from({ length: 9 }, () => at('2026-10-21', 1)),
        ...Array.from({ length: 3 }, () => at('2026-10-21', 4, 0)),
      ],
      utc,
    );
    expect(xpForDay(day['2026-10-21'])).toBe(135);
    expect(totalXp(map)).toBe(4 * 10 + 5);
  });
});
