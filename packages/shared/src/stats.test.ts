import { describe, expect, it } from 'vitest';
import { cardCounts, dailyReviews, retention, streaks, type ReviewLike } from './stats.ts';

const at = (day: string, rating = 3, state = 2): ReviewLike => ({
  rating,
  state,
  review: new Date(`${day}T10:00:00`).getTime(),
});
const now = new Date('2026-10-21T18:00:00');

describe('streaks', () => {
  it('counts consecutive days ending today', () => {
    const reviews = ['2026-10-19', '2026-10-20', '2026-10-21'].map((d) => at(d));
    expect(streaks(reviews, now)).toEqual({ current: 3, longest: 3 });
  });

  it('keeps yesterday’s streak until today’s first review', () => {
    expect(streaks([at('2026-10-19'), at('2026-10-20')], now).current).toBe(2);
  });

  it('breaks on a missed day and remembers the longest run', () => {
    const reviews = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-20',
      '2026-10-21',
    ].map((d) => at(d));
    expect(streaks(reviews, now)).toEqual({ current: 2, longest: 4 });
  });

  it('is zero without reviews', () => {
    expect(streaks([], now)).toEqual({ current: 0, longest: 0 });
  });
});

describe('dailyReviews', () => {
  it('fills every day of the window, oldest first', () => {
    const days = dailyReviews(
      [at('2026-10-21', 1), at('2026-10-21', 4), at('2026-10-20', 3)],
      now,
      3,
    );
    expect(days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(days[2]).toMatchObject({ again: 1, easy: 1, total: 2 });
    expect(days[0]?.total).toBe(0);
  });

  it('ignores reviews outside the window', () => {
    expect(dailyReviews([at('2026-09-01')], now, 30).every((d) => d.total === 0)).toBe(true);
  });
});

describe('retention', () => {
  it('is the share of review-state cards not forgotten', () => {
    expect(
      retention([
        at('2026-10-21', 1),
        at('2026-10-21', 3),
        at('2026-10-21', 2),
        at('2026-10-21', 4),
      ]),
    ).toBe(0.75);
    expect(retention([at('2026-10-21', 1, 0)])).toBeNull();
  });
});

describe('cardCounts', () => {
  it('counts learned, mature and suspended cards', () => {
    const card = { stability: 0 };
    expect(
      cardCounts({
        a: { card },
        b: { card: { stability: 30 } },
        c: { card, suspended: true },
      }),
    ).toEqual({ learned: 3, mature: 1, suspended: 1 });
  });
});
