import { describe, expect, it } from 'vitest';
import { splitSyllables, toZhuyin } from '../phonetics.ts';
import { TOPICS, VOCAB } from './vocab.ts';

describe('vocab', () => {
  it('has unique ids', () => {
    const ids = VOCAB.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(VOCAB.map((w) => [w.hanzi, w] as const))('%s is well formed', (_, word) => {
    expect(splitSyllables(word.pinyin)).toHaveLength([...word.hanzi].length);
    expect(() => toZhuyin(word.pinyin)).not.toThrow();
    expect(TOPICS.some((t) => t.id === word.topic)).toBe(true);
    expect(word.en.trim()).not.toBe('');
    expect(word.ky.trim()).not.toBe('');
  });

  it('uses Taiwan readings', () => {
    const pinyin = (hanzi: string) => VOCAB.find((w) => w.hanzi === hanzi)?.pinyin;
    expect(pinyin('垃圾')).toBe('le4 se4');
    expect(pinyin('星期')).toBe('xing1 qi2');
    expect(pinyin('誰')).toBe('shei2');
  });

  it('covers every topic', () => {
    for (const topic of TOPICS) expect(VOCAB.some((w) => w.topic === topic.id)).toBe(true);
  });
});
