import { describe, expect, it } from 'vitest';
import { dayNumber, MAX_CARD_REVIEWS, MAX_STEPS, trainingItems } from './items.js';

const at = (iso: string) => new Date(iso);

describe('dayNumber', () => {
  it('starts the day at 04:00 local time', () => {
    // 02:00 in Taipei (UTC+8) still belongs to the previous day.
    expect(dayNumber(at('2026-10-20T18:00:00Z'), 480)).toBe(
      dayNumber(at('2026-10-20T10:00:00Z'), 480),
    );
    expect(dayNumber(at('2026-10-20T20:30:00Z'), 480)).toBe(
      dayNumber(at('2026-10-20T10:00:00Z'), 480) + 1,
    );
  });
});

describe('trainingItems', () => {
  it('makes one item per later review, with day gaps', () => {
    const items = trainingItems([
      { wordId: 'a', reviewedAt: at('2026-10-01T02:00:00Z'), rating: 3 },
      { wordId: 'a', reviewedAt: at('2026-10-03T02:00:00Z'), rating: 3 },
      { wordId: 'a', reviewedAt: at('2026-10-10T02:00:00Z'), rating: 1 },
    ]);
    expect(items).toEqual([
      [
        { rating: 3, deltaT: 0 },
        { rating: 3, deltaT: 2 },
      ],
      [
        { rating: 3, deltaT: 0 },
        { rating: 3, deltaT: 2 },
        { rating: 1, deltaT: 7 },
      ],
    ]);
  });

  it('skips histories that never left the first day', () => {
    const items = trainingItems([
      { wordId: 'b', reviewedAt: at('2026-10-01T02:00:00Z'), rating: 1 },
      { wordId: 'b', reviewedAt: at('2026-10-01T02:05:00Z'), rating: 3 },
    ]);
    expect(items).toEqual([]);
  });

  it('keeps cards apart and orders by time', () => {
    const items = trainingItems([
      { wordId: 'c', reviewedAt: at('2026-10-05T02:00:00Z'), rating: 4 },
      { wordId: 'd', reviewedAt: at('2026-10-01T02:00:00Z'), rating: 3 },
      { wordId: 'c', reviewedAt: at('2026-10-01T02:00:00Z'), rating: 3 },
    ]);
    expect(items).toEqual([
      [
        { rating: 3, deltaT: 0 },
        { rating: 4, deltaT: 4 },
      ],
    ]);
  });
});

describe('trainingItems on any history a client can send', () => {
  /** `count` reviews of one word, one a day. */
  const daily = (wordId: string, count: number, from = Date.UTC(2026, 0, 1, 2)) =>
    Array.from({ length: count }, (_, i) => ({
      wordId,
      reviewedAt: new Date(from + i * 86_400_000),
      rating: 3,
    }));

  it("uses a card's first reviews only, so one word reviewed 20,000 times stays cheap", () => {
    const started = performance.now();
    const items = trainingItems(daily('a', 20_000));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(items).toHaveLength(MAX_CARD_REVIEWS - 1);
    expect(items.at(-1)).toHaveLength(MAX_CARD_REVIEWS);
  });

  it('keeps the newest items within the step budget', () => {
    const items = trainingItems(
      [
        ...daily('a', 3, Date.UTC(2026, 0, 1, 2)), // items of 2 and 3 steps, on days 2 and 3
        ...daily('b', 2, Date.UTC(2026, 0, 4, 2)), // an item of 2 steps, on day 5
      ],
      480,
      5,
    );
    // Newest first: b's (2), then a's longest (3); a's first (2) no longer fits.
    expect(items.map((item) => item.length)).toEqual([3, 2]);
  });

  it('gives items in review order across cards', () => {
    const items = trainingItems([
      { wordId: 'x', reviewedAt: at('2026-10-01T02:00:00Z'), rating: 3 },
      { wordId: 'x', reviewedAt: at('2026-10-10T02:00:00Z'), rating: 1 },
      { wordId: 'y', reviewedAt: at('2026-10-02T02:00:00Z'), rating: 3 },
      { wordId: 'y', reviewedAt: at('2026-10-05T02:00:00Z'), rating: 4 },
    ]);
    expect(items.map((item) => item.at(-1))).toEqual([
      { rating: 4, deltaT: 3 },
      { rating: 1, deltaT: 9 },
    ]);
  });

  it('bounds the work of a whole account', () => {
    const reviews = Array.from({ length: 2000 }, (_, i) => daily(`w${i}`, 500)).flat();
    const started = performance.now();
    const items = trainingItems(reviews);
    expect(performance.now() - started).toBeLessThan(5000);
    expect(items.reduce((sum, item) => sum + item.length, 0)).toBeLessThanOrEqual(MAX_STEPS);
  });
});
