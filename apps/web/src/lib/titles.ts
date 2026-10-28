// What a page is called, for back buttons ("‹ Today", "‹ Novice 1", "‹ 你好"): the page's own
// title, short, in the language it is written in.

import { LEVELS } from '@taiwan-mandarin/shared';
import { content } from './content.svelte';
import type { Route, RouteName } from './router.svelte';

export interface Title {
  text: string;
  /** Set for Chinese titles (a word, a reader), so they render in the right font. */
  lang?: string;
}

const NAMES: Record<Exclude<RouteName, 'level' | 'word' | 'reader'>, string> = {
  today: 'Today',
  study: 'Study',
  path: 'Path',
  read: 'Read',
  dict: 'Dictionary',
  talk: 'Talk',
  me: 'Me',
  'me-account': 'Account',
  'me-settings': 'Settings',
  'me-garden': 'Garden',
  'me-levels': 'By level',
  'me-about': 'About',
  welcome: 'Welcome',
};

export function routeTitle(route: Route): Title {
  switch (route.name) {
    case 'level':
      return { text: LEVELS.find((l) => l.id === route.params['level'])?.en ?? 'Level' };
    case 'word': {
      const hanzi = content.word(route.params['id'] ?? '')?.hanzi;
      return hanzi ? { text: hanzi, lang: 'zh-Hant-TW' } : { text: 'Word' };
    }
    case 'reader': {
      const title = content.readerTitle(route.params['id'] ?? '');
      return title ? { text: title, lang: 'zh-Hant-TW' } : { text: 'Reading' };
    }
    default:
      return { text: NAMES[route.name] };
  }
}
