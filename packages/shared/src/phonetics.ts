// Numbered pinyin ("ni3 hao3") → tone-marked pinyin and Zhuyin (Bopomofo).
// One syllable per character, tones 1–4, 5 = neutral.

export type Tone = 1 | 2 | 3 | 4 | 5;

export interface Syllable {
  /** Initial consonant as written in pinyin ('' for none). */
  initial: string;
  /** Canonical final: y/w spellings expanded, iu→iou, ui→uei, un→uen, u→ü after j/q/x. */
  final: string;
  tone: Tone;
  /** Surface spelling without tone, e.g. "lü", "you", "jun". */
  spelling: string;
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

const TONE_MARKS: Record<string, string> = {
  a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', ü: 'ǖǘǚǜ',
}; // prettier-ignore

/** Initials after which a bare "i" is the "silent" apical vowel (zhi, si...). */
const APICAL = new Set(['zh', 'ch', 'sh', 'r', 'z', 'c', 's']);

export function parseSyllable(input: string): Syllable {
  const raw = input.trim().toLowerCase().replace(/u:/g, 'ü').replace(/v/g, 'ü');
  const match = /^([a-zêü]+)([1-5])$/.exec(raw);
  if (!match) throw new Error(`Invalid pinyin syllable "${input}": expected letters + tone 1–5`);
  const [, letters = '', digit] = match;
  const tone = Number(digit) as Tone;

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
  const spelling = letters.replace(/^([jqxy])ü/, '$1u');
  return { initial, final: rest, tone, spelling };
}

export function splitSyllables(pinyin: string): string[] {
  return pinyin.trim().split(/\s+/).filter(Boolean);
}

function markSyllable({ spelling, tone }: Syllable): string {
  if (tone === 5) return spelling;
  let index: number;
  if (/[ae]/.test(spelling)) index = spelling.search(/[ae]/);
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
  const marked = TONE_MARKS[vowel]?.charAt(tone - 1) ?? vowel;
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

export function syllableToZhuyin(syllable: string): ZhuyinSyllable {
  const { initial, final, tone } = parseSyllable(syllable);
  // b/p/m/f + o is ㄛ directly; every other final maps from the table.
  const body = (ZHUYIN_INITIALS[initial] ?? '') + (ZHUYIN_FINALS[final] ?? '');
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

/** Tone-marked vowel → [plain vowel, tone]. Breves (ă ĭ ŏ ŭ, common in word lists) count as 3rd tone. */
const MARKED_VOWELS: ReadonlyMap<string, readonly [string, Tone]> = new Map([
  ...Object.entries(TONE_MARKS).flatMap(([vowel, marks]) =>
    [...marks].map((mark, i) => [mark, [vowel, (i + 1) as Tone]] as const),
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
  for (const char of syllable.trim().toLowerCase().normalize('NFC')) {
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
 * The neutral-tone dot may come first (as printed) or last.
 */
export function fromZhuyin(syllable: string): string {
  let text = syllable.trim();
  let tone: Tone = 1;
  if (text.startsWith('˙') || text.endsWith('˙')) {
    tone = 5;
    text = text.replace('˙', '');
  } else {
    const index = ZHUYIN_TONES.indexOf(text.slice(-1));
    if (index > 0) {
      tone = (index + 1) as Tone;
      text = text.slice(0, -1);
    }
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
  return spelling + tone;
}

/** Lowercase pinyin letters only, for search: "Nǐ hǎo" / "ni3 hao3" → "nihao". */
export function plainPinyin(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
