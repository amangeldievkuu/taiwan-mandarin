// Taiwan-standard guard: catches Simplified characters, Mainland phrasing and Mainland readings
// in any Chinese text the app shows. Used by tests, the UI scan script and the API seed.
// Kept out of the main entry point so opencc-js never reaches the web bundle.

import { Converter } from 'opencc-js/cn2t';
import { splitSyllables } from '../phonetics.ts';
import type { Topic, Word } from '../content/types.ts';
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
  problem: string;
}

/** Simplified → Traditional (Taiwan) characters only. */
const toTwChars = Converter({ from: 'cn', to: 'tw' });
/** Characters plus Taiwan phrasing (網絡→網路, 視頻→影片, …). */
const toTwPhrases = Converter({ from: 'cn', to: 'twp' });

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

export function checkText(entry: TextEntry, allowlist = ALLOWLIST): Issue[] {
  if (!CJK.test(entry.text)) return [];
  const text = mask(entry, allowlist);
  const issues: Issue[] = [];
  const report = (problem: string) =>
    issues.push({ where: entry.where, text: entry.text, problem });

  const converted = entry.mainland ? toTwChars(text) : toTwPhrases(text);
  if (converted !== text) report(`not Taiwan standard, expected "${converted}"`);

  if (!entry.mainland) {
    for (const [term, taiwan] of Object.entries(MAINLAND_TERMS)) {
      if (text.includes(term)) report(`Mainland word ${term}; Taiwan uses ${taiwan}`);
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
            problem: `${char} ${syllable} is a Mainland reading; Taiwan reads ${taiwan}`,
          },
        ]
      : [];
  });
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
      ...(w.tw ? [{ text: w.tw, where: `vocab:${w.id}.tw` }] : []),
      ...(w.mainland
        ? [{ text: w.mainland, where: `vocab:${w.id}.mainland`, mainland: true }]
        : []),
      ...(w.examples ?? []).map((e, i) => ({ text: e.zh, where: `vocab:${w.id}.examples.${i}` })),
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
