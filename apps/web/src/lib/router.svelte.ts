// Tiny History-API router: path patterns → route names and params, with deep links and back/forward.
// Page changes animate with the View Transitions API where the browser has it: deeper pages slide
// in from the right, going back slides them away, tabs cross-fade.

import { flushSync } from 'svelte';
import { reduced } from './motion';
import { navKind } from './nav';

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
  | 'me-ink'
  | 'me-levels'
  | 'me-about'
  | 'welcome';

/** The pages under Me (they highlight the Me tab and slide in from it). */
export const ME_ROUTES: RouteName[] = [
  'me',
  'me-account',
  'me-settings',
  'me-garden',
  'me-ink',
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
  ['me-ink', /^\/me\/ink\/?$/],
  ['me-levels', /^\/me\/levels\/?$/],
  ['me-about', /^\/me\/about\/?$/],
  ['welcome', /^\/welcome\/?$/],
];

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
  /** Names the entry, to keep its scroll position (missing on entries from older versions). */
  key?: string;
}

const isEntry = (state: unknown): state is EntryState =>
  typeof state === 'object' && state !== null && (state as { tm?: unknown }).tm === 1;

/** The current page as an in-app path (with its query). */
const here = (): string => location.pathname.slice(base.length) + location.search || '/';

const newKey = (): string => crypto.randomUUID();

/** Where each history entry was scrolled to, kept for the tab's life (so across a reload too). */
const POSITIONS_KEY = 'taiwan-mandarin:scroll';

function loadPositions(): Map<string, number> {
  try {
    return new Map(JSON.parse(sessionStorage.getItem(POSITIONS_KEY) ?? '[]') as [string, number][]);
  } catch {
    return new Map();
  }
}

function savePositions(positions: Map<string, number>): void {
  try {
    sessionStorage.setItem(POSITIONS_KEY, JSON.stringify([...positions].slice(-100)));
  } catch {
    // Storage blocked or full: back after a reload starts at the top.
  }
}

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
  /** The page shown before this one, whichever way we came (null on the first page). */
  from = $state<Route | null>(null);
  /** Latest navigation, so a slow transition never shows an older page over a newer one. */
  private seq = 0;
  /** The current history entry's key. */
  private key: string;
  /** Scroll position by entry key, so going back or forward returns to where the page was. */
  private positions = loadPositions();

  constructor() {
    // The router puts the scroll back itself, once the page returned to is drawn. The browser
    // would do it at once, showing the page being left scrolled to the other's place for a frame.
    history.scrollRestoration = 'manual';
    const state: EntryState = isEntry(history.state) ? history.state : { tm: 1, prev: null };
    this.prev = state.prev;
    this.key = state.key ?? newKey();
    history.replaceState({ ...state, key: this.key } satisfies EntryState, '');
    addEventListener('scroll', () => this.positions.set(this.key, scrollY), { passive: true });
    addEventListener('pagehide', () => savePositions(this.positions));
    addEventListener('popstate', (event) => {
      const entry = isEntry(event.state) ? event.state : null;
      this.prev = entry?.prev ?? null;
      this.key = entry?.key ?? newKey();
      // A back swipe the browser already animated (iOS Safari) isn't animated twice.
      const animated = 'hasUAVisualTransition' in event && event.hasUAVisualTransition === true;
      this.show(parse(new URL(location.href)), !animated, this.positions.get(this.key) ?? 0);
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
      history.replaceState({ tm: 1, prev: this.prev, key: this.key } satisfies EntryState, '', url);
    } else {
      const prev = here();
      this.key = newKey();
      history.pushState({ tm: 1, prev, key: this.key } satisfies EntryState, '', url);
      this.prev = prev;
    }
    const scrollTop = options.scrollTop ?? !replace;
    this.show(parse(url), options.animate ?? !replace, scrollTop ? 0 : undefined);
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

  /** Shows `next`, then scrolls to `top` (if given) in the same frame, once it is drawn. */
  private show(next: Route, animate: boolean, top?: number): void {
    const seq = ++this.seq;
    const update = () => {
      if (seq !== this.seq) return;
      flushSync(() => {
        this.from = this.route;
        this.route = next;
      });
      if (top !== undefined) scrollTo({ top, behavior: 'instant' });
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
    const root = document.documentElement;
    root.dataset['nav'] = navKind(from.name, next.name);
    const transition = document.startViewTransition(update);
    void transition.finished.finally(() => {
      if (seq === this.seq) delete root.dataset['nav'];
    });
  }
}

export const router = new Router();
