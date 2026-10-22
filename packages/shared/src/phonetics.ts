// Numbered pinyin ("ni3 hao3") → tone-marked pinyin and Zhuyin (Bopomofo).
// One syllable per character, tones 1–4, 5 = neutral.

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface Syllable {
  /** Initial consonant as written in pinyin ('' for none). */
  initial: string;
  /** Canonical final: y/w spellings expanded, iu→iou, ui→uei, un→uen, u→ü after j/q/x. */
  final: string;
  tone: Tone;
  /** Surface spelling without tone, e.g. "lü", "you", "jun", "huar". */
  spelling: string;
  /** Erhua written onto the syllable (huar, wanr): 兒 merged in, ㄦ after the Zhuyin. */
  erhua?: boolean;
}

export interface ZhuyinSyllable {
  /** Zhuyin letters without the tone mark, e.g. "ㄋㄧ". */
  body: string;
  /** "" (1st), "ˊ", "ˇ", "ˋ" or "˙" (neutral). */
  tone: string;
}

const INITIALS = [
  'zh', 'ch', 'sh',
  'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's',
]; // prettier-ignore

const ZHUYIN_INITIALS: Record<string, string> = {
  b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ',
  g: 'ㄍ', k: 'ㄎ', h: 'ㄏ', j: 'ㄐ', q: 'ㄑ', x: 'ㄒ',
  zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ',
}; // prettier-ignore

const ZHUYIN_FINALS: Record<string, string> = {
  '': '',
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ê: 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ',
  an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', ong: 'ㄨㄥ', er: 'ㄦ',
  i: 'ㄧ', ia: 'ㄧㄚ', io: 'ㄧㄛ', ie: 'ㄧㄝ', iai: 'ㄧㄞ', iao: 'ㄧㄠ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ',
  iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', uen: 'ㄨㄣ',
  uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  ü: 'ㄩ', üe: 'ㄩㄝ', üan: 'ㄩㄢ', ün: 'ㄩㄣ',
}; // prettier-ignore

/** Syllables written with y/w and no other initial. */
const Y_W: Record<string, string> = {
  yi: 'i', ya: 'ia', yo: 'io', ye: 'ie', yai: 'iai', yao: 'iao', you: 'iou', yan: 'ian', yin: 'in',
  yang: 'iang', ying: 'ing', yong: 'iong',
  yu: 'ü', yue: 'üe', yuan: 'üan', yun: 'ün',
  wu: 'u', wa: 'ua', wo: 'uo', wai: 'uai', wei: 'uei', wan: 'uan', wen: 'uen',
  wang: 'uang', weng: 'ueng',
}; // prettier-ignore

const ZHUYIN_TONES = ['', 'ˊ', 'ˇ', 'ˋ', '˙'];

const TONE_MARKS: Record<string, readonly string[]> = {
  a: [...'āáǎà'], e: [...'ēéěè'], i: [...'īíǐì'], o: [...'ōóǒò'], u: [...'ūúǔù'], ü: [...'ǖǘǚǜ'],
  // ê has no precomposed 1st and 3rd tone letters, so those take a combining mark.
  ê: ['ê\u0304', 'ế', 'ê\u030c', 'ề'],
}; // prettier-ignore

/** Initials after which a bare "i" is the "silent" apical vowel (zhi, si...). */
const APICAL = new Set(['zh', 'ch', 'sh', 'r', 'z', 'c', 's']);

