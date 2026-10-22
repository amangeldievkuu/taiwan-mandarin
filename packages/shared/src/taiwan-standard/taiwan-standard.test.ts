import { describe, expect, it } from 'vitest';
import { CURATED } from '../content/curated.ts';
import { TOPICS } from '../content/topics.ts';
import type { Word } from '../content/types.ts';
import { checkReading, checkText, checkVocab, formatIssues } from './index.ts';

const issues = (text: string, mainland = false) =>
  checkText({ text, where: 'test', mainland }).map((i) => i.problem);

describe('checkText', () => {
  it('accepts Taiwan-standard Traditional text', () => {
    expect(issues('捷運')).toEqual([]);
    expect(issues('City buses. Pay with 悠遊卡 or cash.')).toEqual([]);
    expect(issues('no Chinese at all')).toEqual([]);
  });

  it('rejects Simplified characters', () => {
    expect(issues('台湾')).toHaveLength(1);
    expect(issues('地铁', true)).toHaveLength(1); // even in a Mainland note
  });

  it('rejects variant forms that are not Taiwan standard', () => {
    expect(issues('裏')).toHaveLength(1);
    expect(issues('爲')).toHaveLength(1);
  });

  it('rejects Mainland phrasing that OpenCC knows', () => {
    expect(issues('網絡')[0]).toMatch(/網路/);
    expect(issues('視頻')[0]).toMatch(/影片/);
  });

  it('rejects Mainland words OpenCC misses, via the denylist', () => {
    expect(issues('坐地鐵')).toEqual(['Mainland word 地鐵; Taiwan uses 捷運']);
    expect(issues('空調')).toHaveLength(1);
  });

  it('allows Mainland words only in a labeled Mainland note', () => {
    expect(issues('地鐵', true)).toEqual([]);
  });

  it('flags 台 unless the location is allowlisted', () => {
    expect(issues('台灣')).toHaveLength(1);
    expect(checkText({ text: '台 (台灣)', where: 'vocab:臺灣.tw' })).toEqual([]);
  });

  it('catches Simplified 准 and 斗, but not the words Taiwan writes with them', () => {
    expect(issues('標准')).toHaveLength(1);
    expect(issues('戰斗')).toHaveLength(1);
    expect(issues('這裡不准停車。')).toEqual([]);
    expect(issues('他斗膽問了一句。')).toEqual([]);
  });

  it('shows allowlisted words as written in the expected text', () => {
    const [issue] = checkText({ text: '支持标准', where: 'test' });
    expect(issue?.problem).toBe('not Taiwan standard, expected "支持標準"');
  });

  it('ignores everyday words OpenCC turns into software terms', () => {
    expect(issues('我有一個好消息！')).toEqual([]);
    expect(issues('請打開窗戶。')).toEqual([]);
    expect(issues('這是一家高級餐廳。')).toEqual([]);
    expect(issues('請多加注意。')).toEqual([]);
  });
});

describe('checkReading', () => {
  it('rejects Mainland readings and names the Taiwan one', () => {
    expect(checkReading({ id: 'x', hanzi: '垃圾', pinyin: 'la1 ji1' })).toHaveLength(2);
    expect(checkReading({ id: 'x', hanzi: '星期', pinyin: 'xing1 qi1' })[0]?.problem).toMatch(
      /qi2/,
    );
    expect(checkReading({ id: 'x', hanzi: '星期', pinyin: 'xing1 qi1' })).toHaveLength(1);
  });

  it('accepts Taiwan readings', () => {
    expect(checkReading({ id: 'x', hanzi: '垃圾', pinyin: 'le4 se4' })).toEqual([]);
    expect(checkReading({ id: 'x', hanzi: '星期', pinyin: 'xing1 qi2' })).toEqual([]);
  });
});

describe('curated starter words', () => {
  it('are entirely Taiwan standard', () => {
    const words: Word[] = CURATED.map((c) => ({
      ...c,
      id: c.hanzi,
      level: c.level ?? 'N1',
      src: 'curated',
      rank: 0,
      topic: 'core',
      glossSource: 'curated',
    }));
    const found = checkVocab(words, TOPICS);
    expect(found, formatIssues(found)).toEqual([]);
  });
});
