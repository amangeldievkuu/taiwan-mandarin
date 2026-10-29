// The learner's language: the interface, word meanings, translations and AI replies are in it.
// Chinese is what they learn, so it is never one of these.

export type Lang = 'en' | 'vi';

export const LANGS: readonly { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'vi', name: 'Tiếng Việt' },
];

export const LANG_IDS = LANGS.map((l) => l.id) as [Lang, ...Lang[]];

export const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && (LANG_IDS as string[]).includes(value);

/**
 * Latin text without accents, lowercase, for matching what a learner types without them:
 * "Học sinh" → "hoc sinh", "đi" → "di", "nǚ" → "nu".
 */
export const foldLatin = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd');

// Breve (ă), circumflex (â ê ô), tilde, hook above, horn (ơ ư), dot below: marks pinyin never uses.
const VIETNAMESE_MARKS = /[̛̣̂̃̆̉]|đ/iu;

/** Text that can only be Vietnamese, not pinyin ("bạn", "đi", "ăn"; not "ban", "nǚ", "mā"). */
export const looksVietnamese = (text: string): boolean =>
  VIETNAMESE_MARKS.test(text.normalize('NFD'));
