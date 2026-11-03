import type { Reader, Word } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import {
  absolute,
  clip,
  escapeHtml,
  jsonLd,
  NOINDEX_ROUTES,
  readerTitle,
  robots,
  sitemap,
  wordDescription,
  wordPath,
  wordTitle,
} from './seo';

const word: Word = {
  id: '還~huan2',
  hanzi: '還',
  pinyin: 'huan2',
  en: 'to pay back; to return',
  level: 'L1',
  src: 'tocfl',
  rank: 0,
  topic: 'education',
  glossSource: 'cedict',
  examples: [{ zh: '我明天還你錢。', pinyin: '', en: "I'll pay you back tomorrow.", source: 'ai' }],
};

describe('seo', () => {
  it('titles a word with its readings and first sense', () => {
    expect(wordTitle(word)).toBe('還 huán ㄏㄨㄢˊ – to pay back · 臺灣華語');
  });

  it('describes a word within 160 characters', () => {
    const description = wordDescription(word);
    expect(description).toContain('TOCFL Level 1 (A1)');
    expect(description).toContain('我明天還你錢。');
    expect([...description].length).toBeLessThanOrEqual(160);
  });

  it('titles a reader in both languages', () => {
    const reader = { title: '我的朋友', titleEn: 'My friend', level: 'N1' } as Reader;
    expect(readerTitle(reader)).toBe(
      '我的朋友 (My friend) – graded reader, TOCFL Novice 1 · 臺灣華語',
    );
  });

  it('clips at a word break', () => {
    expect(clip('short', 10)).toBe('short');
    expect(clip('one two three four five', 16)).toBe('one two three…');
  });

  it('escapes HTML and keeps JSON-LD inside its script', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    const data = { name: '</script><script>alert(1)</script>' };
    const out = jsonLd(data);
    expect(out).not.toContain('</script>');
    expect(JSON.parse(out)).toEqual(data);
  });

  it('builds absolute URLs and a sitemap with encoded word paths', () => {
    expect(absolute(undefined, '/x')).toBeNull();
    expect(absolute('https://example.tw/', '/x')).toBe('https://example.tw/x');
    const xml = sitemap('https://example.tw', ['/welcome', wordPath('還~huan2')]);
    expect(xml).toContain('<loc>https://example.tw/word/%E9%82%84~huan2</loc>');
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });

  it('points robots.txt to the sitemap only when the site is known', () => {
    expect(robots(undefined)).not.toContain('Sitemap');
    expect(robots('https://example.tw')).toContain('Sitemap: https://example.tw/sitemap.xml');
  });

  it('keeps personal pages, not public ones, out of search', () => {
    expect(NOINDEX_ROUTES.has('study')).toBe(true);
    expect(NOINDEX_ROUTES.has('me-settings')).toBe(true);
    for (const name of ['today', 'welcome', 'word', 'level', 'reader', 'read', 'path', 'dict']) {
      expect(NOINDEX_ROUTES.has(name)).toBe(false);
    }
  });
});
