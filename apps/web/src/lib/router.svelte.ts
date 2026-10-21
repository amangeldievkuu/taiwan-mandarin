// Tiny History-API router: path patterns → route names and params, with deep links and back/forward.

export type RouteName =
  'today' | 'study' | 'path' | 'level' | 'word' | 'read' | 'reader' | 'dict' | 'talk' | 'me';

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
];

const base = import.meta.env.BASE_URL.replace(/\/$/, '');

function parse(url: URL): Route {
  const path = decodeURIComponent(url.pathname.slice(base.length) || '/');
  for (const [name, pattern] of PATTERNS) {
    const match = pattern.exec(path);
    if (match) return { name, params: { ...match.groups }, query: url.searchParams };
  }
  return { name: 'today', params: {}, query: url.searchParams };
}

class Router {
  route = $state<Route>(parse(new URL(location.href)));
  /** True after an in-app navigation, so "back" can use history instead of jumping home. */
  private moved = false;

  constructor() {
    addEventListener('popstate', () => (this.route = parse(new URL(location.href))));
  }

  href(path: string): string {
    return base + path;
  }

  go(path: string, options: { replace?: boolean } = {}): void {
    const url = new URL(this.href(path), location.origin);
    if (url.href === location.href) return;
    if (options.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    this.moved = true;
    this.route = parse(url);
    if (!options.replace) scrollTo({ top: 0 });
  }

  back(fallback = '/'): void {
    if (this.moved && history.length > 1) history.back();
    else this.go(fallback, { replace: true });
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
}

export const router = new Router();
