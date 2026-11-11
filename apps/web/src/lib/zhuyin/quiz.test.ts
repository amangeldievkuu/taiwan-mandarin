import { zhuyinLesson, zhuyinString, type Level, type Word } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { buildQuiz, examplesFor, seeded, TONE_MARKS, type Question } from './quiz';

const word = (hanzi: string, pinyin: string, over: Partial<Word> = {}): Word =>
  ({
    id: hanzi,
    hanzi,
    pinyin,
    en: '',
    level: 'N1' as Level,
    src: 'tocfl',
    rank: 1,
    topic: 'daily',
    glossSource: 'cedict',
    ...over,
  }) as Word;

const WORDS: Word[] = [
  word('爸爸', 'ba4 ba5', { rank: 2 }),
  word('不', 'bu4', { rank: 1 }),
  word('朋友', 'peng2 you5', { rank: 3 }),
  word('媽媽', 'ma1 ma5', { rank: 4 }),
  word('飯', 'fan4', { rank: 5 }),
  word('白天', 'bai2 tian1', { level: 'N2', rank: 1 }),
  word('長~zhang3', 'zhang3', { hanzi: '長' }),
  word('T恤', 'T xu4'),
  word('筆', 'bi3', { readingUnverified: true }),
  word('謝謝', 'xie4 xie5'),
  word('學生', 'xue2 sheng1'),
  word('今天', 'jin1 tian1'),
  word('知道', 'zhi1 dao4'),
  word('字典', 'zi4 dian3'),
  word('先生', 'xian1 sheng1'),
];

function expectFair(question: Question) {
  expect(question.options).toContain(question.answer);
  expect(new Set(question.options).size).toBe(question.options.length);
  expect(question.options.length).toBeGreaterThan(1);
}

describe('example words for a letter', () => {
  it('has the letter, is short and common first, and has one checked reading', () => {
    const examples = examplesFor('ㄅ', WORDS);
    expect(examples.map((w) => w.hanzi)).toEqual(['不', '爸爸', '白天']);
    for (const w of examples) expect(zhuyinString(w.pinyin)).toContain('ㄅ');
  });

  it('leaves out words a voice could read another way, or not in characters only', () => {
    const all = examplesFor('ㄓ', WORDS, 10).map((w) => w.id);
    expect(all).toEqual(['知道']);
    expect(examplesFor('ㄒ', [word('T恤', 'T xu4')])).toEqual([]);
  });
});

describe('a lesson’s practice', () => {
  const lips = zhuyinLesson('lips');
  if (!lips) throw new Error('no lips lesson');

  it('asks every letter by its sound, with fair options, and how a word with it is written', () => {
    const quiz = buildQuiz(lips, WORDS, seeded(7));
    quiz.forEach(expectFair);
    const heard = quiz.flatMap((q) => (q.kind === 'letter' ? [q.answer] : []));
    expect(heard.sort()).toEqual(['ㄅ', 'ㄆ', 'ㄇ', 'ㄈ'].sort());
    const words = quiz.filter((q) => q.kind === 'word');
    expect(words.length).toBeGreaterThan(0);
    for (const q of words) {
      // A wrong option is the same word with another of the lesson's letters.
      for (const option of q.options.filter((o) => o !== q.answer)) {
        expect(option).toHaveLength(q.answer.length);
      }
    }
    expect(quiz.filter((q) => q.kind === 'pinyin')).toHaveLength(2);
  });

  it('is the same quiz for the same seed', () => {
    expect(buildQuiz(lips, WORDS, seeded(3))).toEqual(buildQuiz(lips, WORDS, seeded(3)));
  });

  it('asks the tone of syllables from the four-tone sets', () => {
    const tones = zhuyinLesson('tones');
    if (!tones) throw new Error('no tones lesson');
    const quiz = buildQuiz(tones, WORDS, seeded(1));
    expect(quiz).toHaveLength(8);
    for (const q of quiz) {
      expectFair(q);
      expect(TONE_MARKS).toContain(q.answer);
    }
    const ma = quiz.find((q) => q.kind === 'tone' && q.char === '馬');
    if (ma) expect(ma.answer).toBe('ˇ');
  });

  it('reads two-character words against letters that sound alike and other tones', () => {
    const words = zhuyinLesson('words');
    if (!words) throw new Error('no words lesson');
    const quiz = buildQuiz(words, WORDS, seeded(5));
    expect(quiz.length).toBeGreaterThan(3);
    quiz.forEach(expectFair);
    const study = quiz.find((q) => q.kind === 'word' && q.word.hanzi === '字典');
    if (study) expect(study.options).toContain('ㄓˋ ㄉㄧㄢˇ');
  });
});
