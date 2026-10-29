import { describe, expect, it } from 'vitest';
import { foldLatin, isLang, looksVietnamese } from './lang.ts';

describe('foldLatin', () => {
  it.each([
    ['Học sinh', 'hoc sinh'],
    ['Bạn bè', 'ban be'],
    ['đi', 'di'],
    ['ĐÀI LOAN', 'dai loan'],
    ['nǚ', 'nu'],
    ['xiè xie', 'xie xie'],
    ['Ёлка', 'елка'],
    ['мой', 'мой'],
    ['ЧАЙ', 'чай'],
  ])('%s → %s', (text, folded) => expect(foldLatin(text)).toBe(folded));
});

describe('looksVietnamese', () => {
  it.each(['ăn', 'đi', 'Đài', 'bạn', 'học', 'người', 'mỹ', 'phở', 'cũng'])('%s: yes', (text) =>
    expect(looksVietnamese(text)).toBe(true),
  );
  it.each(['ban', 'nǚ', 'mā', 'xiè', 'jie yun', 'lüè', 'cafe'])('%s: no', (text) =>
    expect(looksVietnamese(text)).toBe(false),
  );
});

describe('isLang', () => {
  it('accepts the app languages only', () => {
    expect(isLang('vi')).toBe(true);
    expect(isLang('en')).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});
