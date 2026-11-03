// Writes a static page into dist/ for every public page with content of its own: the welcome
// page, the TOCFL path and each level's word list, every word, and the graded readers. Each one
// has its own title, description, canonical link, Open Graph tags and structured data, and the
// page's text inside #app, so search engines and link previews see it without running the app.
// The app replaces that markup when it starts (src/main.ts). Also writes sitemap.xml and
// robots.txt. Runs after `vite build`; absolute URLs come from SITE_URL (left out when unset).
// Run with: node --conditions=source scripts/prerender.ts

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  LEVELS,
  type ContentManifest,
  type Level,
  type Reader,
  type Word,
} from '@taiwan-mandarin/shared';
import {
  absolute,
  clip,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  escapeHtml as h,
  jsonLd,
  levelDescription,
  levelInfo,
  levelPath,
  levelTitle,
  pageTitle,
  readerDescription,
  readerPath,
  readerTitle,
  readings,
  robots,
  sitemap,
  SITE_NAME,
  wordDescription,
  wordPath,
  wordTitle,
} from '../src/lib/seo.ts';

const dist = join(import.meta.dirname, '..', 'dist');
const site = process.env['SITE_URL']?.trim() || undefined;
if (site && !/^https?:\/\/[^/]+/.test(site)) throw new Error(`SITE_URL is not a URL: ${site}`);

const template = readFileSync(join(dist, 'index.html'), 'utf8');
if (!template.includes('<div id="app"></div>')) throw new Error('dist/index.html has no #app');

const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(dist, path), 'utf8')) as T;
const manifest = readJson<ContentManifest>('content/manifest.json');
const words = new Map<Level, Word[]>(
  manifest.levels.map((l) => [l.id, readJson<Word[]>(`content/${l.file}`)]),
);
const readers = readJson<Reader[]>('content/readers.json');

interface Page {
  path: string;
  title: string;
  description: string;
  type?: 'website' | 'article';
  body: string;
  data: object[];
  /** Breadcrumb trail above the page, home first: [name, path]. */
  trail: [string, string][];
}

const zh = (text: string): string => `<span lang="zh-Hant-TW">${h(text)}</span>`;
const link = (path: string, html: string): string => `<a href="${h(path)}">${html}</a>`;

const STYLE = `<style>
  .pre { max-width: 46rem; margin: 0 auto; padding: 1.5rem 1rem 4rem; line-height: 1.6; }
  .pre nav { font-size: 0.9rem; opacity: 0.75; margin-bottom: 1rem; }
  .pre h1 { font-size: 2rem; line-height: 1.25; margin: 0 0 0.5rem; }
  .pre h1[lang] { font-size: 3rem; }
  .pre ul { padding-left: 1.2rem; }
</style>`;

function head(page: Page): string {
  const url = absolute(site, page.path);
  const image = absolute(site, '/pwa-512x512.png');
  const tags = [
    `<title>${h(page.title)}</title>`,
    `<meta name="description" content="${h(page.description)}" />`,
    url && `<link rel="canonical" href="${h(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${page.type ?? 'website'}" />`,
    `<meta property="og:title" content="${h(page.title)}" />`,
    `<meta property="og:description" content="${h(page.description)}" />`,
    url && `<meta property="og:url" content="${h(url)}" />`,
    image && `<meta property="og:image" content="${h(image)}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${h(page.title)}" />`,
    `<meta name="twitter:description" content="${h(page.description)}" />`,
  ];
  const data = [...page.data];
  if (site && page.trail.length > 1) {
    data.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: page.trail.map(([name, path], i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name,
        item: absolute(site, path),
      })),
    });
  }
  for (const d of data) tags.push(`<script type="application/ld+json">${jsonLd(d)}</script>`);
  return [...tags.filter(Boolean), STYLE].join('\n    ');
}

/** The template with its default title, description and preview tags swapped for the page's. */
function render(page: Page): string {
  const crumbs = page.trail
    .map(([name, path], i) =>
      i === page.trail.length - 1
        ? h(name)
        : link(path, /\p{Script=Han}/u.test(name) ? zh(name) : h(name)),
    )
    .join(' › ');
  const body =
    `<div class="pre">` +
    (page.trail.length > 1 ? `<nav aria-label="Breadcrumb">${crumbs}</nav>` : '') +
    `${page.body}` +
    `<p>${link('/welcome', 'Learn Taiwan Mandarin free with 臺灣華語 →')}</p></div>`;
  return template
    .replace(/<!--[\s\S]*?-->\s*/g, '')
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/<meta\s+name="description"[\s\S]*?\/>\s*/, '')
    .replace(/<meta\s+(?:property="og:|name="twitter:)[\s\S]*?\/>\s*/g, '')
    .replace('</head>', `  ${head(page)}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="app">${body}</div>`);
}

