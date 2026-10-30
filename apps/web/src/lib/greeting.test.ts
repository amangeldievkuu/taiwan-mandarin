import { describe, expect, it } from 'vitest';
import { partOfDay } from './greeting';

describe('partOfDay', () => {
  it('splits the day at 5, 11, 18 and 22', () => {
    expect([4, 5, 10, 11, 17, 18, 21, 22].map(partOfDay)).toEqual([
      'night',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
      'night',
    ]);
  });

  it('calls just after midnight night', () => {
    expect(partOfDay(0)).toBe('night');
  });
});
