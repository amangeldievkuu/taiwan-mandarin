// CVDICT (CC BY-SA 4.0, Phong Phan): CC-CEDICT translated into Vietnamese line by line. Its lines
// keep CC-CEDICT's keys ("學生 学生 [xue2 sheng5]"), so they join exactly, and its definitions get
// the same clean-up as CC-CEDICT's. Measure words ("LT:") and Taiwan readings come from CC-CEDICT.

import { readFileSync } from 'node:fs';
import { cleanDefinition, type CedictEntry } from './cedict.ts';

const LINE = /^(\S+ \S+ \[[^\]]*\]) \/(.*)\/$/;

/** A reading in brackets with no headword just before it, so not a cross-reference: "[le4 se4]". */
const BARE_READING = /(?:^|[^\p{Script=Han}|A-Za-z])\[[a-zü:]+[1-5](?: ?[a-zü:]+[1-5])*\]/iu;

/**
 * CC-CEDICT's "Taiwan pr. [le4 se4]", which CVDICT words many ways ("phiên âm Đài Loan [le4 se4]",
 * "tiếng Đài Loan đọc là [le4 se4]", "cách phát âm ở Đài Loan: [le4 se4]"…).
 */
export const isTaiwanReadingNote = (def: string): boolean =>
  /Đài Loan/i.test(def) && BARE_READING.test(def);

/** One CVDICT line → its CC-CEDICT key and cleaned Vietnamese definitions. */
export function parseCvdictLine(line: string): [key: string, defs: string[]] | undefined {
  const match = LINE.exec(line.trim());
  if (!match) return undefined;
  const defs = (match[2] ?? '')
    .split('/')
    .filter((d) => d && !d.startsWith('LT:') && !isTaiwanReadingNote(d))
    .map(cleanDefinition)
    .filter(Boolean);
  return [match[1] ?? '', defs];
}

export function readCvdict(path: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const parsed = parseCvdictLine(line);
    if (parsed && parsed[1].length && !map.has(parsed[0])) map.set(...parsed);
  }
  return map;
}

/** Gives CC-CEDICT entries their Vietnamese definitions. Returns how many CVDICT has. */
export function attachVietnamese(
  cedict: readonly CedictEntry[],
  cvdict: ReadonlyMap<string, string[]>,
): number {
  let found = 0;
  for (const e of cedict) {
    const vi = cvdict.get(e.key);
    if (vi) {
      e.vi = vi;
      found++;
    }
  }
  return found;
}
