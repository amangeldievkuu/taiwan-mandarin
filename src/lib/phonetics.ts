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
  i: 'ㄧ', ia: 'ㄧㄚ', ie: 'ㄧㄝ', iao: 'ㄧㄠ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ',
  iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', uen: 'ㄨㄣ',
  uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  ü: 'ㄩ', üe: 'ㄩㄝ', üan: 'ㄩㄢ', ün: 'ㄩㄣ',
}; // prettier-ignore

/** Syllables written with y/w and no other initial. */
const Y_W: Record<string, string> = {
  yi: 'i', ya: 'ia', ye: 'ie', yao: 'iao', you: 'iou', yan: 'ian', yin: 'in',
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
  const letters = match[1];
  const tone = Number(match[2]) as Tone;

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
      if ('iouü'.includes(spelling[i])) {
        index = i;
        break;
      }
    }
  }
  if (index < 0) return spelling;
  const marked = TONE_MARKS[spelling[index]][tone - 1];
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
  const body = (ZHUYIN_INITIALS[initial] ?? '') + ZHUYIN_FINALS[final];
  return { body, tone: ZHUYIN_TONES[tone - 1] };
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

/** Lowercase pinyin letters only, for search: "Nǐ hǎo" / "ni3 hao3" → "nihao". */
export function plainPinyin(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}
