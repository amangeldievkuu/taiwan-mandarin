import { describe, expect, it } from 'vitest';
import { longestMatchAt, segment, type Lexicon } from './segment.ts';

const words = new Set([
  '我',
  '喜歡',
  '喝',
  '珍珠奶茶',
  '珍珠',
  '奶茶',
  '臺北',
  '捷運',
  '很',
  '方便',
  '研究',
  '研究生',
  '生命',
  '的',
  '起源',
]);
const lexicon: Lexicon = { has: (w) => words.has(w), maxLength: 4 };
const texts = (text: string) => segment(text, lexicon).map((t) => t.text);

describe('segment', () => {
  it('prefers the split with the fewest words', () => {
    expect(texts('我喜歡喝珍珠奶茶')).toEqual(['我', '喜歡', '喝', '珍珠奶茶']);
    expect(texts('研究生命的起源')).toEqual(['研究', '生命', '的', '起源']);
  });

  it('keeps punctuation and Latin runs whole, with offsets', () => {
    const tokens = segment('臺北捷運，很方便! OK', lexicon);
    expect(tokens.map((t) => [t.text, t.han, t.start])).toEqual([
      ['臺北', true, 0],
      ['捷運', true, 2],
      ['，', false, 4],
      ['很', true, 5],
      ['方便', true, 6],
      ['! OK', false, 8],
    ]);
  });

  it('splits into single characters while the lexicon is empty', () => {
    expect(segment('你好嗎', { has: () => false, maxLength: 0 }).map((t) => t.text)).toEqual([
      '你',
      '好',
      '嗎',
    ]);
  });

  it('marks unknown characters', () => {
    const [token] = segment('鼎', lexicon);
    expect(token).toMatchObject({ text: '鼎', han: true, known: false });
  });

  it('breaks ties by weight', () => {
    const tie = new Set(['甲乙', '乙丙', '甲', '丙']);
    const weighted: Lexicon = {
      has: (w) => tie.has(w),
      maxLength: 2,
      weight: (w) => (w === '乙丙' ? 5 : 1),
    };
    // 甲乙|丙 and 甲|乙丙 both have two words; 乙丙 weighs more.
    expect(segment('甲乙丙', weighted).map((t) => t.text)).toEqual(['甲', '乙丙']);
  });
});

describe('longestMatchAt', () => {
  it('finds the longest word starting at a position', () => {
    expect(longestMatchAt('我喜歡喝珍珠奶茶', 4, lexicon)).toBe('珍珠奶茶');
    expect(longestMatchAt('我喜歡喝珍珠奶茶', 1, lexicon)).toBe('喜歡');
  });

  it('falls back to the single character', () => {
    expect(longestMatchAt('鼎泰豐', 0, lexicon)).toBe('鼎');
  });
});
