// The languages the content is built in besides English, and where each one's text comes from.
// Each has its own files beside the English ones (content/vi/, dict/vi/), which carry its fields
// (`vi`, `viSource`, `twVi`…) on top of the English. Its meanings come from the curated words, then
// its dictionary, then its gap file; see data/generated/README.md.

import type { ForeignLang, MeaningSource } from '@taiwan-mandarin/shared';
import { CVDICT_RULES, readCvdict } from './cvdict.ts';
import type { GlossRules } from './lexicon.ts';
import { at, RAW } from './paths.ts';

export interface ContentLanguage {
  lang: ForeignLang;
  /** Its English name, for messages ("no Vietnamese translation"). */
  name: string;
  /**
   * CC-CEDICT translated into the language line by line, joined to it by CC-CEDICT's keys: the
   * study words' meanings and the dictionary's definitions.
   */
  dictionary?: {
    name: string;
    path: string;
    read: (path: string) => Map<string, string[]>;
    /** Its wording of the senses flashcards leave out. */
    rules: GlossRules;
    source: MeaningSource;
  };
  /** The note on a Mainland word the NAER list includes: Taiwan says `taiwan` instead. */
  mainlandNote: (taiwan: string) => string;
  /** Meanings written for the words the curated ones and the dictionary miss: `{id, <lang>}` lines. */
  glosses: string;
  /** Example sentences translated into the language: `{zh, <lang>}` lines. */
  examples: string;
  /**
   * Linked dictionary entries the language's dictionary lacks take the study word's meaning (see
   * `DictLanguage.wordMeanings`).
   */
  wordMeanings: boolean;
  /** Whether every reader must have a block in the language. */
  readers: 'required' | 'optional';
  /** Longest gloss in the search index, in characters. */
  searchGloss: number;
  /** Sino-Vietnamese readings on words, dictionary entries and search rows (`hv`, `h`). */
  hanViet?: boolean;
}

const VI: ContentLanguage = {
  lang: 'vi',
  name: 'Vietnamese',
  dictionary: {
    name: 'CVDICT',
    path: RAW.cvdict,
    read: readCvdict,
    rules: CVDICT_RULES,
    source: 'cvdict',
  },
  mainlandNote: (taiwan) => `Cách nói ở Trung Quốc đại lục. Ở Đài Loan nói ${taiwan}.`,
  glosses: at('data/generated/glosses-vi.jsonl'),
  examples: at('data/generated/examples-vi.jsonl'),
  wordMeanings: false,
  readers: 'required',
  searchGloss: 100,
  hanViet: true,
};

/**
 * No open Chinese–Russian dictionary exists, so a Russian meaning is the curated one or written with
 * AI (glosses-ru.jsonl), and the dictionary shows it on the word's own entries; other entries stay
 * English.
 */
const RU: ContentLanguage = {
  lang: 'ru',
  name: 'Russian',
  mainlandNote: (taiwan) => `Так говорят на материке. На Тайване говорят ${taiwan}.`,
  glosses: at('data/generated/glosses-ru.jsonl'),
  examples: at('data/generated/examples-ru.jsonl'),
  wordMeanings: true,
  readers: 'required',
  searchGloss: 100,
};

export const CONTENT_LANGUAGES: readonly ContentLanguage[] = [VI, RU];

export const contentLanguage = (lang: ForeignLang): ContentLanguage | undefined =>
  CONTENT_LANGUAGES.find((l) => l.lang === lang);
