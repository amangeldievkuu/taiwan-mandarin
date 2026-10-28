// Tiny History-API router: path patterns → route names and params, with deep links and back/forward.
// Page changes animate with the View Transitions API where the browser has it: deeper pages slide
// in from the right, going back slides them away, tabs cross-fade.

import { flushSync } from 'svelte';
import { reduced } from './motion';

export type RouteName =
  | 'today'
  | 'study'
  | 'path'
  | 'level'
  | 'word'
  | 'read'
  | 'reader'
  | 'dict'
  | 'talk'
  | 'me'
  | 'me-account'
  | 'me-settings'
  | 'me-garden'
  | 'me-levels'
  | 'me-about'
  | 'welcome';

/** The pages under Me (they highlight the Me tab and slide in from it). */
export const ME_ROUTES: RouteName[] = [
  'me',
  'me-account',
  'me-settings',
  'me-garden',
  'me-levels',
  'me-about',
];

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  query: URLSearchParams;
}

const PATTERNS: [RouteName, RegExp][] = [
  ['today', /^\/$/],
  ['study', /^\/study\/?$/],
  ['path', /^\/path\/?$/],
  ['level', /^\/path\/(?<level>[A-Z]\d)\/?$/],
  ['word', /^\/word\/(?<id>[^/]+)\/?$/],
  ['read', /^\/read\/?$/],
  ['reader', /^\/read\/(?<id>[^/]+)\/?$/],
  ['dict', /^\/dict\/?$/],
  ['talk', /^\/talk\/?$/],
  ['me', /^\/me\/?$/],
  ['me-account', /^\/me\/account\/?$/],
  ['me-settings', /^\/me\/settings\/?$/],
  ['me-garden', /^\/me\/garden\/?$/],
  ['me-levels', /^\/me\/levels\/?$/],
  ['me-about', /^\/me\/about\/?$/],
  ['welcome', /^\/welcome\/?$/],
];

/** How deep a page sits: tabs are 0, so moving to a larger number slides forward. */
const DEPTH: Record<RouteName, number> = {
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

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

function parse(url: URL): Route {
  const raw = url.pathname.slice(base.length) || '/';
  let path: string;
  try {
    path = decodeURIComponent(raw);
  } catch {
    // A broken escape (/word/%E4) is not a page we have.
    return { name: 'today', params: {}, query: url.searchParams };
  }
  for (const [name, pattern] of PATTERNS) {
    const match = pattern.exec(path);
    if (match) return { name, params: { ...match.groups }, query: url.searchParams };
  }
  return { name: 'today', params: {}, query: url.searchParams };
}

/** What remounts the page in App.svelte; a query change (the dictionary's ?q=) doesn't. */
export const viewKey = (route: Route): string =>
  route.name + (route.params['id'] ?? route.params['level'] ?? '');

/**
 * What each history entry of ours carries: the in-app page before it, so a back button knows
 * where it leads (even after a reload) and never steps out of the app.
 */
interface EntryState {
  tm: 1;
  prev: string | null;
}

const isEntry = (state: unknown): state is EntryState =>
  typeof state === 'object' && state !== null && (state as { tm?: unknown }).tm === 1;

/** The current page as an in-app path (with its query). */
const here = (): string => location.pathname.slice(base.length) + location.search || '/';

interface GoOptions {
  /** Replace this history entry instead of adding one (switching between siblings). */
  replace?: boolean;
  /** Animate the change (by default only for new entries). */
  animate?: boolean;
  /** Start the new page at the top (by default only for new entries). */
  scrollTop?: boolean;
}

class Router {
  route = $state<Route>(parse(new URL(location.href)));
  /** The in-app page before this one in history, or null when this is the first. */
  prev = $state<string | null>(null);
  /** Latest navigation, so a slow transition never shows an older page over a newer one. */
  private seq = 0;

  constructor() {
    if (isEntry(history.state)) this.prev = history.state.prev;
    else history.replaceState({ tm: 1, prev: null } satisfies EntryState, '');
    addEventListener('popstate', (event) => {
      this.prev = isEntry(event.state) ? event.state.prev : null;
      // A back swipe the browser already animated (iOS Safari) isn't animated twice.
      const animated = 'hasUAVisualTransition' in event && event.hasUAVisualTransition === true;
      this.show(parse(new URL(location.href)), !animated);
    });
  }

  href(path: string): string {
    return base + path;
  }

  /** The route an in-app path leads to. */
  resolve(path: string): Route {
    return parse(new URL(this.href(path), location.origin));
  }

  /** Where back goes: the page before this one, if it was ours. */
  get previous(): Route | null {
    return this.prev === null ? null : this.resolve(this.prev);
  }

  go(path: string, options: GoOptions = {}): void {
    const url = new URL(this.href(path), location.origin);
    if (url.href === location.href) {
      // The page you are on (e.g. its tab tapped again): back to the top.
      scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    const { replace = false } = options;
    if (replace) {
      history.replaceState({ tm: 1, prev: this.prev } satisfies EntryState, '', url);
    } else {
      const prev = here();
      history.pushState({ tm: 1, prev } satisfies EntryState, '', url);
      this.prev = prev;
    }
    this.show(parse(url), options.animate ?? !replace, options.scrollTop ?? !replace);
  }

  /**
   * Back to the page before, if it was ours; otherwise up to `parent` (a deep link, or the first
   * page of the visit), replacing this entry so back doesn't bounce between the two.
   */
  back(parent = '/'): void {
    if (this.prev !== null) history.back();
    else this.go(parent, { replace: true, animate: true });
  }

  /** Click handler for <a href>: in-app navigation without a page load. */
  link = (event: MouseEvent): void => {
    const anchor = (event.currentTarget as HTMLElement).closest('a');
    if (!anchor || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.target) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    this.go(url.pathname.slice(base.length) + url.search);
  };

  private show(next: Route, animate: boolean, scrollTop = false): void {
    const seq = ++this.seq;
    const update = () => {
      if (seq !== this.seq) return;
      this.route = next;
      if (scrollTop) scrollTo({ top: 0 });
    };
    const from = this.route;
    if (
      !animate ||
      viewKey(next) === viewKey(from) ||
      typeof document.startViewTransition !== 'function' ||
      document.visibilityState !== 'visible' ||
      reduced()
    ) {
      update();
      return;
    }
    const depth = DEPTH[next.name] - DEPTH[from.name];
    const root = document.documentElement;
    root.dataset['nav'] = depth > 0 ? 'forward' : depth < 0 ? 'back' : 'tab';
    const transition = document.startViewTransition(() => flushSync(update));
    void transition.finished.finally(() => {
      if (seq === this.seq) delete root.dataset['nav'];
    });
  }
}

export const router = new Router();
