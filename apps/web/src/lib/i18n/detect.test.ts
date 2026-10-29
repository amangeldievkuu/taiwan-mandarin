import { describe, expect, it } from 'vitest';
import { detectLanguage } from './detect';

describe('detectLanguage', () => {
  it.each([
    [['vi-VN', 'en'], 'vi'],
    [['vi'], 'vi'],
    [['en-US', 'vi'], 'en'],
    [['fr-FR', 'vi-VN'], 'vi'],
    [['zh-TW', 'ja'], 'en'],
    [[], 'en'],
  ])('%j → %s', (preferred, lang) => expect(detectLanguage(preferred)).toBe(lang));
});
