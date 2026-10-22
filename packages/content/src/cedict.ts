// CC-CEDICT (CC BY-SA 4.0, https://cc-cedict.org) parser. Keeps Traditional headwords, applies the
// dictionary's own "Taiwan pr." readings, and rewrites cross-references to Traditional only.

import { readFileSync } from 'node:fs';
import { parseSyllable, pinyinWord } from '@taiwan-mandarin/shared';

export interface CedictEntry {
  trad: string;
  /** Numbered pinyin, lowercase, ü spelled out. Taiwan reading when CC-CEDICT gives one. */
  pinyin: string;
  /** Reading before the Taiwan correction, when one was applied. */
  mainlandPinyin?: string;
  defs: string[];
  /** Measure words in Traditional characters, e.g. ["個", "本"]. */
  classifiers: string[];
  /** Capitalized reading: a name or place. */
  proper: boolean;
}

/** "xia4hai2" / "Tai2 wan1" / "lu:4" → "xia4 hai2" / "tai2 wan1" / "lü4" */
export function normalizePinyin(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/u:/g, 'ü')
      .match(/[a-zü]+[1-5]/g) ?? []
  ).join(' ');
}

/**
 * A CC-CEDICT reading as readers see it inside a definition: "le4 se4" → "lèsè", "Xi1 an1" →
 * "Xī'ān". A capital starts a new word, so names split into surname and given name ("Ma3 Ying1
 * jiu3" → "Mǎ Yīngjiǔ"), and CC-CEDICT's commas stay ("yi1 bu4 zuo4 , er4 bu4 xiu1" →
 * "yībùzuò, èrbùxiū").
 */
function displayPinyin(raw: string): string {
  try {
    return raw
      .split(',')
      .map((part) => {
        const words: string[][] = [];
        for (const syllable of part.replace(/u:/gi, 'ü').match(/[a-zü]+[1-5]/gi) ?? []) {
          const last = words.at(-1);
          if (!last || /^[A-ZÜ]/.test(syllable)) words.push([syllable]);
          else last.push(syllable);
        }
        return words
          .map((word) => {
            const written = pinyinWord(word.join(' ').toLowerCase());
            return /^[A-ZÜ]/.test(word[0] ?? '')
              ? written.charAt(0).toUpperCase() + written.slice(1)
              : written;
          })
          .join(' ');
      })
      .filter(Boolean)
      .join(', ');
  } catch {
    return normalizePinyin(raw);
  }
}

/** "什麼|什么[shen2 me5]" → "什麼 (shénme)"; "臺|台[tai2]" → "臺 (tái)"; "[han4]" → "hàn". */
export function cleanDefinition(def: string): string {
  return (
    def
      .replace(
        /([^\s|[\]/,;()]+)\|[^\s|[\]/,;()]+\[([^\]]+)\]/g,
        (_, trad: string, py: string) => `${trad} (${displayPinyin(py)})`,
      )
      .replace(/([^\s|[\]/,;()]+)\[([^\]]+)\]/g, (_, trad: string, py: string) =>
        /^[a-z]/i.test(trad) ? `${trad} ${displayPinyin(py)}` : `${trad} (${displayPinyin(py)})`,
      )
      .replace(/\[([a-zü: 1-5]+)\]/gi, (_, py: string) => displayPinyin(py))
      // A bare cross-reference without a reading: "師傅|师傅" → "師傅".
      .replace(/([^\s|[\]/,;()]+)\|[^\s|[\]/,;()]+/g, '$1')
      .trim()
  );
}

const LINE = /^(\S+) (\S+) \[([^\]]*)\] \/(.*)\/$/;

export function parseCedictLine(line: string): CedictEntry | undefined {
  const match = LINE.exec(line.trim());
  if (!match) return undefined;
  const [, trad = '', , rawPinyin = '', rawDefs = ''] = match;
  let pinyin = normalizePinyin(rawPinyin);
  let mainlandPinyin: string | undefined;
  const classifiers: string[] = [];
  const defs: string[] = [];

  for (const def of rawDefs.split('/')) {
    const taiwan = /^Taiwan pr\. \[([^\]]+)\]$/.exec(def);
    if (taiwan) {
      const tw = normalizePinyin(taiwan[1] ?? '');
      if (tw.split(' ').length === pinyin.split(' ').length) {
        mainlandPinyin = pinyin;
        pinyin = tw;
      }
      continue;
    }
    if (def.startsWith('CL:')) {
      for (const cl of def.slice(3).split(',')) classifiers.push(cl.split(/[|[]/)[0] ?? '');
      continue;
    }
    const cleaned = cleanDefinition(def);
    if (cleaned) defs.push(cleaned);
  }
  return {
    trad,
    pinyin,
    mainlandPinyin,
    defs,
    classifiers: classifiers.filter(Boolean),
    proper: /^[A-Z]/.test(rawPinyin),
  };
}

export function readCedict(path: string): CedictEntry[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .flatMap((line) => parseCedictLine(line) ?? []);
}

/** Toneless syllables, for comparing readings: "le4 se4" → "le se". */
export const toneless = (pinyin: string) => pinyin.replace(/[1-5]/g, '');

/** Every syllable spelling CC-CEDICT uses (toneless), e.g. "zhuang", "lü". */
export function syllableInventory(entries: readonly CedictEntry[]): Set<string> {
  const set = new Set<string>();
  for (const e of entries)
    for (const s of toneless(e.pinyin).split(' ')) if (/^[a-zü]+$/.test(s)) set.add(s);
  // Taiwan readings CC-CEDICT never uses: 崖 yái, 唷 yō.
  set.add('yai');
  set.add('yo');
  // Drop what Zhuyin can't spell: erhua "r", interjections "m", "ng", "hm", placeholders "xx".
  for (const s of set) {
    try {
      parseSyllable(s + '1');
    } catch {
      set.delete(s);
    }
  }
  return set;
}

/** Character → toneless readings it has anywhere in the dictionary (single-character entries). */
export function charReadings(entries: readonly CedictEntry[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (char: string, syllable: string) => {
    let set = map.get(char);
    if (!set) map.set(char, (set = new Set()));
    set.add(syllable);
  };
  for (const e of entries) {
    const chars = [...e.trad];
    const syllables = toneless(e.pinyin).split(' ');
    const mainland = e.mainlandPinyin ? toneless(e.mainlandPinyin).split(' ') : [];
    if (chars.length !== syllables.length) continue;
    chars.forEach((c, i) => {
      add(c, syllables[i] ?? '');
      if (mainland[i]) add(c, mainland[i]);
    });
  }
  return map;
}
