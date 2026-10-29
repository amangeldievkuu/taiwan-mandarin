import { describe, expect, it } from 'vitest';
import type { Lang } from '@taiwan-mandarin/shared';
import { en, type Messages } from './en';
import { formatInterval, locale } from './index.svelte';
import { plural } from './plural';
import { vi } from './vi';

/** Every catalog but the English one it follows. */
const OTHERS: [Lang, Messages][] = [['vi', vi]];

/** Every key path of a catalog, with "()" for functions and "[n]" for lists. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}()`];
  if (Array.isArray(value)) return [`${path}[${value.length}]`];
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

/**
 * Every string of a catalog, with functions called on sample numbers: 1, 2 and 5 take each plural
 * form (Russian 1 слово, 2 слова, 5 слов).
 */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    return [1, 2, 5].flatMap((n) => {
      const args = Array.from({ length: 4 }, () => n);
      return strings((value as (...a: unknown[]) => unknown)(...args), `${path}(${n})`);
    });
  }
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

describe('catalogs', () => {
  it.each(OTHERS)('have the same keys and lists in %s', (_, catalog) => {
    expect(shape(catalog)).toEqual(shape(en));
  });

  it.each([['en', en] as [Lang, Messages], ...OTHERS])(
    'have no empty strings in %s',
    (_, catalog) => {
      for (const [path, text] of strings(catalog)) expect(text.trim(), path).not.toBe('');
    },
  );

  it.each(OTHERS)('are translated into %s', (_, catalog) => {
    // Words that are the same in both languages.
    const same = new Set(['haha', 'XP', 'TOCFL', 'MRT', 'Email', 'OK', 'Space']);
    const english = new Map(strings(en));
    // Numbers and those words alone ("2 TOCFL") need no translation.
    const wordsIn = (text: string) =>
      text.split(/[\s\d.,/·+%✦–-]+/).filter((w) => w && !same.has(w));
    const untranslated = strings(catalog)
      .filter(([path, text]) => english.get(path) === text && wordsIn(text).length > 0)
      .map(([path]) => path);
    expect(untranslated).toEqual([]);
  });
});

describe('formatInterval', () => {
  it.each<[number, Record<Lang, string>]>([
    [30_000, { en: '<1m', vi: '<1 ph' }],
    [10 * 60_000, { en: '10m', vi: '10 ph' }],
    [3 * 3_600_000, { en: '3h', vi: '3 giờ' }],
    [86_400_000, { en: '1d', vi: '1 ngày' }],
    [4 * 86_400_000, { en: '4d', vi: '4 ngày' }],
    [62 * 86_400_000, { en: '2mo', vi: '2 th' }],
    [548 * 86_400_000, { en: '1.5y', vi: '1,5 năm' }],
    [59.6 * 60_000, { en: '1h', vi: '1 giờ' }],
    [23.6 * 3_600_000, { en: '1d', vi: '1 ngày' }],
    [29.7 * 86_400_000, { en: '1mo', vi: '1 th' }],
  ])('%d ms → %o', (ms, expected) => {
    for (const [lang, text] of Object.entries(expected)) {
      locale.lang = lang as Lang;
      expect(formatInterval(ms), lang).toBe(text);
    }
    locale.lang = 'en';
  });
});

describe('plural', () => {
  const forms = { one: 'слово', few: 'слова', many: 'слов', other: 'слова' };
  it.each([
    [1, 'слово'],
    [2, 'слова'],
    [5, 'слов'],
    [11, 'слов'],
    [21, 'слово'],
    [1.5, 'слова'],
  ])('ru %d → %s', (n, form) => expect(plural('ru' as Lang, n, forms)).toBe(form));

  it('falls back to "other"', () => {
    expect(plural('en', 1, { one: 'word', other: 'words' })).toBe('word');
    expect(plural('en', 5, { one: 'word', other: 'words' })).toBe('words');
    expect(plural('vi', 1, { other: 'từ' })).toBe('từ');
  });
});
