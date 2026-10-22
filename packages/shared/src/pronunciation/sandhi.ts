// Tone sandhi: the tones a syllable is actually spoken with, from citation tones.
//   3 + 3      → 2 + 3        (你好 nǐhǎo → níhǎo; in a run, every 3rd tone but the last)
//   不 + 4     → bú            (不要 búyào)
//   一 + 4     → yí            (一個 yígè)
//   一 + 1/2/3 → yì            (一天 yìtiān)
// 一 keeps yī when it is the number one rather than "a": at the end, in numbers and digit strings
// (十一, 一九九八), as an ordinal or a day (第一, 星期一, 初一, 一月, 一號) and in a few words
// (唯一, 統一). Punctuation is a pause: no sandhi across it.

import { parseSyllable, splitSyllables, type Tone } from '../phonetics.ts';

const HAN = /\p{Script=Han}/u;
/** Before 一, these make it a number: 十一, 第一, 萬一. */
const NUMBER_BEFORE = /[十〇零一二三四五六七八九百千萬第]/;
/** After 一, digits read one by one (一九九八, 一二三), or a date (一月, 一號). */
const NUMBER_AFTER = /[〇零一二三四五六七八九月號]/;
/** Words ending in 一 that keep yī before anything: 星期一下午, 統一發票. */
const YI_WORDS = ['星期', '禮拜', '週', '周', '初', '唯', '統', '單'];

/**
 * Spoken tones of `pinyin` (one syllable per Chinese character of `hanzi`; other characters in
 * `hanzi`, such as punctuation, are pauses).
 */
export function surfaceTones(hanzi: string, pinyin: string): Tone[] {
  // Each Chinese character, and whether a pause (punctuation, a space) comes after it.
  const chars: string[] = [];
  const pauseAfter: boolean[] = [];
  for (const c of hanzi) {
    if (HAN.test(c)) {
      chars.push(c);
      pauseAfter.push(false);
    } else if (chars.length) pauseAfter[chars.length - 1] = true;
  }
  const tones = splitSyllables(pinyin).map((s) => parseSyllable(s).tone);
  const result = [...tones];
  const joined = (i: number) => i + 1 < tones.length && !pauseAfter[i];

  // Third-tone runs: all but the last become rising.
  for (let i = 0; i < tones.length - 1; i++) {
    if (tones[i] === 3 && tones[i + 1] === 3 && joined(i)) result[i] = 2;
  }
  tones.forEach((tone, i) => {
    if (!joined(i)) return;
    const next = tones[i + 1];
    const char = chars[i];
    if (char === '不' && tone === 4 && next === 4) result[i] = 2;
    if (char === '一' && tone === 1 && next !== 5) {
      // What comes before counts only without a pause in between.
      const before = i > 0 && !pauseAfter[i - 1] ? chars.slice(0, i).join('') : '';
      const number =
        NUMBER_BEFORE.test(before.slice(-1)) ||
        NUMBER_AFTER.test(chars[i + 1] ?? '') ||
        YI_WORDS.some((w) => before.endsWith(w));
      if (!number) result[i] = next === 4 ? 2 : 4;
    }
  });
  return result;
}
