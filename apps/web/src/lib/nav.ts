// Which way a page change goes. The router uses it to slide pages (deeper pages in from the
// right, back out again, tabs cross-fade), and 墨 to choose how to turn up on the new page: it
// steps over between tabs, drips down into a deeper page, and hops back up when you go back.

import type { RouteName } from './router.svelte';

/** How deep a page sits: tabs are 0, so moving to a larger number goes forward. */
export const DEPTH: Record<RouteName, number> = {
  today: 0,
  study: 0,
  path: 0,
  read: 0,
  dict: 0,
  talk: 0,
  me: 0,
  welcome: 0,
  level: 1,
  reader: 1,
  'me-account': 1,
  'me-settings': 1,
  'me-garden': 1,
  'me-levels': 1,
  'me-about': 1,
  word: 2,
};

export type NavKind = 'forward' | 'back' | 'tab';

export function navKind(from: RouteName, to: RouteName): NavKind {
  const depth = DEPTH[to] - DEPTH[from];
  return depth > 0 ? 'forward' : depth < 0 ? 'back' : 'tab';
}

/** The tabs in the order the navigation shows them, left to right. */
const TAB_ORDER: RouteName[] = ['today', 'study', 'path', 'talk', 'read', 'dict', 'me'];

/** The tab a page belongs to. */
const TAB_OF: Partial<Record<RouteName, RouteName>> = {
  welcome: 'today',
  level: 'path',
  reader: 'read',
  word: 'dict',
  'me-account': 'me',
  'me-settings': 'me',
  'me-garden': 'me',
  'me-levels': 'me',
  'me-about': 'me',
};

export const tabIndex = (name: RouteName): number => TAB_ORDER.indexOf(TAB_OF[name] ?? name);

export type Entrance =
  { kind: 'walk'; from: 'left' | 'right' } | { kind: 'drop' } | { kind: 'rise' };

/** How 墨 arrives on `to` from `from`: stepping in from the side the new tab is on, dripping
    down into a deeper page, or hopping up on the way back. */
export function entranceFor(from: RouteName, to: RouteName): Entrance {
  const kind = navKind(from, to);
  if (kind === 'forward') return { kind: 'drop' };
  if (kind === 'back') return { kind: 'rise' };
  return { kind: 'walk', from: tabIndex(to) >= tabIndex(from) ? 'right' : 'left' };
}
