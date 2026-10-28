import { describe, expect, it } from 'vitest';
import { shouldWelcome } from './welcome';

describe('shouldWelcome', () => {
  const fresh = { cards: 0, deck: 0, user: false, welcomed: false };

  it('welcomes a first visit', () => {
    expect(shouldWelcome(fresh)).toBe(true);
  });

  it('leaves learners alone', () => {
    expect(shouldWelcome({ ...fresh, cards: 1 })).toBe(false);
    expect(shouldWelcome({ ...fresh, deck: 1 })).toBe(false);
    expect(shouldWelcome({ ...fresh, user: true })).toBe(false);
    expect(shouldWelcome({ ...fresh, welcomed: true })).toBe(false);
  });
});
