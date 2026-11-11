// The practice part of a Zhuyin lesson: questions built from the lesson's letters and Novice
// words. Pure, with the randomness passed in, so a seed gives the same quiz (quiz.test.ts).

import {
  LEVEL_IDS,
  LOOKALIKE_LETTERS,
  TONE_SETS,
  toZhuyin,
  zhuyinString,
  ZHUYIN_PINYIN,
  type Word,
  type ZhuyinLesson,
} from '@taiwan-mandarin/shared';

export type Question =
  /** Hear a letter's sound, pick the letter. */
  | { kind: 'letter'; sound: { char: string; pinyin: string }; options: string[]; answer: string }
  /** See a letter, pick what it is in pinyin. */
  | { kind: 'pinyin'; letter: string; options: string[]; answer: string }
  /** Hear a word, pick how it is written in Zhuyin. */
  | { kind: 'word'; word: Word; options: string[]; answer: string }
  /** Hear a syllable, pick its tone mark. */
  | { kind: 'tone'; char: string; pinyin: string; options: string[]; answer: string };

/** The tone marks as options: the first tone has none in Zhuyin, so it shows as ˉ. */
export const TONE_MARKS = ['ˉ', 'ˊ', 'ˇ', 'ˋ'] as const;

const HAN_ONLY = /^\p{Script=Han}+$/u;

/**
 * A word the quiz can use: written in Han characters only, with one checked reading (a voice
 * could say a word listed with several the other way), and its Zhuyin.
 */
function usable(word: Word): string | undefined {
  if (word.id.includes('~') || word.readingUnverified || !HAN_ONLY.test(word.hanzi)) return;
  try {
    return zhuyinString(word.pinyin);
  } catch {
    return undefined; // a reading the tables can't write
  }
}

/** A random number in [0, 1) from a seed, the same every time (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const pick = <T>(items: readonly T[], random: () => number): T | undefined =>
  items[Math.floor(random() * items.length)];

/** Words to show and quiz a letter with (see usable): short ones first, then by level and order. */
export function examplesFor(letter: string, words: readonly Word[], limit = 3): Word[] {
  return words
    .filter((w) => usable(w)?.includes(letter))
    .sort(
      (a, b) =>
        [...a.hanzi].length - [...b.hanzi].length ||
        LEVEL_IDS.indexOf(a.level) - LEVEL_IDS.indexOf(b.level) ||
        a.rank - b.rank,
    )
    .slice(0, limit);
}

/**
 * The answer and up to three wrong options, all different, in random order: `first` ones before
 * any of the others.
 */
function options(
  answer: string,
  wrong: readonly string[],
  random: () => number,
  first: readonly string[] = [],
): string[] {
  const pool = [...shuffle(first, random), ...shuffle(wrong, random)];
  const distinct = [...new Set(pool)].filter((o) => o !== answer);
  return shuffle([answer, ...distinct.slice(0, 3)], random);
}

/** A word's Zhuyin with `from` swapped for `to` everywhere: a wrong option that sounds close. */
const swapped = (zhuyin: string, from: string, to: string) => zhuyin.replaceAll(from, to);

function wordQuestion(
  word: Word,
  wrong: string[],
  random: () => number,
  first: string[] = [],
): Question | undefined {
  const answer = zhuyinString(word.pinyin);
  const choices = options(answer, wrong, random, first);
  return choices.length > 1 ? { kind: 'word', word, options: choices, answer } : undefined;
}

/** For the words lesson: each letter that sounds alike swapped in. */
function lookalikes(answer: string): string[] {
  return LOOKALIKE_LETTERS.flatMap(([a, b]) => [
    ...(answer.includes(a) ? [swapped(answer, a, b)] : []),
    ...(answer.includes(b) ? [swapped(answer, b, a)] : []),
  ]);
}

/** And the first syllable in each other tone, to fill the options. */
function otherTones(word: Word): string[] {
  const [first = '', ...rest] = word.pinyin.split(' ');
  const tone = Number(first.at(-1));
  if (!(tone >= 1 && tone <= 4)) return [];
  return [1, 2, 3, 4]
    .filter((t) => t !== tone)
    .map((t) => zhuyinString([`${first.slice(0, -1)}${t}`, ...rest].join(' ')));
}

/**
 * About eight questions for a lesson:
 * - a letter lesson asks, for each letter, which letter a sound is and how a word with it is
 *   written, plus what two of its letters are in pinyin;
 * - the tones lesson asks for the tone of syllables from the four-tone sets;
 * - the words lesson asks how Novice words of two characters are written, against letters that
 *   sound alike and other tones.
 */
export function buildQuiz(
  lesson: ZhuyinLesson,
  words: readonly Word[],
  random: () => number,
): Question[] {
  if (lesson.id === 'tones') {
    const syllables = shuffle(TONE_SETS.flat(), random).slice(0, 8);
    return syllables.map(({ char, pinyin }) => {
      const tone = toZhuyin(pinyin)[0]?.tone ?? '';
      const answer = tone || 'ˉ';
      return { kind: 'tone', char, pinyin, options: [...TONE_MARKS], answer };
    });
  }

  if (lesson.id === 'words') {
    const pool = words.filter((w) => [...w.hanzi].length === 2 && usable(w));
    const chosen = shuffle(pool.slice(0, 200), random).slice(0, 8);
    return chosen.flatMap((word) => {
      const alike = lookalikes(zhuyinString(word.pinyin));
      return wordQuestion(word, otherTones(word), random, alike) ?? [];
    });
  }

  const letters = lesson.letters.map((l) => l.letter);
  const questions: Question[] = [];
  for (const { letter, sound } of lesson.letters) {
    questions.push({ kind: 'letter', sound, options: shuffle(letters, random), answer: letter });
    const word = pick(examplesFor(letter, words, 8), random);
    if (!word) continue;
    const answer = zhuyinString(word.pinyin);
    const wrong = letters.filter((l) => l !== letter).map((l) => swapped(answer, letter, l));
    const question = wordQuestion(word, wrong, random);
    if (question) questions.push(question);
  }
  for (const letter of shuffle(letters, random).slice(0, 2)) {
    questions.push({
      kind: 'pinyin',
      letter,
      options: shuffle(
        letters.map((l) => ZHUYIN_PINYIN[l] ?? l),
        random,
      ),
      answer: ZHUYIN_PINYIN[letter] ?? letter,
    });
  }
  return shuffle(questions, random);
}
