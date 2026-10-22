import { describe, expect, it } from 'vitest';
import { emptyDay } from './activity.ts';
import { achievements } from './achievements.ts';
import { kintsugi } from './kintsugi.ts';

describe('achievements', () => {
  it('starts with nothing earned', () => {
    expect(achievements({}, kintsugi([], '2026-10-21')).every((s) => s.progress === 0)).toBe(true);
  });

  it('awards seals from activity and the streak', () => {
    const days = {
      '2026-10-18': { ...emptyDay('2026-10-18'), reviews: 60, learned: 60 },
      '2026-10-21': { ...emptyDay('2026-10-21'), reviews: 40, learned: 40 },
    };
    const seals = achievements(days, kintsugi(Object.keys(days), '2026-10-21'));
    const by = Object.fromEntries(seals.map((s) => [s.id, s.progress]));
    expect(by['first-day']).toBe(1);
    expect(by['first-gold']).toBe(1); // 19–20 mended on the 21st
    expect(by['words-100']).toBe(1);
    expect(by['words-500']).toBeCloseTo(0.2);
    expect(by['bowl-7']).toBeCloseTo(2 / 7);
  });
});
