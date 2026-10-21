// Tone sandhi: the tones a syllable is actually spoken with, from citation tones.
//   3 + 3      → 2 + 3        (你好 nǐhǎo → níhǎo; in a run, every 3rd tone but the last)
//   不 + 4     → bú            (不要 búyào)
//   一 + 4     → yí            (一個 yígè)
//   一 + 1/2/3 → yì            (一天 yìtiān), except at the end and in numbers like 十一, 第一

import { parseSyllable, splitSyllables, type Tone } from '../phonetics.ts';

export function surfaceTones(hanzi: string, pinyin: string): Tone[] {
  const chars = [...hanzi];
  const tones = splitSyllables(pinyin).map((s) => parseSyllable(s).tone);
  const result = [...tones];

  // Third-tone runs: all but the last become rising.
  for (let i = 0; i < tones.length - 1; i++) {
    if (tones[i] === 3 && tones[i + 1] === 3) result[i] = 2;
  }
  tones.forEach((tone, i) => {
    const next = tones[i + 1];
    const char = chars[i];
    if (char === '不' && tone === 4 && next === 4) result[i] = 2;
    if (char === '一' && tone === 1 && next !== undefined && next !== 5) {
      const ordinal =
        chars[i - 1] === '第' || /[十〇零一二三四五六七八九百千萬]/.test(chars[i - 1] ?? '');
      if (!ordinal) result[i] = next === 4 ? 2 : 4;
    }
  });
  return result;
}
