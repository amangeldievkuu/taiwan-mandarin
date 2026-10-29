// Taiwan-standard guard: catches Simplified characters, Mainland phrasing and Mainland readings
// in any Chinese text the app shows. Used by tests, the UI scan script and the API seed.
// Kept out of the main entry point so opencc-js never reaches the web bundle.

import { Converter } from 'opencc-js/cn2t';
import { splitSyllables } from '../phonetics.ts';
import { sourceKey, twKey, type Topic, type Word } from '../content/types.ts';
import { FOREIGN_LANGS } from '../lang.ts';
import { ALLOWLIST, OPENCC_OVERREACH, type AllowEntry } from './allowlist.ts';
import { MAINLAND_READINGS, MAINLAND_TERMS } from './denylist.ts';

export { ALLOWLIST, MAINLAND_READINGS, MAINLAND_TERMS, OPENCC_OVERREACH, type AllowEntry };

export interface TextEntry {
  text: string;
  /** Location, e.g. "vocab:jie-yun.tw.en" or "apps/web/src/App.svelte:12". */
  where: string;
  /** A labeled Mainland equivalent: Mainland words are expected, Simplified characters are not. */
  mainland?: boolean;
}

export interface Issue {
  where: string;
  text: string;
  /** In English, for reports. */
  problem: string;
  /** What is wrong, for wording it in another language. */
  kind: 'form' | 'term' | 'reading';
  /** form: the text in Taiwan forms and wording. */
  expected?: string;
  /** term: the Mainland word, and the Taiwan word for it. */
  term?: string;
  taiwan?: string;
}

/** Simplified → Traditional (Taiwan) characters only. */
const toTwChars = Converter({ from: 'cn', to: 'tw' });
/** Characters plus Taiwan phrasing (網絡→網路, 視頻→影片, …). */
const toTwPhrases = Converter({ from: 'cn', to: 'twp' });

/** Simplified → Taiwan Traditional characters (e.g. for speech-to-text output). */
export const toTaiwanCharacters = (text: string): string => toTwChars(text);

const CJK = /[\u3400-\u9fff\uf900-\ufaff]/;

/** Replace allowlisted terms (for this location) with private-use placeholders OpenCC ignores. */
function mask(entry: TextEntry, allowlist: readonly AllowEntry[]): string {
  let text = entry.text;
  allowlist.forEach((allow, i) => {
    if (entry.where.startsWith(allow.where)) {
      text = text.split(allow.term).join(String.fromCodePoint(0xe000 + i));
    }
  });
  OPENCC_OVERREACH.forEach((term, i) => {
    text = text.split(term).join(String.fromCodePoint(0xf000 + i));
  });
  return text;
}

/** The masked terms back in place, for messages. */
function unmask(text: string, allowlist: readonly AllowEntry[]): string {
  return text.replace(/[\ue000-\uf8ff]/gu, (c) => {
    const code = c.codePointAt(0) ?? 0;
    const term = code >= 0xf000 ? OPENCC_OVERREACH[code - 0xf000] : allowlist[code - 0xe000]?.term;
    return term ?? c;
  });
}

export function checkText(entry: TextEntry, allowlist = ALLOWLIST): Issue[] {
  if (!CJK.test(entry.text)) return [];
  const text = mask(entry, allowlist);
  const issues: Issue[] = [];
  const at = { where: entry.where, text: entry.text };

  const converted = entry.mainland ? toTwChars(text) : toTwPhrases(text);
  if (converted !== text) {
    const expected = unmask(converted, allowlist);
    issues.push({
      ...at,
      kind: 'form',
      expected,
      problem: `not Taiwan standard, expected "${expected}"`,
    });
  }

  if (!entry.mainland) {
    for (const [term, taiwan] of Object.entries(MAINLAND_TERMS)) {
      if (text.includes(term)) {
        issues.push({
          ...at,
          kind: 'term',
          term,
          taiwan,
          problem: `Mainland word ${term}; Taiwan uses ${taiwan}`,
        });
      }
    }
  }
  return issues;
}

