// CC-CEDICT → dictionary shards with Taiwan readings, linked to study-path words. Each other
// language's shards are built from the same pass: the same entries in the same order, with that
// language's definitions (CVDICT's in Vietnamese), or the English, marked, where it has none.
//
// Readings, in order of authority:
//   1. the study-path word (TOCFL / NAER, MOE readings) with the same headword and syllables;
//   2. CC-CEDICT's own "Taiwan pr." note (applied while parsing);
//   3. per-character Mainland → Taiwan fixes (期 qī → qí …) from the Taiwan-standard denylist.

import {
  DICT_SHARDS,
  dictShardOf,
  levelIndex,
  sameWordForms,
  type DictEntry,
  type DictShard,
  type ForeignLang,
  type Word,
} from '@taiwan-mandarin/shared';
import { taiwanReading } from '@taiwan-mandarin/shared/taiwan-standard';
import { toneless, type CedictEntry } from './cedict.ts';
import { fold } from './lexicon.ts';

/** Mainland character readings → Taiwan ones (shared with the API's explanations). */
export const taiwanCharReadings = taiwanReading;

/** A language to build dictionary shards in besides English. */
export interface DictLanguage {
  lang: ForeignLang;
  /** A headword's reading in the language, shown with the entry (Hán-Việt in Vietnamese). */
  reading?: (hanzi: string, pinyin: string) => string | undefined;
  /**
   * Where the language's own definitions lack a study word's entry, the word's meaning stands in:
   * for its first entry under each headword, so a word with several entries doesn't say it twice.
   */
  wordMeanings?: boolean;
}

export function buildDictionary(
  cedict: readonly CedictEntry[],
  words: readonly Word[],
  languages: readonly DictLanguage[] = [],
): {
  shards: DictShard[];
  /** Each language's shards: the same entries, in its words. */
  localized: Partial<Record<ForeignLang, DictShard[]>>;
  maxLength: number;
  entries: number;
} {
  // Study-path words by folded written form (headword and variants).
  const byForm = new Map<string, Word[]>();
  for (const w of words) {
    for (const form of sameWordForms(w)) {
      const key = fold(form);
      byForm.set(key, [...(byForm.get(key) ?? []), w]);
    }
  }
  const linked = new Set<Word>();

  // Names ("surname He") link to a study word only when the headword has no common reading (臺灣).
  const hasCommon = new Set(cedict.filter((e) => !e.proper).map((e) => fold(e.trad)));
  const link = (e: CedictEntry): Word | undefined => {
    if (e.proper && hasCommon.has(fold(e.trad))) return undefined;
    const candidates = byForm.get(fold(e.trad)) ?? [];
    const exact = candidates.find((w) => w.pinyin === e.pinyin || w.pinyin === e.mainlandPinyin);
    if (exact) return exact;
    // Same syllables, other tones: only for words of two or more characters (好 hǎo ≠ 好 hào).
    if ([...e.trad].length < 2) return undefined;
    const sound = (p: string) => toneless(p);
    return candidates.find(
      (w) =>
        sound(w.pinyin) === sound(e.pinyin) ||
        (e.mainlandPinyin && sound(w.pinyin) === sound(e.mainlandPinyin)),
    );
  };

  const shards: DictShard[] = Array.from({ length: DICT_SHARDS }, () => ({}));
  // Sort key: study-path readings first (by level), then common words, then names.
  const rank = new WeakMap<DictEntry, number>();
  /** Where each entry comes from: a CC-CEDICT entry and the study word it links to, or a study word. */
  const origin = new WeakMap<DictEntry, { cedict?: CedictEntry; word?: Word }>();
  const add = (
    head: string,
    entry: DictEntry,
    from: { cedict?: CedictEntry; word?: Word },
    proper = false,
  ) => {
    rank.set(entry, entry.l ? levelIndex(entry.l) : proper ? 30 : 20);
    origin.set(entry, from);
    const shard = shards[dictShardOf(head)] as DictShard;
    (shard[head] ??= []).push(entry);
  };

  let maxLength = 1;
  let entries = 0;
  for (const e of cedict) {
    if (e.defs.length === 0) continue;
    const word = link(e);
    if (word) linked.add(word);
    const pinyin = word ? word.pinyin : taiwanCharReadings(e.trad, e.pinyin);
    const head = word && fold(word.hanzi) === fold(e.trad) ? word.hanzi : e.trad;
    // "台灣: variant of 臺灣" belongs under 台灣 only.
    const selfVariant = e.defs.every((d) => {
      const target = /^(?:old )?variant of (\S+)/.exec(d)?.[1];
      return target !== undefined && fold(target) === fold(head);
    });
    if (selfVariant && head !== e.trad) {
      add(
        e.trad,
        { t: e.trad, p: pinyin, d: e.defs, ...(word ? { w: word.id, l: word.level } : {}) },
        { cedict: e, word },
        e.proper,
      );
      continue;
    }
    add(
      head,
      {
        t: head,
        p: pinyin,
        d: e.defs,
        ...(e.classifiers.length ? { c: e.classifiers.join(' ') } : {}),
        ...(word ? { w: word.id, l: word.level } : {}),
      },
      { cedict: e, word },
      e.proper,
    );
    // Also findable by the Taiwan form when CC-CEDICT spells it differently (臺/台, 裡/裏).
    if (head !== e.trad) {
      add(
        e.trad,
        { t: e.trad, p: pinyin, d: e.defs, ...(word ? { w: word.id, l: word.level } : {}) },
        { cedict: e, word },
        e.proper,
      );
    }
    maxLength = Math.max(maxLength, [...head].length);
    entries++;
  }

  // Study-path words CC-CEDICT lacks: their own gloss.
  for (const w of words) {
    if (linked.has(w) || !w.en) continue;
    add(
      w.hanzi,
      {
        t: w.hanzi,
        p: w.pinyin,
        d: [w.en],
        ...(w.cl ? { c: w.cl } : {}),
        w: w.id,
        l: w.level,
      },
      { word: w },
    );
    maxLength = Math.max(maxLength, [...w.hanzi].length);
    entries++;
  }

  for (const shard of shards) {
    for (const list of Object.values(shard))
      list.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  }
  const localized: Partial<Record<ForeignLang, DictShard[]>> = {};
  for (const { lang, reading, wordMeanings } of languages) {
    localized[lang] = shards.map((shard) =>
      Object.fromEntries(
        Object.entries(shard).map(([head, list]) => {
          const meant = new Set<Word>();
          return [
            head,
            list.map((e): DictEntry => {
              const { cedict: from, word } = origin.get(e) ?? {};
              const meaning = word?.[lang];
              const first = word !== undefined && !meant.has(word);
              if (word) meant.add(word);
              const defs = from
                ? (from.tr?.[lang] ?? (wordMeanings && first && meaning ? [meaning] : undefined))
                : meaning
                  ? [meaning]
                  : undefined;
              const h = reading?.(e.t, e.p);
              return { ...e, ...(defs?.length ? { d: defs } : { en: 1 }), ...(h ? { h } : {}) };
            }),
          ];
        }),
      ),
    );
  }
  return { shards, localized, maxLength, entries };
}
