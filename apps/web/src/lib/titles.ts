// What a page is called, for back buttons ("‹ Today", "‹ Novice 1", "‹ 你好"): the page's own
// title, short, in the language it is written in.

import { isLevel } from '@taiwan-mandarin/shared';
import { content } from './content.svelte';
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
