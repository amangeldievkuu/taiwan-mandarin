import { createEmptyCard } from 'ts-fsrs';
import { describe, expect, it } from 'vitest';
import { Rating } from './srs';
import { takeBack, type Answer, type StudyState } from './undo';

const card = createEmptyCard(new Date('2026-11-01'));
const record = (updatedAt: number) => ({ card, updatedAt, level: 'N1' as const });
const today = '2026-11-11';

/** The state just after answering 你好 (studied before), with 謝謝 and 再見 still to come. */
const after = (over: Partial<StudyState> = {}): StudyState => ({
  cards: { 你好: record(900), 老師: record(100) },
  deck: [{ id: '夜市', addedAt: 1 }],
  daily: { date: today, newCount: 1, reviewCount: 5 },
  stats: { reviewed: 5, learned: 1, again: 1, hard: 0, good: 4, easy: 0 },
  finished: 4,
  queue: ['謝謝', '再見'],
  ...over,
});

const answer = (over: Partial<Answer> = {}): Answer => ({
  id: '你好',
  grade: Rating.Good,
  isNew: false,
  requeued: false,
  before: record(100),
  date: today,
  ...over,
});

describe('taking back the last answer', () => {
  it('puts the card back as it was, stamped now, and first in the queue', () => {
    const next = takeBack(after(), answer(), 1000);
    expect(next.cards['你好']).toEqual({ ...record(100), updatedAt: 1000 });
    expect(next.queue).toEqual(['你好', '謝謝', '再見']);
    expect(next.finished).toBe(3);
    expect(next.daily).toEqual({ date: today, newCount: 1, reviewCount: 4 });
    expect(next.stats).toMatchObject({ reviewed: 4, good: 3, learned: 1 });
  });

  it('forgets a new word again, and puts it back in the deck where it was', () => {
    const state = after({
      cards: { 你好: record(100), 夜市: record(900) },
      deck: [
        { id: '捷運', addedAt: 1 },
        { id: '小吃', addedAt: 3 },
      ],
    });
    const next = takeBack(
      state,
      answer({
        id: '夜市',
        isNew: true,
        before: undefined,
        fromDeck: { entry: { id: '夜市', addedAt: 2 }, index: 1 },
      }),
      1000,
    );
    expect(Object.keys(next.cards)).toEqual(['你好']);
    expect(next.deck.map((d) => d.id)).toEqual(['捷運', '夜市', '小吃']);
    expect(next.daily.newCount).toBe(0);
    expect(next.stats.learned).toBe(0);
  });

  it('brings an "Again" back from later in the queue, and it was never finished', () => {
    const next = takeBack(
      after({ queue: ['謝謝', '再見', '你好', '對不起'] }),
      answer({ grade: Rating.Again, requeued: true }),
      1000,
    );
    expect(next.queue).toEqual(['你好', '謝謝', '再見', '對不起']);
    expect(next.finished).toBe(4);
    expect(next.stats.again).toBe(0);
  });

  it('never counts below zero, and leaves another day’s counts alone', () => {
    const empty = { reviewed: 0, learned: 0, again: 0, hard: 0, good: 0, easy: 0 };
    const next = takeBack(
      after({
        stats: empty,
        finished: 0,
        daily: { date: '2026-11-12', newCount: 0, reviewCount: 0 },
      }),
      answer({ isNew: true }),
      1000,
    );
    expect(next.stats).toEqual(empty);
    expect(next.finished).toBe(0);
    expect(next.daily).toEqual({ date: '2026-11-12', newCount: 0, reviewCount: 0 });
  });
});
