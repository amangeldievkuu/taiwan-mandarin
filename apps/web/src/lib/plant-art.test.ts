import { describe, expect, it } from 'vitest';
import { plantShape, POT_RIM, skyTop } from './plant-art';

describe('skyTop', () => {
  it('starts an empty pot just above its rim, and a tree at the top', () => {
    expect(skyTop(0)).toBeLessThan(POT_RIM.y);
    expect(skyTop(0)).toBeGreaterThan(POT_RIM.y - 20);
    expect(skyTop(7)).toBe(0);
    expect(skyTop(400)).toBe(0);
  });

  it('only ever shows more sky as the plant grows', () => {
    for (let days = 0; days < 8; days++) expect(skyTop(days + 1)).toBeLessThanOrEqual(skyTop(days));
  });

  it('never cuts off a seedling', () => {
    for (const seed of ['2026-01-01', '2026-11-11', 'x']) {
      for (let days = 1; days < 7; days++) {
        // A leaf reaches at most its length from where it grows, in any direction.
        const highest = Math.min(...plantShape(seed, days).leaves.map((l) => l.y - l.size));
        expect(skyTop(days)).toBeLessThanOrEqual(highest);
      }
    }
  });
});
