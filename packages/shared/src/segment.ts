// Word segmentation for Chinese text against a lexicon: the split with the fewest words, ties
// broken by word weight (e.g. corpus frequency). Non-Chinese runs stay whole.

export interface Token {
  text: string;
  /** Code-unit offset in the input. */
  start: number;
  /** A run of Chinese characters (a word or an unknown character), not punctuation or Latin. */
  han: boolean;
  /** Found in the lexicon. */
  known: boolean;
}

export interface Lexicon {
  has(word: string): boolean;
  /** Longest entry, in characters. */
  maxLength: number;
  /** Higher is better; used to break ties between equally short splits. */
  weight?(word: string): number;
}

export function segment(text: string, lexicon: Lexicon): Token[] {
  const tokens: Token[] = [];
  // Split into Han runs and everything else; keep offsets.
  for (const run of text.matchAll(/(\p{Script=Han}+)|([^\p{Script=Han}]+)/gu)) {
    const start = run.index;
    if (run[2] !== undefined) {
      tokens.push({ text: run[2], start, han: false, known: false });
      continue;
    }
    tokens.push(...segmentHan(run[1] ?? '', start, lexicon));
  }
  return tokens;
}

function segmentHan(run: string, offset: number, lexicon: Lexicon): Token[] {
  const chars = [...run];
  const n = chars.length;
  // best[i]: fewest tokens for chars[i..], then highest weight.
  const count = new Array<number>(n + 1).fill(Infinity);
  const weight = new Array<number>(n + 1).fill(0);
  const next = new Array<number>(n + 1).fill(n);
  count[n] = 0;
  for (let i = n - 1; i >= 0; i--) {
    for (let len = Math.min(lexicon.maxLength, n - i); len >= 1; len--) {
      const word = chars.slice(i, i + len).join('');
      const known = lexicon.has(word);
      if (!known && len > 1) continue;
      // An unknown single character costs a little more than a known one.
      const c = (count[i + len] ?? 0) + (known ? 1 : 1.01);
      const w = (weight[i + len] ?? 0) + (known ? (lexicon.weight?.(word) ?? 0) : 0);
      if (
        c < (count[i] ?? Infinity) - 1e-9 ||
        (Math.abs(c - (count[i] ?? 0)) < 1e-9 && w > (weight[i] ?? 0))
      ) {
        count[i] = c;
        weight[i] = w;
        next[i] = i + len;
      }
    }
  }
  const tokens: Token[] = [];
  let units = offset;
  for (let i = 0; i < n; i = next[i] ?? n) {
    const text = chars.slice(i, next[i]).join('');
    tokens.push({ text, start: units, han: true, known: lexicon.has(text) });
    units += text.length;
  }
  return tokens;
}

/** Longest lexicon entry starting at `index` (code units) in `text`, e.g. for a tapped character. */
export function longestMatchAt(
  text: string,
  index: number,
  lexicon: Pick<Lexicon, 'has' | 'maxLength'>,
): string {
  const chars = [...text.slice(index)];
  for (let len = Math.min(lexicon.maxLength, chars.length); len > 1; len--) {
    const word = chars.slice(0, len).join('');
    if (lexicon.has(word)) return word;
  }
  return chars[0] ?? '';
}
