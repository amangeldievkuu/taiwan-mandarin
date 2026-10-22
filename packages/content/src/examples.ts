// Example sentences from Tatoeba (CC BY 2.0 FR, https://tatoeba.org) with English translations.
// Sentences already in Traditional characters are preferred; Simplified ones get Taiwan characters
// (OpenCC cn→tw, characters only). Every sentence must then pass the Taiwan-standard guard, which
// drops Mainland wording, and use only words at or near the target word's level.

import { readFileSync } from 'node:fs';
import {
  sameWordForms,
  levelIndex,
  segment,
  splitSyllables,
  type DictEntry,
  type DictShard,
  type Example,
  type Lexicon,
  type Word,
  dictShardOf,
} from '@taiwan-mandarin/shared';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import { Converter } from 'opencc-js/cn2t';

const toTwChars = Converter({ from: 'cn', to: 'tw' });

interface Sentence {
  id: string;
  zh: string;
  en: string;
  /** Written in Traditional characters by its author (not converted). */
  native: boolean;
}

function readTsv(path: string): string[][] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

export function readTatoeba(paths: { cmn: string; eng: string; links: string }): Sentence[] {
  const links = new Map<string, string[]>();
  for (const [cmn, eng] of readTsv(paths.links)) {
    if (cmn && eng) links.set(cmn, [...(links.get(cmn) ?? []), eng]);
  }
  const wanted = new Set([...links.values()].flat());
  const english = new Map<string, string>();
  for (const [id, , text] of readTsv(paths.eng))
    if (id && text && wanted.has(id)) english.set(id, text);

  const sentences: Sentence[] = [];
  for (const [id, , raw] of readTsv(paths.cmn)) {
    if (!id || !raw) continue;
    const en = (links.get(id) ?? []).map((e) => english.get(e)).find((t) => t !== undefined);
    if (!en) continue;
    const text = raw.trim();
    const native = toTwChars(text) === text;
    const zh = native ? text : toTwChars(text);
    sentences.push({ id, zh, en, native });
  }
  return sentences;
}

const PUNCTUATION_ONLY = /^[\s\p{P}\p{S}0-9０-９]*$/u;

/**
 * The sentence's pinyin from its words' readings, with each word's length so the app can space the
 * reading by word; undefined when a word has no reading with one syllable per character.
 */
function sentencePinyin(
  tokens: ReturnType<typeof segment>,
  reading: (word: string) => string | undefined,
): { pinyin: string; wordLengths: number[] } | undefined {
  const syllables: string[] = [];
  const wordLengths: number[] = [];
  for (const token of tokens) {
    if (!token.han) continue;
    const pinyin = reading(token.text);
    const length = [...token.text].length;
    if (!pinyin || splitSyllables(pinyin).length !== length) return undefined;
    syllables.push(pinyin);
    wordLengths.push(length);
  }
  return { pinyin: syllables.join(' '), wordLengths };
}

export function pickExamples(
  sentences: readonly Sentence[],
  words: readonly Word[],
  shards: readonly DictShard[],
  maxLength: number,
  perWord = 2,
): {
  examples: Map<string, Example[]>;
  usable: number;
  annotate: (zh: string) => { pinyin: string; wordLengths: number[] } | undefined;
  wordLengths: (zh: string) => number[];
} {
  const lookup = (word: string): DictEntry[] | undefined => shards[dictShardOf(word)]?.[word];
  // Lowest-level reading of each written form: the reading a learner meets first.
  const byForm = new Map<string, Word>();
  for (const w of words) {
    for (const form of sameWordForms(w)) {
      const known = byForm.get(form);
      if (!known || levelIndex(w.level) < levelIndex(known.level)) byForm.set(form, w);
    }
  }
  const lexicon: Lexicon = {
    has: (word) => byForm.has(word) || lookup(word) !== undefined,
    maxLength,
    weight: (word) => (byForm.has(word) ? 2 : 1),
  };
  const reading = (word: string) => byForm.get(word)?.pinyin ?? lookup(word)?.[0]?.p;

  const candidates = new Map<string, { example: Example; score: number }[]>();
  let usable = 0;
  for (const s of sentences) {
    const hanCount = [...s.zh].filter((c) => /\p{Script=Han}/u.test(c)).length;
    if (hanCount < 4 || hanCount > 24 || /[A-Za-z]/.test(s.zh) || s.en.length > 120) continue;
    if (checkText({ text: s.zh, where: `tatoeba:${s.id}` }).length) continue;
    const tokens = segment(s.zh, lexicon);
    const annotated = sentencePinyin(tokens, reading);
    if (!annotated) continue;
    // Hardest word in the sentence; words outside the path count as beyond Level 6.
    const levels = tokens
      .filter((t) => t.han && !PUNCTUATION_ONLY.test(t.text))
      .map((t) => {
        const w = byForm.get(t.text);
        return w ? levelIndex(w.level) : 8;
      });
    const hardest = Math.max(0, ...levels);
    usable++;
    const example: Example = {
      zh: s.zh,
      ...annotated,
      en: s.en,
      source: 'tatoeba',
      ref: s.id,
    };
    for (const token of tokens) {
      const word = byForm.get(token.text);
      if (!word) continue;
      const level = levelIndex(word.level);
      if (hardest > level + 1) continue;
      // Prefer: within the level, native Traditional, 8–16 characters, and the word not repeated.
      const score =
        (hardest <= level ? 10 : 0) +
        (s.native ? 4 : 0) -
        Math.abs(hanCount - 12) * 0.3 -
        (tokens.filter((t) => t.text === token.text).length - 1) * 2;
      const list = candidates.get(word.id) ?? [];
      if (!list.some((c) => c.example.zh === s.zh)) list.push({ example, score });
      candidates.set(word.id, list);
    }
  }

  /** Pinyin for a sentence written elsewhere (AI examples), from the same word readings. */
  const annotate = (zh: string) => sentencePinyin(segment(zh, lexicon), reading);
  /** Word lengths alone, for a sentence whose pinyin is given. */
  const wordLengths = (zh: string) =>
    segment(zh, lexicon).flatMap((t) => (t.han ? [[...t.text].length] : []));

  const examples = new Map<string, Example[]>();
  for (const [id, list] of candidates) {
    examples.set(
      id,
      list
        .sort((a, b) => b.score - a.score)
        .slice(0, perWord)
        .map((c) => c.example),
    );
  }
  return { examples, usable, annotate, wordLengths };
}