export function parseSyllable(input: string): Syllable {
  const raw = input.trim().toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const match = /^([a-zêü]+)([1-5])$/.exec(raw);
  if (!match) throw new Error(`Invalid pinyin syllable "${input}": expected letters + tone 1–5`);
  const [, written = '', digit] = match;
  const tone = Number(digit) as Tone;
  // 兒 written apart as a bare "r" (CC-CEDICT's "yi1 kuai4 r5") is the syllable er.
  if (written === 'r') return { initial: '', final: 'er', tone, spelling: 'r' };
  // Erhua written onto a syllable (huar4, wanr2, ger4); "er" itself is 二/兒.
  const erhua = written !== 'er' && written.endsWith('r');
  const letters = erhua ? written.slice(0, -1) : written;

  const initial = INITIALS.find((i) => letters.startsWith(i) && letters.length > i.length) ?? '';
  let rest = letters.slice(initial.length);

  if (!initial && (rest.startsWith('y') || rest.startsWith('w'))) {
    // Allow an explicit ü after y ("yü") as well as the standard "yu".
    const mapped = Y_W[rest.replace(/^yü/, 'yu')];
    if (mapped === undefined) throw new Error(`Invalid pinyin syllable "${input}"`);
    rest = mapped;
  } else if (initial === 'j' || initial === 'q' || initial === 'x') {
    if (rest.startsWith('u')) rest = 'ü' + rest.slice(1);
    if (!rest.startsWith('i') && !rest.startsWith('ü')) {
      throw new Error(`Invalid pinyin syllable "${input}": j/q/x need i or ü`);
    }
  }

  if (initial) {
    if (rest === 'iu') rest = 'iou';
    else if (rest === 'ui') rest = 'uei';
    else if (rest === 'un') rest = 'uen';
    else if (rest === 'i' && APICAL.has(initial)) rest = '';
  }

  if (!(rest in ZHUYIN_FINALS) || (rest === '' && !initial)) {
    throw new Error(`Invalid pinyin syllable "${input}"`);
  }

  // Standard spelling writes ü as u after j/q/x/y.
  const spelling = written.replace(/^([jqxy])ü/, '$1u');
  return { initial, final: rest, tone, spelling, ...(erhua ? { erhua } : {}) };
}

export function splitSyllables(pinyin: string): string[] {
  return pinyin.trim().split(/\s+/).filter(Boolean);
}

function markSyllable({ spelling, tone }: Syllable): string {
  if (tone === 5) return spelling;
  let index: number;
  if (/[aeê]/.test(spelling)) index = spelling.search(/[aeê]/);
  else if (spelling.includes('ou')) index = spelling.indexOf('o');
  else {
    index = -1;
    for (let i = spelling.length - 1; i >= 0; i--) {
      if ('iouü'.includes(spelling.charAt(i))) {
        index = i;
        break;
      }
    }
  }
  if (index < 0) return spelling;
  const vowel = spelling.charAt(index);
  const marked = TONE_MARKS[vowel]?.[tone - 1] ?? vowel;
  return spelling.slice(0, index) + marked + spelling.slice(index + 1);
}

/** "ni3 hao3" → ["nǐ", "hǎo"] */
export function toToneMarkedSyllables(pinyin: string): string[] {
  return splitSyllables(pinyin).map((s) => markSyllable(parseSyllable(s)));
}

/** "ni3 hao3" → "nǐ hǎo" */
export function toToneMarked(pinyin: string): string {
  return toToneMarkedSyllables(pinyin).join(' ');
}

/** Syllables of one word, joined; an apostrophe marks a later syllable starting with a, o or e. */
function joinWord(syllables: readonly Syllable[]): string {
  return syllables
    .map((s, i) => (i > 0 && /^[aoeê]/.test(s.spelling) ? "'" : '') + markSyllable(s))
    .join('');
}

/** One word as written in pinyin: "jie2 yun4" → "jiéyùn", "xi1 an1" → "xī'ān". */
export function pinyinWord(pinyin: string): string {
  return joinWord(splitSyllables(pinyin).map(parseSyllable));
}

export function syllableToZhuyin(syllable: string): ZhuyinSyllable {
  const { initial, final, tone, erhua } = parseSyllable(syllable);
  // b/p/m/f + o is ㄛ directly; every other final maps from the table.
  const body =
    (ZHUYIN_INITIALS[initial] ?? '') + (ZHUYIN_FINALS[final] ?? '') + (erhua ? 'ㄦ' : '');
  return { body, tone: ZHUYIN_TONES[tone - 1] ?? '' };
}

/** "ni3 hao3" → [{ body: "ㄋㄧ", tone: "ˇ" }, { body: "ㄏㄠ", tone: "ˇ" }] */
export function toZhuyin(pinyin: string): ZhuyinSyllable[] {
  return splitSyllables(pinyin).map(syllableToZhuyin);
}

