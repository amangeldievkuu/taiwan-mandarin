// Content text in the learner's language: in Vietnamese, the Vietnamese files' fields, and so on
// for each language; in English, or where a translation is missing, the English, marked with its
// language so a page can say so.

import {
  TOKEN_GLOSS,
  twKey,
  type DictEntry,
  type Example,
  type ForeignLang,
  type Lang,
  type Meanings,
  type Reader,
  type ReaderToken,
  type TaiwanNotes,
  type Word,
} from '@taiwan-mandarin/shared';
import { locale } from './index.svelte';

export interface Localized {
  text: string;
  /** The language the text is in: the app's, or English standing in for it. */
  lang: Lang;
}

/** `own`'s text in the learner's language when there is one, else the English. */
function pick(en: string, own: (lang: ForeignLang) => string | undefined): Localized {
  const lang = locale.lang;
  const text = lang === 'en' ? undefined : own(lang);
  return lang !== 'en' && text ? { text, lang } : { text: en, lang: 'en' };
}

export const glossOf = (word: Pick<Word, 'en'> & Meanings): Localized =>
  pick(word.en, (lang) => word[lang]);

export const translationOf = (example: Pick<Example, 'en'> & Meanings): Localized =>
  pick(example.en, (lang) => example[lang]);

export const twNoteOf = (word: Pick<Word, 'tw'> & TaiwanNotes): Localized | undefined =>
  word.tw ? pick(word.tw, (lang) => word[twKey(lang)]) : undefined;

/** A reader word's gloss, for words above the reader's level. */
export const tokenGlossOf = (token: ReaderToken): Localized | undefined =>
  token.g ? pick(token.g, (lang) => token[TOKEN_GLOSS[lang]]) : undefined;

export const readerTitleOf = (reader: Reader): Localized =>
  pick(reader.titleEn, (lang) => reader[lang]?.title);

export const readerSummaryOf = (reader: Reader): Localized =>
  pick(reader.summary, (lang) => reader[lang]?.summary);

export const readerTranslationOf = (reader: Reader, paragraph: number): Localized =>
  pick(reader.translation[paragraph] ?? '', (lang) => reader[lang]?.translation[paragraph]);

/** A dictionary entry's definitions: another language's files have its own unless marked English. */
export const definitionsOf = (entry: DictEntry): { list: string[]; lang: Lang } => ({
  list: entry.d,
  lang: locale.lang !== 'en' && !entry.en ? locale.lang : 'en',
});

/** The Sino-Vietnamese reading to show: in Vietnamese, with the setting on, when it is known. */
export const hanVietOf = (reading: string | undefined): string | undefined =>
  locale.lang === 'vi' && locale.hanViet ? reading : undefined;
