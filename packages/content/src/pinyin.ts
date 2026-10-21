// Splits run-together tone-marked pinyin from the word lists ("zuòyòumíng", "bàba / bà",
// "yīdiǎnr") into numbered syllables aligned with the characters of a headword.

import { fromToneMarked } from '@taiwan-mandarin/shared';

export interface PinyinContext {
  /** Valid toneless syllables, e.g. from CC-CEDICT. */
  inventory: ReadonlySet<string>;
  /** Character → toneless readings it is known to have; used to pick between valid splits. */
  readings: ReadonlyMap<string, ReadonlySet<string>>;
}

interface Letter {
  char: string;
  /** 1–4 when the letter carries a tone mark. */
  tone?: number;
  /** A space or apostrophe precedes this letter: a syllable must start here. */
  boundary: boolean;
}

function letters(text: string): Letter[] {
  const out: Letter[] = [];
  let boundary = true;
  for (const raw of text.toLowerCase().normalize('NFC')) {
    if (/[\s'’\u200b-]/.test(raw)) {
      boundary = true;
      continue;
    }
    const numbered = fromToneMarked(raw);
    const char = numbered.slice(0, -1);
    const tone = Number(numbered.slice(-1));
    if (!/^[a-zü]$/.test(char))
      throw new Error(`Unexpected character "${raw}" in pinyin "${text}"`);
    out.push({ char, tone: tone === 5 ? undefined : tone, boundary });
    boundary = false;
  }
  return out;
}

interface Split {
  syllables: string[];
  score: number;
}

/**
 * Numbered pinyin for `hanzi` ("ni3 hao3") and how well it fits the characters' known readings,
 * or undefined when `text` can't be split into one syllable per character. An erhua syllable ("diǎnr") before 兒 becomes "dian3 er5".
 */
export function alignPinyin(
  text: string,
  hanzi: string,
  ctx: PinyinContext,
): { pinyin: string; score: number } | undefined {
  const chars = [...hanzi];
  let input: Letter[];
  try {
    input = letters(text);
  } catch {
    return undefined;
  }
  const memo = new Map<string, Split | null>();

  const solve = (pos: number, slot: number): Split | null => {
    if (pos === input.length) return slot === chars.length ? { syllables: [], score: 0 } : null;
    if (slot >= chars.length) return null;
    const key = `${pos},${slot}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;

    let best: Split | null = null;
    for (let end = pos + 1; end <= Math.min(input.length, pos + 7); end++) {
      const piece = input.slice(pos, end);
      // A space or apostrophe can't fall inside a syllable.
      if (piece.slice(1).some((l) => l.boundary)) break;
      const marks = piece.filter((l) => l.tone !== undefined);
      if (marks.length > 1) continue;
      const spelled = piece.map((l) => l.char).join('');
      const tone = marks[0]?.tone ?? 5;

      const options: { syllables: string[]; slots: number; base: string }[] = [];
      if (ctx.inventory.has(spelled)) {
        options.push({ syllables: [spelled + tone], slots: 1, base: spelled });
      }
      // Erhua: "dianr" followed by 兒 in the headword.
      const stem = spelled.slice(0, -1);
      if (
        spelled.endsWith('r') &&
        stem !== 'e' &&
        ctx.inventory.has(stem) &&
        chars[slot + 1] === '兒'
      ) {
        options.push({ syllables: [stem + tone, 'er5'], slots: 2, base: stem });
      }

      for (const option of options) {
        const rest = solve(end, slot + option.slots);
        if (!rest) continue;
        const char = chars[slot] ?? '';
        const known = ctx.readings.get(char);
        let score = rest.score;
        if (known?.has(option.base)) score += 10;
        else if (known) score -= 10;
        // Written pinyin puts an apostrophe before a/o/e mid-word; prefer splits that don't need one.
        if (pos > 0 && /^[aoe]/.test(option.base) && !input[pos]?.boundary) score -= 3;
        if (!best || score > best.score)
          best = { syllables: [...option.syllables, ...rest.syllables], score };
      }
    }
    memo.set(key, best);
    return best;
  };

  const best = solve(0, 0);
  return best ? { pinyin: best.syllables.join(' '), score: best.score } : undefined;
}
