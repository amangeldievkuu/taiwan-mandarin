import { describe, expect, it } from 'vitest';
import { TOPICS, VOCAB } from '../content/vocab.ts';
import { checkReading, checkText, checkVocab, formatIssues } from './index.ts';

const issues = (text: string, mainland = false) =>
  checkText({ text, where: 'test', mainland }).map((i) => i.problem);

describe('checkText', () => {
  it('accepts Taiwan-standard Traditional text', () => {
    expect(issues('捷運')).toEqual([]);
    expect(issues('Шаардык автобус. 悠遊卡 же накталай акча менен төлөйсүң.')).toEqual([]);
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
    expect(checkText({ text: '台 (台灣)', where: 'vocab:tai-wan.tw.en' })).toEqual([]);
  });
});

describe('checkReading', () => {
  it('rejects Mainland readings', () => {
    expect(checkReading({ id: 'x', hanzi: '垃圾', pinyin: 'la1 ji1' })).toHaveLength(2);
    expect(checkReading({ id: 'x', hanzi: '星期', pinyin: 'xing1 qi1' })).toHaveLength(1);
  });

  it('accepts Taiwan readings', () => {
    expect(checkReading({ id: 'x', hanzi: '垃圾', pinyin: 'le4 se4' })).toEqual([]);
    expect(checkReading({ id: 'x', hanzi: '星期', pinyin: 'xing1 qi2' })).toEqual([]);
  });
});

describe('vocabulary', () => {
  it('is entirely Taiwan standard', () => {
    const found = checkVocab(VOCAB, TOPICS);
    expect(found, formatIssues(found)).toEqual([]);
  });
});
