import { describe, expect, it } from 'vitest';
import { cardCounts, dayKey } from './stats.ts';

describe('dayKey', () => {
  it('is the local calendar day', () => {
    expect(dayKey(new Date('2026-10-21T23:30:00'))).toBe('2026-10-21');
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
