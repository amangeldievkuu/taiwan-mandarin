import { describe, expect, it } from 'vitest';
import { highestLevel, toggledLevels } from './levels';

describe('toggledLevels', () => {
  it('adds a level in path order, wherever it is turned on', () => {
    expect(toggledLevels(['L1'], 'N2')).toEqual(['N2', 'L1']);
    expect(toggledLevels(['N1', 'L2'], 'L1')).toEqual(['N1', 'L1', 'L2']);
  });

  it('removes a level, and puts levels saved out of order back in order', () => {
    expect(toggledLevels(['L1', 'N1', 'N2'], 'N2')).toEqual(['N1', 'L1']);
  });

  it('refuses to turn off the last one', () => {
    expect(toggledLevels(['N1'], 'N1')).toBeNull();
  });
});

describe('highestLevel', () => {
  it('is the furthest along the path, not the last saved', () => {
    expect(highestLevel(['L1', 'N2'])).toBe('L1');
    expect(highestLevel([])).toBeUndefined();
  });
});
