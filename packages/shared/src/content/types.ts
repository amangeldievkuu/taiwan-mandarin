// Content types, shared by the web app, the content pipeline and the API.

import type { ForeignLang, Lang } from '../lang.ts';
//
// Each language has its own content files: English in content/ and dict/, Vietnamese in content/vi/
// and dict/vi/, and so on. A language's file is the English one plus that language's fields (named
// by its code: `vi`, `viSource`, `twVi`), so a learner loads one set or the other.

/** Where a meaning in another language comes from: hand-written, CVDICT (CC-CEDICT translated), or written with AI. */
export type MeaningSource = 'curated' | 'cvdict' | 'ai';

/** A word's meaning in each other language (that language's files; missing → show `en`). */
export type Meanings = { [L in ForeignLang]?: string };

/** Where each language's meaning comes from (`viSource`). */
export type MeaningSources = { [L in ForeignLang as `${L}Source`]?: MeaningSource };

/** `tw` in each other language (`twVi`). */
export type TaiwanNotes = { [L in ForeignLang as `tw${Capitalize<L>}`]?: string };

export const sourceKey = <L extends ForeignLang>(lang: L): `${L}Source` => `${lang}Source`;

export const twKey = <L extends ForeignLang>(lang: L): `tw${Capitalize<L>}` =>
  `tw${lang.charAt(0).toUpperCase()}${lang.slice(1)}` as `tw${Capitalize<L>}`;

/**
 * Study path, following the TOCFL bands. N1–L5 come from the official 《華語八千詞表》;
 * L6 (精通, C2) has no TOCFL list and comes from level 7 of the NAER 《臺灣華語文能力基準》 list.
 */
export type Level = 'N1' | 'N2' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';

export interface LevelInfo {
  id: Level;
  zh: string;
  en: string;
  cefr: string;
}

export const LEVELS: readonly LevelInfo[] = [
  { id: 'N1', zh: '準備一級', en: 'Novice 1', cefr: 'Pre-A1' },
  { id: 'N2', zh: '準備二級', en: 'Novice 2', cefr: 'Pre-A1' },
  { id: 'L1', zh: '入門級', en: 'Level 1', cefr: 'A1' },
  { id: 'L2', zh: '基礎級', en: 'Level 2', cefr: 'A2' },
  { id: 'L3', zh: '進階級', en: 'Level 3', cefr: 'B1' },
  { id: 'L4', zh: '高階級', en: 'Level 4', cefr: 'B2' },
  { id: 'L5', zh: '流利級', en: 'Level 5', cefr: 'C1' },
  { id: 'L6', zh: '精通級', en: 'Level 6', cefr: 'C2' },
];

export const LEVEL_IDS: readonly Level[] = LEVELS.map((l) => l.id);

export const levelIndex = (level: Level): number => LEVEL_IDS.indexOf(level);

export const isLevel = (value: unknown): value is Level =>
  typeof value === 'string' && (LEVEL_IDS as readonly string[]).includes(value);

export type TopicId =
  | 'core'
  | 'personal'
  | 'social'
  | 'daily'
  | 'food'
  | 'shopping'
  | 'travel'
  | 'leisure'
  | 'education'
  | 'work'
  | 'body'
  | 'feelings'
  | 'nature'
  | 'culture'
  | 'society'
  | 'public'
  | 'safety'
  | 'tech';

export interface Topic {
  id: TopicId;
  zh: string;
  en: string;
}

/** An example sentence; each other language's files add its translation (`vi`; missing → show `en`). */
export interface Example extends Meanings {
  zh: string;
  /** Numbered pinyin for the Chinese characters of `zh`, one syllable each, in order. */
  pinyin: string;
  /**
   * Characters per word of `zh`'s Chinese text, in order ("我|明天|來" → [1, 2, 1]), so readings can
   * be spaced by word. Missing in content built before it was added.
   */
  wordLengths?: number[];
  en: string;
  source: 'tatoeba' | 'ai' | 'curated';
  /** Source id, e.g. the Tatoeba sentence number. */
  ref?: string;
}

export interface Word extends Meanings, MeaningSources, TaiwanNotes {
  /** The headword, or "headword~reading" when the same characters have several readings. */
  id: string;
  hanzi: string;
  /** Numbered pinyin, one syllable per character, citation tones, 5 = neutral. */
  pinyin: string;
  en: string;
  level: Level;
  /** Which official list placed the word at its level. */
  src: 'tocfl' | 'tbcl' | 'curated';
  /** Study order within the level (TOCFL words first, then by corpus frequency). */
  rank: number;
  topic: TopicId;
  /** Part of speech tags from the lists, e.g. "N", "Vs", "V-sep". */
  pos?: string;
  /** Other accepted written forms (異體字, optional 子/兒 forms). */
  variants?: string[];
  /** Measure words, e.g. "個 本". */
  cl?: string;
  examples?: Example[];
  glossSource: 'cedict' | 'curated' | 'ai' | 'none';
  /** Note about Taiwan usage; marks the word as Taiwan-specific. */
  tw?: string;
  /** Sino-Vietnamese (Hán-Việt) reading, "quốc gia" for 國家 (Vietnamese files). */
  hv?: string;
  /** Mainland equivalent (in Traditional characters), shown only as a labeled note. */
  mainland?: string;
  /** Reading not yet confirmed against the MOE 《重編國語辭典修訂本》. */
  readingUnverified?: boolean;
}

