// Taking back the last answer (Undo in Study). The store keeps what an answer changed until the
// answer is sent; this puts the study state back as it was. Pure, so it is tested without a browser.

import { Rating, type Grade } from './srs';
import type { CardRecord, Daily, Snapshot } from './storage';
import type { SessionStats } from './store.svelte';

/** Session stats by grade. */
export const GRADE_KEY = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
} as const satisfies Record<Grade, keyof SessionStats>;

/** What one answer changed, kept until it is sent or another answer comes. */
export interface Answer {
  id: string;
  grade: Grade;
  /** The word was met for the first time. */
  isNew: boolean;
  /** It went back into the queue (Again, or a short learning step), so it didn't count as finished. */
  requeued: boolean;
  /** The card before the answer; undefined for a word met for the first time. */
  before: CardRecord | undefined;
  /** The deck entry the answer took off (a new word from the deck), and where it was. */
  fromDeck?: { entry: Snapshot['deck'][number]; index: number };
  /** The day the answer counted for. */
  date: string;
}

export interface StudyState {
  cards: Record<string, CardRecord>;
  deck: Snapshot['deck'];
  daily: Daily;
  stats: SessionStats;
  finished: number;
  queue: string[];
}

/**
 * The study state without `answer`: its card as it was (stamped `now`, so it wins over the
 * answered one in sync and in other tabs) or gone for a new word, its deck entry back in place,
 * every count one lower, and the card first in the queue again.
 */
export function takeBack(state: StudyState, answer: Answer, now: number): StudyState {
  const cards = Object.fromEntries(Object.entries(state.cards).filter(([id]) => id !== answer.id));
  if (answer.before) cards[answer.id] = { ...answer.before, updatedAt: now };

  const back = answer.fromDeck;
  const deck =
    back && !state.deck.some((d) => d.id === answer.id)
      ? [...state.deck.slice(0, back.index), back.entry, ...state.deck.slice(back.index)]
      : state.deck;

  const down = (n: number) => Math.max(0, n - 1);
  const daily =
    state.daily.date === answer.date
      ? {
          ...state.daily,
          reviewCount: down(state.daily.reviewCount),
          newCount: answer.isNew ? down(state.daily.newCount) : state.daily.newCount,
        }
      : state.daily;
  const grade = GRADE_KEY[answer.grade];
  const stats = {
    ...state.stats,
    reviewed: down(state.stats.reviewed),
    [grade]: down(state.stats[grade]),
    learned: answer.isNew ? down(state.stats.learned) : state.stats.learned,
  };

  return {
    cards,
    deck,
    daily,
    stats,
    finished: answer.requeued ? state.finished : down(state.finished),
    queue: [answer.id, ...state.queue.filter((id) => id !== answer.id)],
  };
}
