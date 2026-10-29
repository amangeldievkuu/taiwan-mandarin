// The languages the content is built in besides English, and where each one's text comes from.
// Each has its own files beside the English ones (content/vi/, dict/vi/), which carry its fields
// (`vi`, `viSource`, `twVi`…) on top of the English.

import type { ForeignLang, MeaningSource } from '@taiwan-mandarin/shared';
import { CVDICT_RULES, readCvdict } from './cvdict.ts';
import type { GlossRules } from './lexicon.ts';
import { RAW } from './paths.ts';

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
};

export const CONTENT_LANGUAGES: readonly ContentLanguage[] = [VI];
