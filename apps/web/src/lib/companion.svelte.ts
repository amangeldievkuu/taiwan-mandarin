// Where 墨 (the ink drop that keeps you company) sits on the page in front of you. By default
// that is the bottom-right corner, on top of the tab bar. A page with something better to sit
// on marks it with `use:perch` (Study's progress bar); a page with no room to spare uses
// `use:stepAway` (an open conversation), and 墨 climbs out of sight until it is gone. Whether
// 墨 comes along at all is a per-device choice in Settings. A page can also have 墨 say
// something as it happens (`say`): a run of right answers, a session done.

import { SvelteSet } from 'svelte/reactivity';
import type { MoCheer } from './mo';

export interface Cheer {
  mood: MoCheer;
  /** For counts: how many in a row. */
  n: number;
  /** New for every call, so the same cheer twice is said twice. */
  id: number;
}

const KEY = 'taiwan-mandarin:companion';

function readOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch {
    return true;
  }
}

class Companion {
  /** 墨 comes along from page to page (this device). */
  on = $state(readOn());
  /** The element 墨 sits on, at its right-hand end. */
  anchor = $state<HTMLElement | null>(null);
  /** The latest thing a page asked 墨 to say. */
  cheer = $state<Cheer | null>(null);
  /** What is on screen that wants 墨 out of the way. */
  private aways = new SvelteSet<HTMLElement>();

  get away(): boolean {
    return this.aways.size > 0;
  }

  say(mood: MoCheer, n = 0): void {
    this.cheer = { mood, n, id: (this.cheer?.id ?? 0) + 1 };
  }

  setOn(on: boolean): void {
    this.on = on;
    try {
      localStorage.setItem(KEY, on ? '1' : '0');
    } catch {
      // per-device preference only
    }
  }

  /** A Svelte action: 墨 sits on top of this element while it is on the page. */
  perch = (node: HTMLElement): { destroy(): void } => {
    this.anchor = node;
    return {
      destroy: () => {
        if (this.anchor === node) this.anchor = null;
      },
    };
  };

  /** A Svelte action: 墨 steps away while this element is on the page. */
  stepAway = (node: HTMLElement): { destroy(): void } => {
    this.aways.add(node);
    return {
      destroy: () => {
        this.aways.delete(node);
      },
    };
  };
}

export const companion = new Companion();
