// Taiwan-standard guard: catches Simplified characters, Mainland phrasing and Mainland readings
// in any Chinese text the app shows. Used by tests, the UI scan script and the API seed.
// Kept out of the main entry point so opencc-js never reaches the web bundle.

import { Converter } from 'opencc-js/cn2t';
import { splitSyllables } from '../phonetics.ts';
import type { Topic, Word } from '../content/types.ts';
import { ALLOWLIST, type AllowEntry } from './allowlist.ts';
import { MAINLAND_READINGS, MAINLAND_TERMS } from './denylist.ts';

export { ALLOWLIST, MAINLAND_READINGS, MAINLAND_TERMS, type AllowEntry };

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
    return MAINLAND_READINGS[char]?.includes(syllable)
      ? [
          {
            where: `vocab:${word.id}.pinyin`,
            text: `${word.hanzi} ${word.pinyin}`,
            problem: `${char} ${syllable} is a Mainland reading`,
          },
        ]
      : [];
  });
}

/** Every Chinese-bearing string in the vocabulary data. */
export function vocabTexts(words: readonly Word[], topics: readonly Topic[]): TextEntry[] {
  return [
    ...topics.map((t) => ({ text: t.zh, where: `topic:${t.id}.zh` })),
    ...words.flatMap((w) => [
      { text: w.hanzi, where: `vocab:${w.id}.hanzi` },
      { text: w.en, where: `vocab:${w.id}.en` },
      { text: w.ky, where: `vocab:${w.id}.ky` },
      ...(w.tw
        ? [
            { text: w.tw.en, where: `vocab:${w.id}.tw.en` },
            { text: w.tw.ky, where: `vocab:${w.id}.tw.ky` },
          ]
        : []),
      ...(w.mainland
        ? [{ text: w.mainland, where: `vocab:${w.id}.mainland`, mainland: true }]
        : []),
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
