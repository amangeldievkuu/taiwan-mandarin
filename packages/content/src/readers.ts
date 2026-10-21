// Graded readers: data/readers/<id>.json → paragraphs split into words with readings, linked to
// study-path words so the app can mark known words and add unknown ones with one tap.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sameWordForms,
  dictShardOf,
  LEVEL_IDS,
  levelIndex,
  segment,
  TOPICS,
  type DictShard,
  type Lexicon,
  type Reader,
  type ReaderSource,
  type ReaderToken,
  type Word,
} from '@taiwan-mandarin/shared';
import { checkText, formatIssues } from '@taiwan-mandarin/shared/taiwan-standard';

export function readReaders(
  dir: string,
  words: readonly Word[],
  shards: readonly DictShard[],
  maxLength: number,
): Reader[] {
  if (!existsSync(dir)) return [];
  const byForm = new Map<string, Word>();
  for (const w of words) {
    for (const form of sameWordForms(w)) {
      const known = byForm.get(form);
      if (!known || levelIndex(w.level) < levelIndex(known.level)) byForm.set(form, w);
    }
  }
  const lookup = (word: string) => shards[dictShardOf(word)]?.[word];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      const source = JSON.parse(readFileSync(join(dir, file), 'utf8')) as ReaderSource;
      const where = `reader:${source.id}`;
      if (`${source.id}.json` !== file) throw new Error(`${file}: id must match the file name`);
      if (!LEVEL_IDS.includes(source.level))
        throw new Error(`${file}: unknown level ${source.level}`);
      if (!TOPICS.some((t) => t.id === source.topic))
        throw new Error(`${file}: unknown topic ${source.topic}`);
      if (source.translation.length !== source.paragraphs.length) {
        throw new Error(`${file}: one translation per paragraph`);
      }
      const glossary = source.glossary ?? {};
      const issues = [source.title, ...source.paragraphs, ...Object.keys(glossary)].flatMap(
        (text) => checkText({ text, where }),
      );
      if (issues.length)
        throw new Error(`${file} is not Taiwan standard:\n${formatIssues(issues)}`);

      const lexicon: Lexicon = {
        // Glossary entries are words too, so they come out as single tokens.
        has: (word) => byForm.has(word) || word in glossary || lookup(word) !== undefined,
        maxLength,
        weight: (word) => (byForm.has(word) || word in glossary ? 2 : 1),
      };
      const seen = new Set<string>();
      let charCount = 0;
      const paragraphs = source.paragraphs.map((text) =>
        segment(text, lexicon).map((token): ReaderToken => {
          if (!token.han) return { t: token.text };
          charCount += [...token.text].length;
          const word = byForm.get(token.text);
          if (word) seen.add(word.id);
          const pinyin =
            word?.pinyin ?? lookup(token.text)?.[0]?.p ?? charByChar(token.text, lookup);
          if (!pinyin) throw new Error(`${file}: no reading for "${token.text}"`);
          return {
            t: token.text,
            p: pinyin,
            ...(word ? { w: word.id, l: word.level } : {}),
            ...(glossary[token.text] ? { g: glossary[token.text] } : {}),
          };
        }),
      );
      return {
        id: source.id,
        level: source.level,
        topic: source.topic,
        title: source.title,
        titleEn: source.titleEn,
        summary: source.summary,
        translation: source.translation,
        paragraphs,
        wordCount: seen.size,
        charCount,
      };
    })
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.id.localeCompare(b.id));
}

/** Reading for an unknown multi-character token, one character at a time. */
function charByChar(
  text: string,
  lookup: (w: string) => { p: string }[] | undefined,
): string | undefined {
  const syllables = [...text].map((c) => lookup(c)?.[0]?.p);
  return syllables.every(Boolean) ? syllables.join(' ') : undefined;
}
