import { LANG_IDS } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { reminderText } from './messages.js';

describe('reminder messages', () => {
  it('counts words in each language', () => {
    const days = ['2026-10-30', '2026-10-31', '2026-11-01'] as const;
    expect(days.map((d) => reminderText('en', 1, d).body).join()).not.toMatch(/1 words/);
    expect(
      days.map((d) => reminderText('en', 12, d).body).every((b) => b.includes('12 words')),
    ).toBe(true);
    expect(reminderText('ru', 1, days[0]).body).toContain('1 слово');
    expect(reminderText('ru', 3, days[0]).body).toContain('3 слова');
    expect(reminderText('ru', 12, days[0]).body).toContain('12 слов');
    expect(reminderText('vi', 7, days[0]).body).toContain('7 từ');
  });

  it('takes a different line each day, and has one for nothing due', () => {
    for (const lang of LANG_IDS) {
      const a = reminderText(lang, 0, '2026-10-30');
      const b = reminderText(lang, 0, '2026-10-31');
      expect(a.title).toContain('墨');
      expect(a.body).not.toBe(b.body);
      expect(a.body).not.toMatch(/\d/);
    }
  });
});