export interface LevelManifest {
  id: Level;
  count: number;
  tocfl: number;
  tbcl: number;
  /** File under /content/, e.g. "words-N1.json". */
  file: string;
}

export interface ContentManifest {
  /** Content hash; changes whenever any content file changes. */
  version: string;
  levels: LevelManifest[];
  dictShards: number;
  /** Longest dictionary headword, in characters (for longest-match lookups). */
  dictMaxLength: number;
  readers: number;
  /** Pre-TOCFL word ids → current ids, for migrating saved progress. */
  legacyIds: Record<string, string>;
  /** Hash of each file ("content/words-N1.json", "dict/0.json"), to version it on its own. */
  files?: Record<string, string>;
  /** Languages with content files ("vi": content/vi/…, dict/vi/…). Missing before Vietnamese. */
  languages?: Lang[];
}

/** One CC-CEDICT entry in a dictionary shard, with Taiwan readings applied. */
export interface DictEntry {
  /** Traditional headword. */
  t: string;
  /** Numbered pinyin. */
  p: string;
  /** Definitions, in the file's language. */
  d: string[];
  /** Another language's files: it has no definitions for the entry, so `d` is the English. */
  en?: 1;
  /** Sino-Vietnamese reading (Vietnamese files). */
  h?: string;
  /** Measure words. */
  c?: string;
  /** Word id when the entry is in the study path. */
  w?: string;
  /** Level when the entry is in the study path. */
  l?: Level;
}

export type DictShard = Record<string, DictEntry[]>;

/** Number of dictionary shards; an entry goes to shard (first code point % DICT_SHARDS). */
export const DICT_SHARDS = 128;

export const dictShardOf = (text: string): number => (text.codePointAt(0) ?? 0) % DICT_SHARDS;

/**
 * A graded reader as authored in data/readers/<id>.json, with its title, summary, translation and
 * glossary in each other language (`vi`; the build says which are required).
 */
export interface ReaderSource extends Partial<Record<ForeignLang, ReaderTranslation>> {
  id: string;
  level: Level;
  topic: TopicId;
  title: string;
  titleEn: string;
  /** One-line English summary shown in the list. */
  summary: string;
  paragraphs: string[];
  /** English translation, one entry per paragraph. */
  translation: string[];
  /** Glosses for words above the reader's level, by written form. */
  glossary?: Record<string, string>;
  /** Written with AI and not yet reviewed by a person. */
  draft?: boolean;
}

export interface ReaderTranslation {
  title: string;
  summary: string;
  /** One entry per paragraph. */
  translation: string[];
  glossary?: Record<string, string>;
}

export interface ReaderToken {
  /** Text as written. */
  t: string;
  /** Numbered pinyin for Chinese tokens. */
  p?: string;
  /** Study-path word id. */
  w?: string;
  /** Level of that word. */
  l?: Level;
  /** Gloss for a word above the reader's level (from its glossary, else the study gloss). */
  g?: string;
  /** `g` in Vietnamese (Vietnamese files). */
  gv?: string;
}

/** The field of a reader token that holds `g` in each other language. */
export const TOKEN_GLOSS = { vi: 'gv' } as const satisfies Record<ForeignLang, keyof ReaderToken>;

/** A reader as built; each other language's files add its title, summary and translation. */
export interface Reader
  extends
    Omit<ReaderSource, 'paragraphs' | 'glossary' | ForeignLang>,
    Partial<Record<ForeignLang, Omit<ReaderTranslation, 'glossary'>>> {
  paragraphs: ReaderToken[][];
  /** Number of distinct study-path words. */
  wordCount: number;
  /** Chinese characters, for reading-time estimates. */
  charCount: number;
  /** Share of word tokens above the reader's level (0–1); they carry an automatic gloss. */
  hard: number;
}

/**
 * Written forms that are the same word as `word.hanzi`: the headword and its character variants
 * (裡/裏, 臺/台). Variants of another length (城 for 城市, 宗教 listed with 教) are related words.
 */
export const sameWordForms = (word: Pick<Word, 'hanzi' | 'variants'>): string[] => [
  word.hanzi,
  ...(word.variants ?? []).filter((v) => [...v].length === [...word.hanzi].length),
];

/**
 * One row of content/search.json: [id, hanzi, toneless pinyin letters, gloss in the file's
 * language]. Vietnamese rows add the Sino-Vietnamese reading.
 */
export type SearchRow = [id: string, hanzi: string, pinyin: string, gloss: string, hv?: string];
