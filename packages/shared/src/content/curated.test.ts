import { describe, expect, it } from 'vitest';
import { splitSyllables, toZhuyin } from '../phonetics.ts';
import { twKey } from './types.ts';
import { CURATED, TRANSLATIONS } from './curated.ts';
import type { ForeignLang } from '../lang.ts';

describe('curated starter words', () => {
  it('have unique legacy ids and headwords', () => {
    expect(new Set(CURATED.map((w) => w.legacyId)).size).toBe(CURATED.length);
    expect(new Set(CURATED.map((w) => w.hanzi)).size).toBe(CURATED.length);
  });

  it.each(CURATED.map((w) => [w.hanzi, w] as const))('%s is well formed', (_, word) => {
    expect(splitSyllables(word.pinyin)).toHaveLength([...word.hanzi].length);
    expect(() => toZhuyin(word.pinyin)).not.toThrow();
    expect(word.en.trim()).not.toBe('');
  });

  it.each(Object.keys(TRANSLATIONS) as ForeignLang[])(
    'have %s for every meaning and Taiwan note',
    (lang) => {
      for (const word of CURATED) {
        expect(word[lang]?.trim(), `${word.hanzi} ${lang}`).toBeTruthy();
        expect(Boolean(word[twKey(lang)]), `${word.hanzi} ${twKey(lang)}`).toBe(Boolean(word.tw));
      }
    },
  );

  it('use Taiwan readings', () => {
    const pinyin = (hanzi: string) => CURATED.find((w) => w.hanzi === hanzi)?.pinyin;
    expect(pinyin('垃圾')).toBe('le4 se4');
    expect(pinyin('星期')).toBe('xing1 qi2');
    expect(pinyin('誰')).toBe('shei2');
  });
});
