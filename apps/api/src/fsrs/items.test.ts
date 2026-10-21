import { describe, expect, it } from 'vitest';
import { dayNumber, trainingItems } from './items.js';

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
