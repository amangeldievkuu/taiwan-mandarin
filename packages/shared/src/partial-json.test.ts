import { describe, expect, it } from 'vitest';
import { parsePartialJson } from './partial-json.ts';

describe('parsePartialJson', () => {
  it.each([
    ['', undefined],
    ['{', {}],
    ['{"tr', {}],
    ['{"a":', {}],
    ['{"a":"Keep tr', { a: 'Keep tr' }],
    ['{"a":"x\\', { a: 'x' }],
    ['{"a":"\\u4f', { a: '' }],
    ['{"a":"\\u4f60', { a: '你' }],
    ['{"a":"line\\nbreak"', { a: 'line\nbreak' }],
    ['{"a":null,"b":nu', { a: null }],
    ['{"a":[1,2', { a: [1] }],
    ['{"a":[1,2]', { a: [1, 2] }],
    ['{"a":true,"b":[]', { a: true, b: [] }],
  ])('%j → %j', (input, expected) => {
    expect(parsePartialJson(input)).toEqual(expected);
  });

  it('keeps the element being written last, so callers can tell it may change', () => {
    expect(parsePartialJson('{"tokens":[{"text":"垃圾","pinyin":"le4 se4"},{"text":"不')).toEqual({
      tokens: [{ text: '垃圾', pinyin: 'le4 se4' }, { text: '不' }],
    });
  });

  it('reads complete JSON like JSON.parse', () => {
    const json = JSON.stringify({ a: [1, 2.5, -3e2, 'x"y'], b: { c: null, d: false } });
    expect(parsePartialJson(json)).toEqual(JSON.parse(json));
  });
});
