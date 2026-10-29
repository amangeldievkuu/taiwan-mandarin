import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../api';
import { errorText } from './errors';
import { locale } from './index.svelte';

describe('errorText', () => {
  afterEach(() => (locale.lang = 'en'));

  it('words a coded error in the learner’s language, with its parameters', () => {
    const limit = new ApiError(429, 'Daily limit reached (5). It resets tomorrow.', {
      code: 'dailyLimit',
      params: { limit: 5 },
    });
    expect(errorText(limit)).toBe('Daily limit reached (5). It resets tomorrow.');
    locale.lang = 'vi';
    expect(errorText(limit)).toBe('Đã đạt giới hạn hôm nay (5). Ngày mai sẽ được làm mới.');
    expect(errorText(new ApiError(0, "Can't reach the server.", { code: 'offline' }))).toBe(
      'Không kết nối được máy chủ.',
    );
  });

  it('falls back to plain words for server failures, else the server’s own', () => {
    locale.lang = 'vi';
    expect(errorText(new ApiError(502, 'Bad gateway'))).toBe(
      'Máy chủ gặp sự cố. Hãy thử lại sau ít phút.',
    );
    expect(errorText(new ApiError(400, 'Invalid input'))).toBe('Invalid input');
  });
});
