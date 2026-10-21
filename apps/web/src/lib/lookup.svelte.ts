// Tap-to-look-up: any Chinese text in the app can open the dictionary sheet for the word under
// the finger (longest dictionary match starting at the tapped character).

import type { DictEntry } from '@taiwan-mandarin/shared';
import { content } from './content.svelte';

class Lookup {
  open = $state(false);
  loading = $state(false);
  word = $state('');
  entries = $state<DictEntry[]>([]);
  /** Extra gloss supplied by the context (a reader's glossary). */
  note = $state<string | undefined>(undefined);
  /** Where the looked-up word sits in the source text, for highlighting. */
  source = $state<{ text: string; start: number; end: number } | null>(null);

  private token = 0;

  async openAt(text: string, index: number): Promise<void> {
    const token = ++this.token;
    this.open = true;
    this.loading = true;
    this.note = undefined;
    const result = await content
      .lookupAt(text, index)
      .catch(() => ({ word: text.charAt(index), entries: [] }));
    if (token !== this.token) return;
    this.word = result.word;
    this.entries = result.entries;
    this.source = { text, start: index, end: index + result.word.length };
    this.loading = false;
  }

  async openWord(headword: string, note?: string): Promise<void> {
    const token = ++this.token;
    this.open = true;
    this.loading = true;
    this.word = headword;
    this.note = note;
    this.source = null;
    const entries = await content.lookup(headword).catch(() => []);
    if (token !== this.token) return;
    this.entries = entries;
    this.loading = false;
  }

  close(): void {
    this.open = false;
    this.source = null;
  }
}

export const lookup = new Lookup();
