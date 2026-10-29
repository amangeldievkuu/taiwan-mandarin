// Which language a first visit starts in, before the learner picks one.

import { isLang, type Lang } from '@taiwan-mandarin/shared';

/** The first app language in the browser's preference list: ['vi-VN', 'en'] → vi. */
export function detectLanguage(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

/** A first visit's language: the browser's, when it prefers Vietnamese to English. */
export const firstRunLanguage = (): Lang =>
  typeof navigator === 'undefined'
    ? 'en'
    : detectLanguage(navigator.languages?.length ? navigator.languages : [navigator.language]);

/** Development only: ?lang=vi shows the app in that language whatever the settings say. */
export function devLanguage(): Lang | undefined {
  if (!import.meta.env.DEV || typeof location === 'undefined') return undefined;
  const lang = new URLSearchParams(location.search).get('lang');
  return isLang(lang) ? lang : undefined;
}
