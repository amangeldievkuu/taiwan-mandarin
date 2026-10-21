// User settings, shared by the web app and the API.

import type { Level } from './content/types.ts';

export type Phonetics = 'zhuyin' | 'pinyin' | 'both';
export type GlyphStyle = 'kai' | 'sans';
export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  phonetics: Phonetics;
  glyphStyle: GlyphStyle;
  theme: Theme;
  newPerDay: number;
  /** Levels new cards are drawn from, in path order. */
  levels: Level[];
  /** FSRS target probability of recall, 0.80–0.97. */
  retention: number;
}

export const DEFAULT_SETTINGS: Settings = {
  phonetics: 'zhuyin',
  glyphStyle: 'kai',
  theme: 'auto',
  newPerDay: 10,
  levels: ['N1'],
  retention: 0.9,
};