/** Flat Zhuyin text, neutral tone mark first as in print: "ㄋㄧˇ ㄏㄠˇ", "˙ㄇㄚ". */
export function zhuyinString(pinyin: string): string {
  return toZhuyin(pinyin)
    .map(({ body, tone }) => (tone === '˙' ? tone + body : body + tone))
    .join(' ');
}

// ---- Sentences ----

type Attach = 'open' | 'close' | 'join' | 'dash';

/** Punctuation in pinyin text: how it attaches to its neighbours, and how it is written there. */
const PUNCTUATION: Record<string, [Attach, string]> = {
  ',': ['close', ','], '、': ['close', ','], '.': ['close', '.'], '。': ['close', '.'],
  '?': ['close', '?'], '!': ['close', '!'], ':': ['close', ':'], ';': ['close', ';'],
  '%': ['close', '%'], '…': ['close', '…'], '⋯': ['close', '…'],
  ')': ['close', ')'], ']': ['close', ']'], '】': ['close', ']'], '〕': ['close', ']'],
  '」': ['close', '”'], '”': ['close', '”'], '』': ['close', '’'], '’': ['close', '’'],
  '》': ['close', '”'], '〉': ['close', '’'],
  '(': ['open', '('], '[': ['open', '['], '【': ['open', '['], '〔': ['open', '['],
  '「': ['open', '“'], '“': ['open', '“'], '『': ['open', '‘'], '‘': ['open', '‘'],
  '《': ['open', '“'], '〈': ['open', '‘'],
  '—': ['dash', '—'], '―': ['dash', '—'], '–': ['dash', '–'],
  '-': ['join', '-'], '~': ['join', '~'], '/': ['join', '/'],
}; // prettier-ignore

/** Middle dots between the parts of a foreign name (喬治‧華盛頓) separate words. */
const NAME_DOTS = new Set(['·', '・', '‧', '•']);

type Piece = { kind: 'word'; text: string } | { kind: Attach; text: string } | { kind: 'gap' };

const HAN_RUN = /(\p{Script=Han}+)|([^\p{Script=Han}]+)/gu;

