import { describe, expect, it } from 'vitest';
import { apiError, errorCodeOf, ERRORS, fillParams } from './errors.ts';

describe('API errors', () => {
  it('have one wording per code, so a message leads back to its code', () => {
    const messages = Object.values(ERRORS);
    expect(new Set(messages).size).toBe(messages.length);
    expect(errorCodeOf('Wrong email or password')).toBe('wrongLogin');
    expect(errorCodeOf('Something else')).toBeUndefined();
  });

  it('fill in their parameters', () => {
    expect(apiError('dailyLimit', { limit: 50 })).toEqual({
      message: 'Daily limit reached (50). It resets tomorrow.',
      code: 'dailyLimit',
      params: { limit: 50 },
    });
    expect(apiError('wrongLogin')).toEqual({
      message: 'Wrong email or password',
      code: 'wrongLogin',
    });
    expect(fillParams('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });
});
