// The Zhuyin starter course: the 37 letters in ten lessons, in the order Taiwanese schools teach
// them, then the tones, then reading whole words. Each letter is heard in a syllable read by the
// device's voice: its name (ㄅ is 玻 bō) or, for the three no character spells alone, a syllable
// with it (ㄝ in 耶 ㄧㄝ). Each character has that reading first in the dictionary, so a voice says
// it that way (packages/content checks it against the built dictionary).

export interface ZhuyinLetter {
  letter: string;
  /** A character read with the letter's sound, and that reading in numbered pinyin. */
  sound: { char: string; pinyin: string };
}

export const ZHUYIN_LESSON_IDS = [
  'lips',
  'tip',
  'back',
  'front',
  'curled',
  'flat',
  'medials',
  'vowels',
  'pairs',
  'nasals',
  'tones',
  'words',
] as const;
export type ZhuyinLessonId = (typeof ZHUYIN_LESSON_IDS)[number];

export interface ZhuyinLesson {
  id: ZhuyinLessonId;
  /** Its name in Chinese, on its seal. */
  zh: string;
  /** The letters it teaches; none in the tones and words lessons. */
  letters: ZhuyinLetter[];
}

const letter = (letter: string, char: string, pinyin: string): ZhuyinLetter => ({
  letter,
  sound: { char, pinyin },
});

export const ZHUYIN_LESSONS: readonly ZhuyinLesson[] = [
  {
    id: 'lips',
    zh: '唇音',
    letters: [
      letter('ㄅ', '玻', 'bo1'),
      letter('ㄆ', '坡', 'po1'),
      letter('ㄇ', '墨', 'mo4'),
      letter('ㄈ', '佛', 'fo2'),
    ],
  },
  {
    id: 'tip',
    zh: '舌尖',
    letters: [
      letter('ㄉ', '德', 'de2'),
      letter('ㄊ', '特', 'te4'),
      letter('ㄋ', '訥', 'ne4'),
      letter('ㄌ', '勒', 'le4'),
    ],
  },
  {
    id: 'back',
    zh: '舌根',
    letters: [letter('ㄍ', '哥', 'ge1'), letter('ㄎ', '科', 'ke1'), letter('ㄏ', '喝', 'he1')],
  },
  {
    id: 'front',
    zh: '舌面',
    letters: [letter('ㄐ', '雞', 'ji1'), letter('ㄑ', '欺', 'qi1'), letter('ㄒ', '西', 'xi1')],
  },
  {
    id: 'curled',
    zh: '翹舌',
    letters: [
      letter('ㄓ', '知', 'zhi1'),
      letter('ㄔ', '吃', 'chi1'),
      letter('ㄕ', '詩', 'shi1'),
      letter('ㄖ', '日', 'ri4'),
    ],
  },
  {
    id: 'flat',
    zh: '平舌',
    letters: [letter('ㄗ', '資', 'zi1'), letter('ㄘ', '疵', 'ci1'), letter('ㄙ', '思', 'si1')],
  },
  {
    id: 'medials',
    zh: '介音',
    letters: [letter('ㄧ', '醫', 'yi1'), letter('ㄨ', '屋', 'wu1'), letter('ㄩ', '迂', 'yu1')],
  },
  {
    id: 'vowels',
    zh: '單韻',
    letters: [
      letter('ㄚ', '阿', 'a1'),
      letter('ㄛ', '喔', 'o1'),
      letter('ㄜ', '鵝', 'e2'),
      letter('ㄝ', '耶', 'ye1'),
    ],
  },
  {
    id: 'pairs',
    zh: '複韻',
    letters: [
      letter('ㄞ', '愛', 'ai4'),
      letter('ㄟ', '黑', 'hei1'),
      letter('ㄠ', '敖', 'ao2'),
      letter('ㄡ', '歐', 'ou1'),
    ],
  },
  {
    id: 'nasals',
    zh: '聲隨',
    letters: [
      letter('ㄢ', '安', 'an1'),
      letter('ㄣ', '恩', 'en1'),
      letter('ㄤ', '昂', 'ang2'),
      letter('ㄥ', '風', 'feng1'),
      letter('ㄦ', '而', 'er2'),
    ],
  },
  { id: 'tones', zh: '聲調', letters: [] },
  { id: 'words', zh: '拼讀', letters: [] },
];

/** The four tones and the neutral one, on ma: 媽 mother, 麻 hemp, 馬 horse, 罵 scold, 嗎. */
export const TONE_DEMO = [
  { mark: 'ˉ', char: '媽', pinyin: 'ma1' },
  { mark: 'ˊ', char: '麻', pinyin: 'ma2' },
  { mark: 'ˇ', char: '馬', pinyin: 'ma3' },
  { mark: 'ˋ', char: '罵', pinyin: 'ma4' },
  { mark: '˙', char: '嗎', pinyin: 'ma5' },
] as const;

/**
 * Four tones on one syllable, for hearing which tone it is. The neutral tone is left out: said on
 * its own, a voice gives it a tone.
 */
export const TONE_SETS: readonly (readonly { char: string; pinyin: string }[])[] = [
  TONE_DEMO.slice(0, 4),
  [
    { char: '八', pinyin: 'ba1' },
    { char: '拔', pinyin: 'ba2' },
    { char: '把', pinyin: 'ba3' },
    { char: '爸', pinyin: 'ba4' },
  ],
  [
    { char: '湯', pinyin: 'tang1' },
    { char: '糖', pinyin: 'tang2' },
    { char: '躺', pinyin: 'tang3' },
    { char: '燙', pinyin: 'tang4' },
  ],
  [
    { char: '衣', pinyin: 'yi1' },
    { char: '姨', pinyin: 'yi2' },
    { char: '椅', pinyin: 'yi3' },
    { char: '意', pinyin: 'yi4' },
  ],
];

/** Letters that sound alike, for the wrong answers of the words lesson. */
export const LOOKALIKE_LETTERS: readonly (readonly [string, string])[] = [
  ['ㄅ', 'ㄆ'],
  ['ㄉ', 'ㄊ'],
  ['ㄍ', 'ㄎ'],
  ['ㄐ', 'ㄑ'],
  ['ㄓ', 'ㄗ'],
  ['ㄔ', 'ㄘ'],
  ['ㄕ', 'ㄙ'],
  ['ㄣ', 'ㄥ'],
  ['ㄢ', 'ㄤ'],
  ['ㄧ', 'ㄩ'],
];

export const zhuyinLesson = (id: string): ZhuyinLesson | undefined =>
  ZHUYIN_LESSONS.find((l) => l.id === id);

/** The lesson after `id`, if there is one. */
export const nextZhuyinLesson = (id: ZhuyinLessonId): ZhuyinLesson | undefined =>
  ZHUYIN_LESSONS[ZHUYIN_LESSONS.findIndex((l) => l.id === id) + 1];