const HOME: [string, string] = [SITE_NAME, '/welcome'];
const PATH: [string, string] = ['TOCFL path', '/path'];
const READ: [string, string] = ['Graded readers', '/read'];

const pages: Page[] = [];

// The welcome page: what the app is, and the way into the levels and readers.
const levelList = LEVELS.map((l) => {
  const count = words.get(l.id)?.length ?? 0;
  return `<li>${link(levelPath(l.id), `TOCFL ${h(l.en)} ${zh(l.zh)}`)} – CEFR ${h(l.cefr)}, ${count.toLocaleString('en')} words</li>`;
}).join('');
const total = [...words.values()].reduce((n, list) => n + list.length, 0);

pages.push({
  path: '/welcome',
  title: DEFAULT_TITLE,
  description: DEFAULT_DESCRIPTION,
  trail: [HOME],
  body:
    `<h1>Learn Mandarin the way Taiwan teaches it.</h1>` +
    `<p>Traditional characters, Zhuyin (ㄅㄆㄇㄈ) and Taiwan readings, along the TOCFL path from ` +
    `Novice 1 to Level 6: ${total.toLocaleString('en')} words. Spaced repetition, a dictionary ` +
    `under every character, and short readings about life in Taiwan. Free, no account needed, ` +
    `and it works offline on phone, iPad and laptop.</p>` +
    `<h2>The TOCFL word lists</h2><ul>${levelList}</ul>` +
    `<h2>${link('/read', 'Graded readers about Taiwan')}</h2>` +
    `<ul>${readers.map((r) => `<li>${link(readerPath(r.id), zh(r.title))} – ${h(r.titleEn)}</li>`).join('')}</ul>`,
  data: [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: SITE_NAME,
      alternateName: 'Taiwan Mandarin',
      description: DEFAULT_DESCRIPTION,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Any (web browser)',
      inLanguage: ['en', 'vi', 'ru', 'zh-Hant-TW'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      ...(site && { url: absolute(site, '/') }),
    },
    ...(site
      ? [
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            url: absolute(site, '/'),
          },
        ]
      : []),
  ],
});

pages.push({
  path: '/path',
  title: pageTitle('TOCFL vocabulary lists, Novice 1 to Level 6'),
  description:
    `Every word of the TOCFL word lists (${total.toLocaleString('en')} words) by level, in ` +
    'Traditional Chinese with pinyin, Zhuyin and Taiwan readings.',
  trail: [HOME, PATH],
  body: `<h1>The TOCFL path</h1><ul>${levelList}</ul>`,
  data: [],
});

