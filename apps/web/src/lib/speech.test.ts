import { describe, expect, it } from 'vitest';
import { hasTaiwanVoice } from './speech';

const voices = (...langs: string[]) => langs.map((lang) => ({ lang }));

describe('hasTaiwanVoice', () => {
  it('finds a Taiwan voice, however the browser writes it', () => {
    expect(hasTaiwanVoice(voices('en-US', 'zh-TW'))).toBe(true);
    expect(hasTaiwanVoice(voices('zh_TW'))).toBe(true);
    expect(hasTaiwanVoice(voices('zh-Hant-TW'))).toBe(true);
  });

  it("doesn't count other Chinese voices", () => {
    expect(hasTaiwanVoice(voices('zh-CN', 'zh-HK', 'en-US'))).toBe(false);
  });

  it("doesn't know until the device has listed its voices", () => {
    expect(hasTaiwanVoice([])).toBeNull();
  });
});
