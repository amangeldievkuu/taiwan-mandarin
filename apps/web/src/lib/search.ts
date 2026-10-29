// Finding study-path words by characters, toneless pinyin or meaning. Typed without accents, a
// meaning matches loosely ("hoc sinh" finds "học sinh"); typed with them, exactly ("bạn" finds
// 朋友, not 班 ban). Russian matches ё and е either way ("елка" and "ёлка"). Text that can only be
// Vietnamese, and Russian, is never read as pinyin.

import { foldLatin, looksVietnamese, plainPinyin, type SearchRow } from '@taiwan-mandarin/shared';

export interface SearchIndex {
  rows: SearchRow[];
  /** Each row's gloss, lowercase (NFC), for matching what was typed exactly. */
  glosses: string[];
  /** Each row's gloss without accents. */
  folded: string[];
  /** Each row's Sino-Vietnamese reading, lowercase ("" if none). */
  hanViet: string[];
  /** The same without accents. */
  hanVietFolded: string[];
}

/** Folds the rows once, when they load. */
export function indexRows(rows: SearchRow[]): SearchIndex {
  return {
    rows,
    glosses: rows.map((r) => r[3].normalize('NFC').toLowerCase()),
    folded: rows.map((r) => foldLatin(r[3])),
    hanViet: rows.map((r) => (r[4] ?? '').normalize('NFC').toLowerCase()),
    hanVietFolded: rows.map((r) => foldLatin(r[4] ?? '')),
  };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches `word` as a whole word. */
const wholeWord = (word: string) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'u');
/** Where the whole word stands in `text`, or -1. */
function wordAt(text: string, pattern: RegExp): number {
  const match = pattern.exec(text);
  return match ? match.index + (match[1]?.length ?? 0) : -1;
}

/**
 * Rows matching a query, best first: characters (the whole word, then a prefix, then anywhere);
 * otherwise the exact toneless pinyin, a pinyin prefix, a word of the meaning, then the
 * Sino-Vietnamese reading. Ties keep path order (easier levels first).
 */
export function searchRows(index: SearchIndex, query: string, limit = 40): SearchRow[] {
  const q = query.trim();
  if (!q) return [];
  const scored: [number, SearchRow][] = [];
  const { rows } = index;
  if (/\p{Script=Han}/u.test(q)) {
    for (const row of rows) {
      const at = row[1].indexOf(q);
      if (at >= 0) scored.push([(row[1] === q ? 0 : at === 0 ? 1 : 2) * 100 + row[1].length, row]);
    }
  } else {
    const plain = looksVietnamese(q) ? '' : plainPinyin(q);
    const typed = q.normalize('NFC').toLowerCase();
    const folded = foldLatin(q);
    // Latin accents tell Vietnamese words apart; Russian's ё is often written е.
    const accented = /\p{Script=Latin}/u.test(q) && folded !== typed;
    const glosses = accented ? index.glosses : index.folded;
    const hanViet = accented ? index.hanViet : index.hanVietFolded;
    const word = accented ? typed : folded;
    const pattern = wholeWord(word);
    rows.forEach((row, i) => {
      if (plain && row[2] === plain) return scored.push([0, row]);
      if (plain && row[2].startsWith(plain)) return scored.push([1 + row[2].length / 100, row]);
      const at = wordAt(glosses[i] ?? '', pattern);
      if (at >= 0) return scored.push([2 + at / 1000, row]);
      if (word && wordAt(hanViet[i] ?? '', pattern) >= 0) scored.push([3, row]);
    });
  }
  return scored
    .sort((a, b) => a[0] - b[0])
    .slice(0, limit)
    .map(([, row]) => row);
}
