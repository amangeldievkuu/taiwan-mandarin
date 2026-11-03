// What a page is called, for back buttons ("‹ Today", "‹ Novice 1", "‹ 你好"): the page's own
// title, short, in the language it is written in.

import { isLevel } from '@taiwan-mandarin/shared';
import { content } from './content.svelte';
import { DEFAULT_TITLE, levelTitle, pageTitle, readerTitle, wordTitle } from './seo';
import { t } from './i18n/index.svelte';
import type { Route } from './router.svelte';

export interface Title {
  text: string;
  /** Set for Chinese titles (a word, a reader), so they render in the right font. */
  lang?: string;
}

export function routeTitle(route: Route): Title {
  const titles = t().titles;
  switch (route.name) {
    case 'level': {
      const level = route.params['level'];
      return { text: isLevel(level) ? t().levels[level] : titles.level };
    }
    case 'word': {
      const hanzi = content.word(route.params['id'] ?? '')?.hanzi;
      return hanzi ? { text: hanzi, lang: 'zh-Hant-TW' } : { text: titles.word };
    }
    case 'reader': {
      const title = content.readerTitle(route.params['id'] ?? '');
      return title ? { text: title, lang: 'zh-Hant-TW' } : { text: titles.reader };
    }
    default:
      return { text: titles[route.name] };
  }
}

/**
 * The browser tab's title. Words, levels and readers get the same full title as their prerendered
 * page (scripts/prerender.ts), so a search engine running the app sees the same one.
 */
export function documentTitle(route: Route): string {
  switch (route.name) {
    case 'today':
    case 'welcome':
      return DEFAULT_TITLE;
    case 'word': {
      const word = content.word(route.params['id'] ?? '');
      if (word) return wordTitle(word);
      break;
    }
    case 'level': {
      const level = route.params['level'];
      if (isLevel(level)) return levelTitle(level);
      break;
    }
    case 'reader': {
      const reader = content.reader(route.params['id'] ?? '');
      if (reader) return readerTitle(reader);
      break;
    }
  }
  return pageTitle(routeTitle(route).text);
}
