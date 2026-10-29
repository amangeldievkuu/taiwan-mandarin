// What each language's content files carry: the English ones nothing of the other languages, and
// each language's own its fields (and Hán-Việt for Vietnamese) but no other language's.

import { sourceKey, TOKEN_GLOSS, twKey, type Reader, type Word } from '@taiwan-mandarin/shared';
import { CONTENT_LANGUAGES, type ContentLanguage } from './languages.ts';

/** `value` without `keys`, the rest in their order. */
const without = <T extends object>(value: T, keys: readonly string[]): T =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key))) as T;

/** A reader as the files of `keep` carry it (English when none), without the others' fields. */
export function fileReader(
  reader: Reader,
  keep?: ContentLanguage,
  languages: readonly ContentLanguage[] = CONTENT_LANGUAGES,
): Reader {
  const langs = languages.filter((l) => l !== keep).map((l) => l.lang);
  const glosses = langs.map((lang) => TOKEN_GLOSS[lang]);
  return {
    ...without(reader, langs),
    paragraphs: reader.paragraphs.map((p) => p.map((token) => without(token, glosses))),
  };
}

/** A word as the files of `keep` carry it (English when none), without the others' fields. */
export function fileWord(
  word: Word,
  keep?: ContentLanguage,
  languages: readonly ContentLanguage[] = CONTENT_LANGUAGES,
): Word {
  const langs = languages.filter((l) => l !== keep).map((l) => l.lang);
  const w = without(word, [
    ...langs.flatMap((lang) => [lang, sourceKey(lang), twKey(lang)]),
    ...(keep?.hanViet ? [] : ['hv']),
  ]);
  if (word.examples) w.examples = word.examples.map((e) => without(e, langs));
  return w;
}