/** Outside Chinese runs: numbers and Latin words (3.5, 10:30, LINE), whitespace, single marks. */
const LATIN_TOKEN =
  /[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]+(?:[.,:'’．，：][0-9A-Za-z０-９Ａ-Ｚａ-ｚ]+)*|\s+|./gsu;

/** Fullwidth ASCII (，？！２０ＡＢ) as plain ASCII. */
const halfwidth = (text: string) =>
  text.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** True when `lengths` split every run of Chinese characters exactly. */
function splitsRuns(
  lengths: readonly number[] | undefined,
  runs: readonly number[],
): lengths is readonly number[] {
  if (!lengths) return false;
  let i = 0;
  for (const run of runs) {
    for (let left = run; left > 0;) {
      const n = lengths[i++];
      if (n === undefined || !Number.isInteger(n) || n < 1 || n > left) return false;
      left -= n;
    }
  }
  return i === lengths.length;
}

/**
 * A sentence as words and punctuation. Each Chinese character takes the next syllable; characters
 * are grouped into words by `wordLengths` (characters per word), or one per word when the lengths
 * are missing or don't fit the text.
 */
function sentencePieces(
  text: string,
  pinyin: string,
  wordLengths: readonly number[] | undefined,
  word: (syllables: string[]) => string,
  punctuation: (char: string, dq: boolean) => Piece,
): Piece[] {
  const syllables = splitSyllables(pinyin);
  const runs = [...text.matchAll(HAN_RUN)];
  const hanRuns = runs.flatMap((r) => (r[1] ? [[...r[1]].length] : []));
  const han = hanRuns.reduce((a, b) => a + b, 0);
  if (han !== syllables.length) {
    throw new Error(`${han} characters but ${syllables.length} syllables in "${text}"`);
  }
  const lengths = splitsRuns(wordLengths, hanRuns) ? wordLengths : syllables.map(() => 1);

  const pieces: Piece[] = [];
  let s = 0;
  let w = 0;
  let dq = false;
  for (const [, hanRun, other] of runs) {
    if (hanRun) {
      for (let left = [...hanRun].length; left > 0;) {
        const n = lengths[w++] ?? 1;
        pieces.push({ kind: 'word', text: word(syllables.slice(s, s + n)) });
        s += n;
        left -= n;
      }
      continue;
    }
    for (const [token] of (other ?? '').matchAll(LATIN_TOKEN)) {
      if (/^\s/.test(token) || NAME_DOTS.has(token)) pieces.push({ kind: 'gap' });
      else if (/^[0-9A-Za-z０-９Ａ-Ｚａ-ｚ]/.test(token))
        pieces.push({ kind: 'word', text: token });
      else {
        const piece = punctuation(token, dq);
        if (halfwidth(token) === '"') dq = !dq;
        pieces.push(piece);
      }
    }
  }
  return pieces;
}

/**
 * A sentence in pinyin: words separated by spaces, syllables of a word joined, punctuation in its
 * Latin form attached to the word before it, digits and Latin letters kept, and each sentence
 * capitalized. "你好，我是小明。" with lengths [2, 1, 1, 2] → "Nǐhǎo, wǒ shì xiǎomíng."
 */
export function pinyinSentence(
  text: string,
  pinyin: string,
  wordLengths?: readonly number[],
): string {
  const pieces = sentencePieces(
    text,
    pinyin,
    wordLengths,
    (syllables) => joinWord(syllables.map(parseSyllable)),
    (char, dq): Piece => {
      const c = halfwidth(char);
      if (c === '"') return { kind: dq ? 'close' : 'open', text: dq ? '”' : '“' };
      const known = PUNCTUATION[c];
      return known ? { kind: known[0], text: known[1] } : { kind: 'word', text: c };
    },
  );

  let out = '';
  let prev: 'start' | Piece['kind'] = 'start';
  let capital = true;
  let colon = false;
  const spaced = () => prev === 'word' || prev === 'close' || prev === 'dash' || prev === 'gap';
  for (const piece of pieces) {
    switch (piece.kind) {
      case 'gap':
        if (prev !== 'start' && prev !== 'open' && prev !== 'join') prev = 'gap';
        continue;
      case 'word': {
        const word = halfwidth(piece.text);
        const text = capital ? word.charAt(0).toUpperCase() + word.slice(1) : word;
        out += (spaced() ? ' ' : '') + text;
        capital = false;
        colon = false;
        break;
      }
      case 'close':
        out += piece.text;
        if ('.?!'.includes(piece.text)) capital = true;
        colon = piece.text === ':';
        break;
      case 'open':
        out += (spaced() ? ' ' : '') + piece.text;
        // A quotation after a colon starts a new sentence: 他說：「好！」 → Tā shuō: “Hǎo!”
        if (colon) capital = true;
        colon = false;
        break;
      case 'join':
        out += piece.text;
        break;
      case 'dash':
        out += (prev === 'start' ? '' : ' ') + piece.text;
        break;
    }
    prev = piece.kind;
  }
  return out;
}

/**
 * A sentence in Zhuyin: syllables separated by spaces, words by an ideographic space (U+3000), and
 * the original punctuation kept. "我們走吧。" with lengths [2, 1, 1] gives the words "ㄨㄛˇ ˙ㄇㄣ",
 * "ㄗㄡˇ" and "˙ㄅㄚ", then "。".
 */
export function zhuyinSentence(
  text: string,
  pinyin: string,
  wordLengths?: readonly number[],
): string {
  const pieces = sentencePieces(
    text,
    pinyin,
    wordLengths,
    (syllables) => zhuyinString(syllables.join(' ')),
    (char): Piece => ({ kind: 'close', text: char }),
  );
  let out = '';
  let between = false;
  for (const piece of pieces) {
    if (piece.kind === 'gap') continue;
    if (piece.kind === 'word') {
      out += (between ? '\u3000' : '') + piece.text;
      between = true;
    } else {
      out += piece.text;
      between = false;
    }
  }
  return out;
}

/** Tone-marked vowel → [plain vowel, tone]. Breves (ă ĭ ŏ ŭ, common in word lists) count as 3rd tone. */
const MARKED_VOWELS: ReadonlyMap<string, readonly [string, Tone]> = new Map([
  ...Object.entries(TONE_MARKS).flatMap(([vowel, marks]) =>
    marks.map((mark, i) => [mark, [vowel, (i + 1) as Tone]] as const),
  ),
  ...[...'ăĕĭŏŭ'].map((mark, i) => [mark, ['aeiou'.charAt(i), 3 as Tone]] as const),
  ['ɑ', ['a', 5 as Tone]],
]);

/**
 * One tone-marked syllable → numbered: "nǐ" → "ni3", "ma" → "ma5", "lǜ" → "lü4".
 * Unmarked syllables are neutral tone. Throws on more than one tone mark.
 */
export function fromToneMarked(syllable: string): string {
  let tone: Tone = 5;
  let marks = 0;
  let letters = '';
  // ê with a combining macron or caron is one marked vowel (no precomposed letter exists).
  const chars =
    syllable
      .trim()
      .toLowerCase()
      .normalize('NFC')
      .match(/ê[\u0304\u030c]|./gsu) ?? [];
  for (const char of chars) {
    const marked = MARKED_VOWELS.get(char);
    if (marked) {
      letters += marked[0];
      if (marked[1] !== 5) {
        tone = marked[1];
        marks++;
      }
    } else letters += char;
  }
  if (marks > 1) throw new Error(`More than one tone mark in "${syllable}"`);
  return letters.replace(/v|u:/g, 'ü') + tone;
}

const PINYIN_INITIAL = new Map(Object.entries(ZHUYIN_INITIALS).map(([py, zy]) => [zy, py]));
const PINYIN_FINAL = new Map(
  Object.entries(ZHUYIN_FINALS)
    .filter(([py]) => py !== 'ong') // ㄨㄥ is "ong" after an initial, "weng" alone
    .map(([py, zy]) => [zy, py]),
);
const W_Y = new Map(Object.entries(Y_W).map(([spelling, final]) => [final, spelling]));

/**
 * One Zhuyin syllable → numbered pinyin: "ㄋㄧˇ" → "ni3", "˙ㄇㄚ" → "ma5", "ㄓ" → "zhi1".
 * The neutral-tone dot may come first (as printed) or last; a first-tone ˉ is accepted. Erhua
 * written onto the syllable, before or after the tone ("ㄏㄨㄚˋㄦ", "ㄏㄨㄚㄦˋ"), gives "huar4".
 */
export function fromZhuyin(syllable: string): string {
  let text = syllable.trim();
  let erhua = false;
  if (text.length > 1 && text.endsWith('ㄦ') && !/^[˙ˉˊˇˋ]?ㄦ$/.test(text)) {
    erhua = true;
    text = text.slice(0, -1);
  }
  let tone: Tone = 1;
  if (text.startsWith('˙') || text.endsWith('˙')) {
    tone = 5;
    text = text.replace('˙', '');
  } else if (text.endsWith('ˉ')) {
    text = text.slice(0, -1);
  } else {
    const index = ZHUYIN_TONES.indexOf(text.slice(-1));
    if (index > 0) {
      tone = (index + 1) as Tone;
      text = text.slice(0, -1);
    }
  }
  if (!erhua && text.length > 1 && text.endsWith('ㄦ')) {
    erhua = true;
    text = text.slice(0, -1);
  }
  const first = text.charAt(0);
  const initial = PINYIN_INITIAL.get(first) ?? '';
  const rest = initial ? text.slice(1) : text;
  let final = PINYIN_FINAL.get(rest);
  if (final === undefined) throw new Error(`Invalid Zhuyin syllable "${syllable}"`);
  if (!initial && !rest) throw new Error(`Invalid Zhuyin syllable "${syllable}"`);

  let spelling: string;
  if (!initial) spelling = W_Y.get(final) ?? final;
  else {
    if (final === 'ueng') final = 'ong';
    if (final === '' && APICAL.has(initial)) final = 'i';
    else if (final === 'iou') final = 'iu';
    else if (final === 'uei') final = 'ui';
    else if (final === 'uen') final = 'un';
    if ('jqx'.includes(initial)) final = final.replace('ü', 'u');
    spelling = initial + final;
  }
  return spelling + (erhua ? 'r' : '') + tone;
}

/** Lowercase pinyin letters only, for search: "Nǐ hǎo" / "ni3 hao3" → "nihao". */
export function plainPinyin(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
