// Content text in the learner's language: in Vietnamese, the Vietnamese files' fields; in English,
// or where a translation is missing, the English, marked with its language so a page can say so.

import type { DictEntry, Example, Lang, Reader, ReaderToken, Word } from '@taiwan-mandarin/shared';
import { locale } from './index.svelte';

export interface Localized {
  text: string;
  /** The language the text is in: the app's, or English standing in for it. */
  lang: Lang;
}

const pick = (en: string, vi: string | undefined): Localized =>
  locale.lang === 'vi' && vi ? { text: vi, lang: 'vi' } : { text: en, lang: 'en' };

export const glossOf = (word: Pick<Word, 'en' | 'vi'>): Localized => pick(word.en, word.vi);

export const translationOf = (example: Pick<Example, 'en' | 'vi'>): Localized =>
  pick(example.en, example.vi);

export const twNoteOf = (word: Pick<Word, 'tw' | 'twVi'>): Localized | undefined =>
  word.tw ? pick(word.tw, word.twVi) : undefined;

/** A reader word's gloss, for words above the reader's level. */
export const tokenGlossOf = (token: ReaderToken): Localized | undefined =>
  token.g ? pick(token.g, token.gv) : undefined;

export const readerTitleOf = (reader: Reader): Localized => pick(reader.titleEn, reader.vi?.title);

export const readerSummaryOf = (reader: Reader): Localized =>
  pick(reader.summary, reader.vi?.summary);

export const readerTranslationOf = (reader: Reader, paragraph: number): Localized =>
  pick(reader.translation[paragraph] ?? '', reader.vi?.translation[paragraph]);

/** A dictionary entry's definitions: the Vietnamese files' are Vietnamese unless marked English. */
export const definitionsOf = (entry: DictEntry): { list: string[]; lang: Lang } => ({
  list: entry.d,
  lang: locale.lang === 'vi' && !entry.en ? 'vi' : 'en',
});

/** The Sino-Vietnamese reading to show: in Vietnamese, with the setting on, when it is known. */
export const hanVietOf = (reading: string | undefined): string | undefined =>
  locale.lang === 'vi' && locale.hanViet ? reading : undefined;
