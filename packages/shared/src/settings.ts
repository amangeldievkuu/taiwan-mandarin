// User settings, shared by the web app and the API.

import type { Level } from './content/types.ts';
import type { LookChoices } from './inkstone.ts';
import type { Lang } from './lang.ts';

export type Phonetics = 'zhuyin' | 'pinyin' | 'both';
export type GlyphStyle = 'kai' | 'sans';
export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  /** The learner's language: interface, meanings, translations and AI replies. */
  language: Lang;
  /** Show Sino-Vietnamese readings (國家 quốc gia) when the language is Vietnamese. */
  hanViet: boolean;
  phonetics: Phonetics;
  glyphStyle: GlyphStyle;
  theme: Theme;
  newPerDay: number;
  /** Levels new cards are drawn from, in path order. */
  levels: Level[];
  /** FSRS target probability of recall, 0.80–0.97. */
  retention: number;
  /** Looks chosen from what ink has unlocked (see inkstone.ts). */
  looks: LookChoices;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  hanViet: true,
  phonetics: 'zhuyin',
  glyphStyle: 'kai',
  theme: 'auto',
  newPerDay: 10,
  levels: ['N1'],
  retention: 0.9,
  looks: {},
};
