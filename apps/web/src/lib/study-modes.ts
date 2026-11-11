// The ways a study card can ask: what each mode is called, which one this device last used, and
// the grade a written or spoken answer suggests. Every mode answers the same FSRS card.
import type { PronounceResult } from '@taiwan-mandarin/shared/api';
import { Rating, type Grade } from './srs';

export type Mode = 'recognize' | 'recall' | 'listen' | 'write' | 'speak';
export const MODES: readonly Mode[] = ['recognize', 'recall', 'listen', 'write', 'speak'];
/** Each mode's Chinese name; its name and what it asks of the learner are in the catalog. */
export const MODE_ZH: Record<Mode, string> = {
  recognize: '認字',
  recall: '回想',
  listen: '聽力',
  write: '寫字',
  speak: '說話',
};

/** A saved mode, or recognise for anything this version doesn't know. */
export function parseMode(value: unknown): Mode {
  return MODES.includes(value as Mode) ? (value as Mode) : 'recognize';
}

/** How a word was written from memory. */
export interface WriteAttempt {
  /** Strokes drawn wrong, over all the characters. */
  mistakes: number;
  /** Strokes that needed their hint (three misses on one stroke). */
  hints: number;
  /** The answer was opened before the last character was written. */
  gaveUp: boolean;
}

/** Gave up or needed a hint: Again. Any wrong stroke: Hard. Clean: Good. Never Easy. */
export function suggestWriteGrade(attempt: WriteAttempt): Grade {
  if (attempt.gaveUp || attempt.hints > 0) return Rating.Again;
  return attempt.mistakes > 0 ? Rating.Hard : Rating.Good;
}

/** A syllable missed or misheard: Again. Sounds right, a tone wrong: Hard. Otherwise Good. */
export function suggestSpeakGrade(result: PronounceResult): Grade | undefined {
  if (!result.syllables.length) return undefined;
  if (result.syllables.some((s) => s.sound !== 'ok')) return Rating.Again;
  return result.syllables.some((s) => s.tone === 'wrong') ? Rating.Hard : Rating.Good;
}

/** Whether a character is written with strokes (Han), as opposed to a letter or a digit. */
export const isHan = (char: string): boolean => /\p{Script=Han}/u.test(char);

/**
 * A meaning shown as the question, with the word's own characters masked: a few meanings quote
 * them ("abbr. for 高級中學", «мой»: 我的), which would give the answer away.
 */
export function maskOwnChars(text: string, hanzi: string): string {
  const own = new Set([...hanzi].filter(isHan));
  return own.size ? [...text].map((c) => (own.has(c) ? '～' : c)).join('') : text;
}