/** Fails on Mainland readings such as 垃圾 la1 ji1 or 星期 xing1 qi1. */
export function checkReading(word: Pick<Word, 'id' | 'hanzi' | 'pinyin'>): Issue[] {
  const syllables = splitSyllables(word.pinyin).map((s) => s.toLowerCase().replace(/v|u:/g, 'ü'));
  return [...word.hanzi].flatMap((char, i) => {
    const syllable = syllables[i] ?? '';
    const taiwan = MAINLAND_READINGS[char]?.[syllable];
    return taiwan
      ? [
          {
            where: `vocab:${word.id}.pinyin`,
            text: `${word.hanzi} ${word.pinyin}`,
            kind: 'reading' as const,
            problem: `${char} ${syllable} is a Mainland reading; Taiwan reads ${taiwan}`,
          },
        ]
      : [];
  });
}

/** The same reading with Mainland character readings replaced: 學期 xue2 qi1 → xue2 qi2. */
export function taiwanReading(hanzi: string, pinyin: string): string {
  const chars = [...hanzi];
  return splitSyllables(pinyin)
    .map((syllable, i) => {
      const normalized = syllable.toLowerCase().replace(/v|u:/g, 'ü');
      return MAINLAND_READINGS[chars[i] ?? '']?.[normalized] ?? syllable;
    })
    .join(' ');
}

/** Every Chinese-bearing string in study-path words. */
export function vocabTexts(words: readonly Word[], topics: readonly Topic[]): TextEntry[] {
  return [
    ...topics.map((t) => ({ text: t.zh, where: `topic:${t.id}.zh` })),
    ...words.flatMap((w) => [
      // Headwords from the official Taiwan lists (TOCFL, NAER) define the standard; OpenCC's
      // phrase table would rewrite general words like 支持 or 項目 into IT terms (支援, 專案).
      ...(w.src === 'curated' ? [{ text: w.hanzi, where: `vocab:${w.id}.hanzi` }] : []),
      // CC-CEDICT glosses are reference text quoting other forms; only our own glosses are checked.
      ...(w.glossSource === 'cedict' ? [] : [{ text: w.en, where: `vocab:${w.id}.en` }]),
      // CVDICT is CC-CEDICT translated, so the same goes for its Vietnamese.
      ...FOREIGN_LANGS.flatMap((l) => {
        const text = w[l];
        return text && w[sourceKey(l)] !== 'cvdict' ? [{ text, where: `vocab:${w.id}.${l}` }] : [];
      }),
      ...(w.tw ? [{ text: w.tw, where: `vocab:${w.id}.tw` }] : []),
      ...FOREIGN_LANGS.flatMap((l) => {
        const text = w[twKey(l)];
        return text ? [{ text, where: `vocab:${w.id}.${twKey(l)}` }] : [];
      }),
      ...(w.mainland
        ? [{ text: w.mainland, where: `vocab:${w.id}.mainland`, mainland: true }]
        : []),
      ...(w.examples ?? []).flatMap((e, i) => [
        { text: e.zh, where: `vocab:${w.id}.examples.${i}` },
        ...FOREIGN_LANGS.flatMap((l) => {
          const text = e[l];
          return text ? [{ text, where: `vocab:${w.id}.examples.${i}.${l}` }] : [];
        }),
      ]),
    ]),
  ];
}

export function checkVocab(words: readonly Word[], topics: readonly Topic[]): Issue[] {
  return [
    ...vocabTexts(words, topics).flatMap((entry) => checkText(entry)),
    ...words.flatMap(checkReading),
  ];
}

export function formatIssues(issues: readonly Issue[]): string {
  return issues.map((i) => `  ${i.where}: "${i.text}" — ${i.problem}`).join('\n');
}
