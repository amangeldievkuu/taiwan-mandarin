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
    // A number cut off in its fraction or exponent isn't finished yet.
    ['{"a":1,"b":12.', { a: 1 }],
    ['{"a":[1e', { a: [] }],
    ['{"a":12.5,', { a: 12.5 }],
  ])('%j → %j', (input, expected) => {
    expect(parsePartialJson(input)).toEqual(expected);
  });

  it('keeps the element being written last, so callers can tell it may change', () => {
    expect(parsePartialJson('{"tokens":[{"text":"垃圾","pinyin":"le4 se4"},{"text":"不')).toEqual({
      tokens: [{ text: '垃圾', pinyin: 'le4 se4' }, { text: '不' }],
    });
  });

  it('keeps "__proto__" as an ordinary key, like JSON.parse', () => {
    const value = parsePartialJson('{"__proto__":{"x":1}}') as Record<string, unknown>;
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    expect(Object.keys(value)).toEqual(['__proto__']);
    expect((value as { x?: number }).x).toBeUndefined();
  });

  it('reads complete JSON like JSON.parse', () => {
    const json = JSON.stringify({ a: [1, 2.5, -3e2, 'x"y'], b: { c: null, d: false } });
    expect(parsePartialJson(json)).toEqual(JSON.parse(json));
  });
});
