import { describe, expect, it } from 'vitest';
import { keyboardFocused, letterOf } from './keys';

describe('letterOf', () => {
  it('is the letter typed on a Latin layout, whatever the case', () => {
    expect(letterOf({ key: 'r', code: 'KeyR' })).toBe('r');
    expect(letterOf({ key: 'U', code: 'KeyU' })).toBe('u');
    // AZERTY: the key typing "a" is where Q is on a US keyboard.
    expect(letterOf({ key: 'a', code: 'KeyQ' })).toBe('a');
  });

  it("is the key's US letter on another layout", () => {
    expect(letterOf({ key: 'к', code: 'KeyR' })).toBe('r');
    expect(letterOf({ key: 'Г', code: 'KeyU' })).toBe('u');
    expect(letterOf({ key: 'п', code: 'KeyG' })).toBe('g');
  });

  it('leaves other keys as they are', () => {
    expect(letterOf({ key: '3', code: 'Digit3' })).toBe('3');
    expect(letterOf({ key: '/', code: 'Slash' })).toBe('/');
    expect(letterOf({ key: 'Escape', code: 'Escape' })).toBe('escape');
  });
});

describe('keyboardFocused', () => {
  it('is false for anything but an element (and without a DOM)', () => {
    expect(keyboardFocused(null)).toBe(false);
    expect(keyboardFocused({} as EventTarget)).toBe(false);
  });
});
