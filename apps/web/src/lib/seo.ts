// What search engines and link previews see: page titles, descriptions, structured data and the
// sitemap. Shared by the app (document.title as the learner moves around) and the build's
// prerender (scripts/prerender.ts), which writes a static page for every word, level and reader.
// Pure functions only, so both can use them.

import {
  LEVELS,
  pinyinWord,
  zhuyinString,
  type Level,
  type LevelInfo,
  type Reader,
  type Word,
} from '@taiwan-mandarin/shared';

export const SITE_NAME = '臺灣華語';

export const DEFAULT_TITLE = `${SITE_NAME} – Learn Taiwan Mandarin with TOCFL, Zhuyin and Traditional Chinese`;

export const DEFAULT_DESCRIPTION =
  'Learn Taiwan Mandarin for free: every TOCFL word from Novice 1 to Level 6 in Traditional ' +
  'characters with Zhuyin and Taiwan readings, spaced repetition, a built-in dictionary and graded ' +
  'reading. Works offline.';

/**
 * Pages that belong to one learner (their reviews, chats, account): kept out of search results.
 * Today is not here: "/" is the home page, and a first visit there shows the welcome page.
 */
export const NOINDEX_ROUTES: ReadonlySet<string> = new Set([
  'study',
  'talk',
  'me',
  'me-account',
  'me-settings',
  'me-garden',
  'me-ink',
  'me-levels',
  'me-about',
]);

export const pageTitle = (text: string): string => `${text} · ${SITE_NAME}`;

export const levelInfo = (level: Level): LevelInfo =>
  LEVELS.find((l) => l.id === level) ?? { id: level, zh: level, en: level, cefr: '' };

export const wordPath = (id: string): string => `/word/${encodeURIComponent(id)}`;
export const levelPath = (level: Level): string => `/path/${level}`;
export const readerPath = (id: string): string => `/read/${encodeURIComponent(id)}`;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);

/** JSON for a <script type="application/ld+json">: nothing in it can close the script early. */
export const jsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** At most `max` characters, cut at a word break and marked with an ellipsis. */
export function clip(text: string, max: number): string {
  const chars = [...text];
  if (chars.length <= max) return text;
  const cut = chars.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

/** The first sense of a gloss: "to pay back; to return" → "to pay back". */
export const firstSense = (gloss: string): string => gloss.split(/;\s*/)[0]?.trim() ?? gloss;

/** "huán" and "ㄏㄨㄢˊ" for a word. */
export const readings = (word: Pick<Word, 'pinyin'>): { pinyin: string; zhuyin: string } => ({
  pinyin: pinyinWord(word.pinyin),
  zhuyin: zhuyinString(word.pinyin),
});

/** "還 huán ㄏㄨㄢˊ – to pay back · 臺灣華語" */
export function wordTitle(word: Word): string {
  const { pinyin, zhuyin } = readings(word);
  const gloss = word.en ? ` – ${clip(firstSense(word.en), 40)}` : '';
  return pageTitle(`${word.hanzi} ${pinyin} ${zhuyin}${gloss}`);
}

export function wordDescription(word: Word): string {
  const { pinyin, zhuyin } = readings(word);
  const level = levelInfo(word.level);
  const meaning = word.en ? ` means “${clip(word.en, 70)}”` : '';
  const example = word.examples?.[0];
  const tail = example ? ` Example: ${example.zh} ${example.en}` : '';
  return clip(
    `${word.hanzi} (${pinyin}, ${zhuyin})${meaning}. A TOCFL ${level.en} (${level.cefr}) word in ` +
      `Traditional Chinese with Taiwan pronunciation and Zhuyin.${tail}`,
    160,
  );
}

export function levelTitle(level: Level): string {
  const info = levelInfo(level);
  return pageTitle(`TOCFL ${info.en} ${info.zh} (${info.cefr}) word list`);
}

export function levelDescription(level: Level, count: number): string {
  const info = levelInfo(level);
  return (
    `All ${count.toLocaleString('en')} words of TOCFL ${info.en} (${info.zh}, CEFR ${info.cefr}) ` +
    'in Traditional characters, with pinyin, Zhuyin, Taiwan readings and meanings.'
  );
}

export const readerTitle = (reader: Reader): string =>
  pageTitle(
    `${reader.title} (${reader.titleEn}) – graded reader, TOCFL ${levelInfo(reader.level).en}`,
  );

export const readerDescription = (reader: Reader): string =>
  clip(
    `${reader.summary} A short Traditional Chinese text for TOCFL ${levelInfo(reader.level).en} ` +
      `learners, with pinyin, Zhuyin and an English translation.`,
    160,
  );

/** An absolute URL on the site, or null when the build doesn't know the site's address. */
export const absolute = (site: string | undefined, path: string): string | null =>
  site ? site.replace(/\/+$/, '') + path : null;

export function sitemap(site: string, paths: readonly string[]): string {
  const urls = paths
    .map((path) => `  <url><loc>${escapeHtml(site.replace(/\/+$/, '') + path)}</loc></url>`)
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n</urlset>\n`
  );
}

export function robots(site: string | undefined): string {
  const map = site ? `\nSitemap: ${absolute(site, '/sitemap.xml')}\n` : '';
  return `User-agent: *\nDisallow: /api/\n${map}`;
}
