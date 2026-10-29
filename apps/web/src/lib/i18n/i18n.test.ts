import { describe, expect, it } from 'vitest';
import { en } from './en';
import { formatInterval, locale } from './index.svelte';
import { vi } from './vi';

/** Every key path of a catalog, with "()" for functions and "[n]" for lists. */
function shape(value: unknown, path = ''): string[] {
  if (typeof value === 'function') return [`${path}()`];
  if (Array.isArray(value)) return [`${path}[${value.length}]`];
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [path];
}

/** Every string of a catalog, with functions called on sample arguments. */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'function') {
    const args = Array.from({ length: 4 }, () => 2);
    return strings((value as (...a: unknown[]) => unknown)(...args), `${path}()`);
  }
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

describe('catalogs', () => {
  it('have the same keys and lists in every language', () => {
    expect(shape(vi)).toEqual(shape(en));
  });

  it('have no empty strings', () => {
    for (const catalog of [en, vi])
      for (const [path, text] of strings(catalog)) expect(text.trim(), path).not.toBe('');
  });

  it('are translated', () => {
    // Words that are the same in both languages.
    const same = new Set(['haha', '10,000 XP', 'XP', 'TOCFL', 'MRT', 'Email', 'OK']);
    const english = new Map(strings(en));
    const untranslated = strings(vi)
      .filter(([path, text]) => english.get(path) === text && !same.has(text))
      .map(([path]) => path);
    expect(untranslated).toEqual([]);
  });
});

describe('formatInterval', () => {
  it.each([
    [30_000, '<1m', '<1 ph'],
    [10 * 60_000, '10m', '10 ph'],
    [3 * 3_600_000, '3h', '3 giờ'],
    [86_400_000, '1d', '1 ngày'],
    [4 * 86_400_000, '4d', '4 ngày'],
    [62 * 86_400_000, '2mo', '2 th'],
    [548 * 86_400_000, '1.5y', '1,5 năm'],
    [59.6 * 60_000, '1h', '1 giờ'],
    [23.6 * 3_600_000, '1d', '1 ngày'],
    [29.7 * 86_400_000, '1mo', '1 th'],
  ])('%d ms → %s / %s', (ms, english, vietnamese) => {
    locale.lang = 'en';
    expect(formatInterval(ms)).toBe(english);
    locale.lang = 'vi';
    expect(formatInterval(ms)).toBe(vietnamese);
    locale.lang = 'en';
  });
});
