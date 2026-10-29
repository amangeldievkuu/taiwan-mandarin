// Graded readers: data/readers/<id>.json → paragraphs split into words with readings, linked to
// study-path words so the app can mark known words and add unknown ones with one tap. A reader's
// block in each other language (`vi`) carries its title, summary, translation and glossary.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sameWordForms,
  dictShardOf,
  LEVEL_IDS,
  levelIndex,
  segment,
  TOKEN_GLOSS,
  TOPICS,
  type DictShard,
  type ForeignLang,
  type Lexicon,
  type Reader,
  type ReaderSource,
  type ReaderToken,
  type Word,
} from '@taiwan-mandarin/shared';
import { checkText, formatIssues } from '@taiwan-mandarin/shared/taiwan-standard';

/** A language the readers are read in besides English. */
export interface ReaderLanguage {
  lang: ForeignLang;
  /** Its English name, for messages. */
  name: string;
  /** Its dictionary shards, for glosses of words outside the study path. */
  shards: readonly DictShard[];
  /** Every reader must have a block in it. */
  required: boolean;
}

export function readReaders(
  dir: string,
  words: readonly Word[],
  shards: readonly DictShard[],
  languages: readonly ReaderLanguage[],
  maxLength: number,
  /** Called with the words above each reader's level that the reader doesn't gloss itself. */
  report?: (id: string, above: string[]) => void,
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
  /** A word's first definitions in a language's own words (not the English standing in). */
  const definitions = (language: ReaderLanguage, word: string) => {
    const entry = language.shards[dictShardOf(word)]?.[word]?.[0];
    return entry && !entry.en ? entry.d.slice(0, 2).join('; ') : undefined;
  };
  const NUMERAL = /^[一二三四五六七八九十百千萬億〇零兩]+$/;
  /**
   * Level of a word outside the path (這個, 每天, 越來越): its hardest part, splitting greedily into
   * path words. Numbers count as easy; a character in no path word counts as beyond Level 6.
   */
  const partsLevel = (text: string): number => {
    if (NUMERAL.test(text)) return 0;
    const chars = [...text];
    let hardest = 0;
    for (let i = 0; i < chars.length;) {
      let len = Math.min(8, chars.length - i);
      while (len > 1 && !byForm.has(chars.slice(i, i + len).join(''))) len--;
      const part = chars.slice(i, i + len).join('');
      const w = byForm.get(part);
      hardest = Math.max(
        hardest,
        w ? levelIndex(w.level) : NUMERAL.test(part) ? 0 : LEVEL_IDS.length,
      );
      i += len;
    }
    return hardest;
  };

  const problems: string[] = [];
  const readers = readdirSync(dir)
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
      const blocks = languages.flatMap((language) => {
        const { lang, name } = language;
        const block = source[lang];
        if (!block) {
          if (language.required) throw new Error(`${file}: no ${name} (a "${lang}" block)`);
          return [];
        }
        if (block.translation.length !== source.paragraphs.length) {
          throw new Error(`${file}: one ${name} translation per paragraph`);
        }
        const own = block.glossary ?? {};
        const untranslated = Object.keys(glossary).filter((form) => !own[form]);
        if (untranslated.length)
          throw new Error(`${file}: no ${name} glossary entry for ${untranslated.join(' ')}`);
        return [{ language, block, glossary: own }];
      });
      const issues = [
        source.title,
        ...source.paragraphs,
        ...Object.keys(glossary),
        ...blocks.flatMap((b) => Object.keys(b.glossary)),
      ].flatMap((text) => checkText({ text, where }));
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
      let wordTokens = 0;
      const above: string[] = [];
      const paragraphs = source.paragraphs.map((text) =>
        segment(text, lexicon).map((token): ReaderToken => {
          if (!token.han) return { t: token.text };
          charCount += [...token.text].length;
          const word = byForm.get(token.text);
          if (word) seen.add(word.id);
          wordTokens++;
          const level = word ? levelIndex(word.level) : partsLevel(token.text);
          // Words above the reader's level get a gloss: the reader's own, else the study gloss.
          const autoGloss =
            level > levelIndex(source.level) && !glossary[token.text]
              ? (word?.en ?? lookup(token.text)?.[0]?.d.slice(0, 2).join('; '))
              : undefined;
          if (level > levelIndex(source.level) && !glossary[token.text]) above.push(token.text);
          const gloss = glossary[token.text] ?? autoGloss;
          // Each language's gloss, for every word that has an English one.
          const glosses = blocks.flatMap(({ language, glossary: own }) => {
            const text =
              own[token.text] ??
              (gloss ? (word?.[language.lang] ?? definitions(language, token.text)) : undefined);
            return text ? [[TOKEN_GLOSS[language.lang], text] as const] : [];
          });
          const pinyin =
            word?.pinyin ?? lookup(token.text)?.[0]?.p ?? charByChar(token.text, lookup);
          if (!pinyin) throw new Error(`${file}: no reading for "${token.text}"`);
          return {
            t: token.text,
            p: pinyin,
            ...(word ? { w: word.id, l: word.level } : {}),
            ...(gloss ? { g: gloss } : {}),
            ...Object.fromEntries(glosses),
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
        ...Object.fromEntries(
          blocks.map(({ language, block }) => [
            language.lang,
            { title: block.title, summary: block.summary, translation: block.translation },
          ]),
        ),
        paragraphs,
        wordCount: seen.size,
        charCount,
        hard: wordTokens ? above.length / wordTokens : 0,
        ...(source.draft ? { draft: true } : {}),
        ...(report ? (report(source.id, above), {}) : {}),
      };
    })
    .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.id.localeCompare(b.id));
  if (problems.length) throw new Error(problems.join('\n'));
  return readers;
}

/** Reading for an unknown multi-character token, one character at a time. */
function charByChar(
  text: string,
  lookup: (w: string) => { p: string }[] | undefined,
): string | undefined {
  const syllables = [...text].map((c) => lookup(c)?.[0]?.p);
  return syllables.every(Boolean) ? syllables.join(' ') : undefined;
}
