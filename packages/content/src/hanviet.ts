// Sino-Vietnamese (Hán-Việt) readings from data/hanviet.json, one per character as Mandarin reads
// it: "國" → "quốc"; "好|hao3" → "hảo", "好|hao4" → "hiếu" where the readings differ; null where a
// character has none worth showing (particles such as 喔). Written by translate.ts.

import { existsSync, readFileSync } from 'node:fs';
import { splitSyllables } from '@taiwan-mandarin/shared';

/** Character → (numbered syllable or "" for any reading) → reading, null for none. */
export type HanVietTable = ReadonlyMap<string, ReadonlyMap<string, string | null>>;

export function readHanViet(path: string): HanVietTable {
  const table = new Map<string, Map<string, string | null>>();
  if (!existsSync(path)) return table;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string | null>;
  for (const [key, reading] of Object.entries(raw)) {
    const [char = '', syllable = ''] = key.split('|');
    let readings = table.get(char);
    if (!readings) table.set(char, (readings = new Map()));
    readings.set(syllable, reading);
  }
  return table;
}

/**
 * One character's reading as read here: the entry for this syllable (好 hao4), else for the same
 * syllable in any tone (朋友's neutral you5 → you3), else the character's only one. Undefined when
 * the table doesn't know it; null when it has none.
 */
export function charHanViet(
  table: HanVietTable,
  char: string,
  syllable: string,
): string | null | undefined {
  const readings = table.get(char);
  if (!readings) return undefined;
  const exact = readings.get(syllable);
  if (exact !== undefined) return exact;
  const toneless = syllable.replace(/[1-5]$/, '');
  for (const [key, reading] of readings) if (key.replace(/[1-5]$/, '') === toneless) return reading;
  return readings.get('');
}

/** A word's reading, "quốc gia" for 國家; undefined when any character has none. */
export function hanViet(table: HanVietTable, hanzi: string, pinyin: string): string | undefined {
  const chars = [...hanzi];
  const syllables = splitSyllables(pinyin);
  if (chars.length !== syllables.length) return undefined;
  const readings: string[] = [];
  for (const [i, char] of chars.entries()) {
    const reading = charHanViet(table, char, syllables[i] ?? '');
    if (!reading) return undefined;
    readings.push(reading);
  }
  return readings.join(' ');
}
