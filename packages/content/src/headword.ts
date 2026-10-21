// Headword cells from the word lists → written forms and readings.
//
//   "爸爸/爸"          → 爸爸, 爸
//   "小孩(子)"         → 小孩, 小孩子 (optional part)
//   "名字(˙ㄗ)"        → 名字 (Zhuyin annotations dropped; the reading column has them)
//   "bàba/bà", "xiăohái(zi)", "ㄅㄚˋ ˙ㄅㄚ / ㄅㄚˋ"

import { fromZhuyin } from '@taiwan-mandarin/shared';
import { alignPinyin, type PinyinContext } from './pinyin.ts';

export interface Form {
  text: string;
  /** Position of the "/"-separated variant in the cell (0 = listed first). */
  order: number;
  /** Built from an optional "(…)" part: "full" includes it, "base" leaves it out. */
  optional?: 'base' | 'full';
  /** Length of the text outside the optional part. */
  baseLength: number;
}

const ZHUYIN_ANNOTATION = /[（(]\s*[˙ㄅ-ㄩˊˇˋ][^)）]*[)）]/g;
const PRIVATE_USE = /[\ue000-\uf8ff\u200b]/g;

/** Splits "a/b(c)" into variants and expands optional parts, as text. */
function expand(
  cell: string,
): { text: string; order: number; optional?: 'base' | 'full'; baseLength: number }[] {
  return cell
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .split('/')
    .map((v) => v.trim())
    .filter(Boolean)
    .flatMap((variant, order) => {
      const match = /^(.*?)\((.+?)\)(.*)$/.exec(variant);
      if (!match)
        return [{ text: variant.replace(/\s+/g, ''), order, baseLength: [...variant].length }];
      const [, before = '', inside = '', after = ''] = match;
      const base = (before + after).replace(/\s+/g, '');
      const full = (before + inside + after).replace(/\s+/g, '');
      return [
        { text: base, order, optional: 'base' as const, baseLength: [...base].length },
        { text: full, order, optional: 'full' as const, baseLength: [...base].length },
      ];
    });
}

export function parseForms(cell: string): Form[] {
  const cleaned = cell.replace(PRIVATE_USE, '').replace(ZHUYIN_ANNOTATION, '');
  const seen = new Set<string>();
  return expand(cleaned).filter((f) => f.text && !seen.has(f.text) && seen.add(f.text));
}

/** Readings in a pinyin cell, e.g. "xiăohái(zi) " → ["xiăohái", "xiăoháizi"]. */
export function pinyinVariants(cell: string): string[] {
  return expand(cell.replace(PRIVATE_USE, '')).map((v) => v.text);
}

/** Zhuyin cell variants as numbered syllable lists: "ㄅㄚˋ ˙ㄅㄚ / ㄅㄚˋ" → [["ba4","ba5"],["ba4"]]. */
export function zhuyinVariants(cell: string): string[][] {
  return cell
    .replace(PRIVATE_USE, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .split('/')
    .flatMap((variant) => {
      const match = /^(.*?)\((.+?)\)(.*)$/.exec(variant);
      return match ? [`${match[1]} ${match[3]}`, `${match[1]} ${match[2]} ${match[3]}`] : [variant];
    })
    .map((variant) => {
      try {
        return variant
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .flatMap((syllable) =>
            // Erhua written onto the syllable: "ㄏㄨㄟˇㄦ" → hui3 + er5
            syllable.length > 1 && syllable.endsWith('ㄦ')
              ? [fromZhuyin(syllable.slice(0, -1)), 'er5']
              : [fromZhuyin(syllable)],
          );
      } catch {
        return [];
      }
    })
    .filter((syllables) => syllables.length > 0);
}

/** Taiwan dictionaries list 一 and 不 in citation tone; some lists print the sandhi tone instead. */
export function citationTones(hanzi: string, pinyin: string): string {
  const chars = [...hanzi];
  return pinyin
    .split(' ')
    .map((syllable, i) => {
      const char = chars[i];
      if (char === '一' && /^yi[24]$/.test(syllable)) return 'yi1';
      if (char === '不' && syllable === 'bu2') return 'bu4';
      // A bare ㄦ after a syllable is erhua, not a first-tone 兒.
      if (char === '兒' && i > 0 && syllable === 'er1') return 'er5';
      return syllable;
    })
    .join(' ');
}

/** How well a numbered reading fits the characters' known readings (+10 per match, −10 per miss). */
export function readingScore(hanzi: string, pinyin: string, ctx: PinyinContext): number {
  const chars = [...hanzi];
  return pinyin.split(' ').reduce((score, syllable, i) => {
    const known = ctx.readings.get(chars[i] ?? '');
    const base = syllable.replace(/[1-5]$/, '');
    if (!known) return score;
    return score + (known.has(base) || (chars[i] === '兒' && base === 'er') ? 10 : -10);
  }, 0);
}

/**
 * Best reading for one written form, from Zhuyin (preferred: already split into syllables) or
 * pinyin variants. Prefers the variant listed at the same position as the form.
 */
export function readForm(
  form: Form,
  cells: { pinyin?: string; zhuyin?: string },
  ctx: PinyinContext,
): string | undefined {
  const length = [...form.text].length;
  const candidates: { pinyin: string; score: number }[] = [];

  const zhuyin = cells.zhuyin ? zhuyinVariants(cells.zhuyin) : [];
  zhuyin.forEach((syllables, i) => {
    if (syllables.length !== length) return;
    const pinyin = citationTones(form.text, syllables.join(' '));
    candidates.push({
      pinyin,
      score: readingScore(form.text, pinyin, ctx) + 5 + (i === form.order ? 1 : 0),
    });
  });

  if (!candidates.some((c) => c.score > 0)) {
    (cells.pinyin ? pinyinVariants(cells.pinyin) : []).forEach((text, i) => {
      const aligned = alignPinyin(text, form.text, ctx);
      if (!aligned) return;
      const pinyin = citationTones(form.text, aligned.pinyin);
      candidates.push({
        pinyin,
        score: readingScore(form.text, pinyin, ctx) + (i === form.order ? 1 : 0),
      });
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.pinyin;
}