for (const info of LEVELS) {
  const list = words.get(info.id) ?? [];
  if (!list.length) continue;
  pages.push({
    path: levelPath(info.id),
    title: levelTitle(info.id),
    description: levelDescription(info.id, list.length),
    trail: [HOME, PATH, [`TOCFL ${info.en}`, levelPath(info.id)]],
    body:
      `<h1>TOCFL ${h(info.en)} ${zh(info.zh)}</h1>` +
      `<p>${h(levelDescription(info.id, list.length))}</p><ul>` +
      list
        .map((w) => {
          const { pinyin, zhuyin } = readings(w);
          return `<li>${link(wordPath(w.id), zh(w.hanzi))} ${h(pinyin)} ${zh(zhuyin)} – ${h(clip(w.en, 80))}</li>`;
        })
        .join('') +
      '</ul>',
    data: [
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: `TOCFL ${info.en} word list`,
        description: levelDescription(info.id, list.length),
        inLanguage: 'zh-Hant-TW',
        ...(site && { url: absolute(site, levelPath(info.id)) }),
      },
    ],
  });

  list.forEach((word, i) => {
    const { pinyin, zhuyin } = readings(word);
    const near = list.slice(Math.max(0, i - 5), i + 6).filter((w) => w !== word);
    const examples = (word.examples ?? [])
      .map((e) => `<li>${zh(e.zh)}<br />${h(e.en)}</li>`)
      .join('');
    pages.push({
      path: wordPath(word.id),
      title: wordTitle(word),
      description: wordDescription(word),
      type: 'article',
      trail: [
        HOME,
        PATH,
        [`TOCFL ${info.en}`, levelPath(info.id)],
        [word.hanzi, wordPath(word.id)],
      ],
      body:
        `<h1 lang="zh-Hant-TW">${h(word.hanzi)}</h1>` +
        `<p>Pinyin: ${h(pinyin)} · Zhuyin: ${zh(zhuyin)}</p>` +
        (word.en ? `<h2>Meaning</h2><p>${h(word.en)}</p>` : '') +
        `<p>TOCFL ${link(levelPath(info.id), h(info.en))} (CEFR ${h(info.cefr)})` +
        (word.pos ? ` · ${h(word.pos)}` : '') +
        (word.cl ? ` · measure word ${zh(word.cl)}` : '') +
        '</p>' +
        (word.tw ? `<p>In Taiwan: ${h(word.tw)}</p>` : '') +
        (word.variants?.length ? `<p>Also written ${zh(word.variants.join('、'))}</p>` : '') +
        (examples ? `<h2>Example sentences</h2><ul>${examples}</ul>` : '') +
        (near.length
          ? `<h2>Nearby words</h2><ul>${near.map((w) => `<li>${link(wordPath(w.id), zh(w.hanzi))} – ${h(clip(w.en, 50))}</li>`).join('')}</ul>`
          : ''),
      data: [
        {
          '@context': 'https://schema.org',
          '@type': 'DefinedTerm',
          name: word.hanzi,
          alternateName: [pinyin, zhuyin],
          ...(word.en && { description: word.en }),
          inLanguage: 'zh-Hant-TW',
          ...(site && { url: absolute(site, wordPath(word.id)) }),
          inDefinedTermSet: {
            '@type': 'DefinedTermSet',
            name: `TOCFL ${info.en} word list`,
            ...(site && { url: absolute(site, levelPath(info.id)) }),
          },
        },
      ],
    });
  });
}

pages.push({
  path: '/read',
  title: pageTitle('Graded readers in Traditional Chinese about life in Taiwan'),
  description:
    `${readers.length} short graded readings in Traditional Chinese about life in Taiwan, from ` +
    'Novice to advanced, with pinyin, Zhuyin and English translations.',
  trail: [HOME, READ],
  body:
    '<h1>Graded readers about Taiwan</h1><ul>' +
    readers
      .map(
        (r) =>
          `<li>${link(readerPath(r.id), zh(r.title))} – ${h(r.titleEn)} (TOCFL ${h(levelInfo(r.level).en)}): ${h(r.summary)}</li>`,
      )
      .join('') +
    '</ul>',
  data: [],
});

for (const reader of readers) {
  const paragraphs = reader.paragraphs
    .map((tokens, i) => {
      const text = tokens.map((t) => t.t).join('');
      const en = reader.translation[i];
      return `<p lang="zh-Hant-TW">${h(text)}</p>${en ? `<p>${h(en)}</p>` : ''}`;
    })
    .join('');
  pages.push({
    path: readerPath(reader.id),
    title: readerTitle(reader),
    description: readerDescription(reader),
    type: 'article',
    trail: [HOME, READ, [reader.title, readerPath(reader.id)]],
    body:
      `<h1 lang="zh-Hant-TW">${h(reader.title)}</h1>` +
      `<p>${h(reader.titleEn)} · TOCFL ${link(levelPath(reader.level), h(levelInfo(reader.level).en))}</p>` +
      `<p>${h(reader.summary)}</p>${paragraphs}`,
    data: [
      {
        '@context': 'https://schema.org',
        '@type': 'LearningResource',
        name: reader.title,
        alternateName: reader.titleEn,
        description: reader.summary,
        inLanguage: 'zh-Hant-TW',
        learningResourceType: 'Reading',
        educationalLevel: `TOCFL ${levelInfo(reader.level).en} (CEFR ${levelInfo(reader.level).cefr})`,
        isAccessibleForFree: true,
        ...(site && { url: absolute(site, readerPath(reader.id)) }),
      },
    ],
  });
}

for (const page of pages) {
  // /word/還~huan2 → dist/word/還~huan2/index.html (the server serves it for that path).
  const file = join(dist, decodeURIComponent(page.path), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, render(page));
}

writeFileSync(join(dist, 'robots.txt'), robots(site));
const sitemapFile = join(dist, 'sitemap.xml');
if (site) {
  writeFileSync(
    sitemapFile,
    sitemap(
      site,
      pages.map((p) => p.path),
    ),
  );
} else rmSync(sitemapFile, { force: true });

console.log(
  `Prerendered ${pages.length} pages` +
    (site ? `, sitemap for ${site}` : ' (no SITE_URL: no canonical links or sitemap)'),
);
