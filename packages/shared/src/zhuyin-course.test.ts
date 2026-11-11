import { describe, expect, it } from 'vitest';
import { toZhuyin, ZHUYIN_PINYIN } from './phonetics.ts';
import {
  nextZhuyinLesson,
  TONE_DEMO,
  TONE_SETS,
  ZHUYIN_LESSON_IDS,
  ZHUYIN_LESSONS,
  zhuyinLesson,
} from './zhuyin-course.ts';

describe('the Zhuyin course', () => {
  const letters = ZHUYIN_LESSONS.flatMap((l) => l.letters);

  it('teaches all 37 letters once each, in the order schools teach them', () => {
    expect(letters.map((l) => l.letter)).toEqual(Object.keys(ZHUYIN_PINYIN));
  });

  it.each(letters.map((l) => [l.letter, l.sound.char, l.sound.pinyin]))(
    'hears %s in %s (%s), a syllable with that letter',
    (letter, _, pinyin) => {
      const [syllable, ...more] = toZhuyin(pinyin);
      expect(more).toEqual([]);
      expect(syllable?.body).toContain(letter);
    },
  );

  it('names each sound character once, so no two letters sound alike', () => {
    const chars = letters.map((l) => l.sound.char);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it('has its lessons in order, and knows which comes next', () => {
    expect(ZHUYIN_LESSONS.map((l) => l.id)).toEqual([...ZHUYIN_LESSON_IDS]);
    expect(zhuyinLesson('tones')?.zh).toBe('聲調');
    expect(nextZhuyinLesson('lips')?.id).toBe('tip');
    expect(nextZhuyinLesson('words')).toBeUndefined();
  });

  it('shows each tone on ma, and hears four tones on each set', () => {
    expect(TONE_DEMO.map((t) => toZhuyin(t.pinyin)[0]?.tone || 'ˉ')).toEqual(
      TONE_DEMO.map((t) => t.mark),
    );
    for (const set of TONE_SETS) {
      expect(set.map((s) => s.pinyin.at(-1))).toEqual(['1', '2', '3', '4']);
    }
  });
});
