import { describe, expect, it } from 'vitest';
import {
  advanceQueue,
  buildQueue,
  dayKey,
  intervalTimes,
  newCard,
  preview,
  Rating,
  shouldRequeue,
  State,
  type Card,
} from './srs';

const now = new Date('2026-10-21T09:00:00');
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

describe('scheduling', () => {
  it('previews increasing intervals for a new card', () => {
    const result = preview(newCard(now), now);
    const due = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((g) =>
      result[g as 1 | 2 | 3 | 4].card.due.getTime(),
    );
    expect(due).toEqual([...due].sort((a, b) => a - b));
    expect(intervalTimes(result, now)[Rating.Again]).toBe(60_000);
  });

  it('requeues Again and short learning steps, not graduated cards', () => {
    const result = preview(newCard(now), now);
    expect(shouldRequeue(Rating.Again, result[Rating.Again].card, now)).toBe(true);
    expect(shouldRequeue(Rating.Easy, result[Rating.Easy].card, now)).toBe(false);
    const learning = { ...newCard(now), state: State.Learning, due: minutes(10) };
    expect(shouldRequeue(Rating.Good, learning, now)).toBe(true);
    expect(shouldRequeue(Rating.Good, { ...learning, due: minutes(60) }, now)).toBe(false);
  });
});

describe('buildQueue', () => {
  const card = (state: State, due: Date): Card => ({ ...newCard(now), state, due });

  it('puts due cards first (oldest first), then new words up to the allowance', () => {
    const cards = {
      a: { card: card(State.Review, minutes(-60)) },
      b: { card: card(State.Review, minutes(-120)) },
      c: { card: card(State.Review, minutes(60 * 24)) }, // not due
      d: { card: card(State.Learning, minutes(5)) }, // learning, within learn-ahead
    };
    const candidates = ['a', 'n1', 'n1', 'n2', 'n3'];
    expect(buildQueue(cards, candidates, now, 2)).toEqual(['b', 'a', 'd', 'n1', 'n2']);
    expect(buildQueue(cards, candidates, now, 0)).toEqual(['b', 'a', 'd']);
    expect(buildQueue(cards, candidates, now, -3)).toEqual(['b', 'a', 'd']);
  });

  it('skips suspended cards', () => {
    const cards = {
      a: { card: card(State.Review, minutes(-60)), suspended: true },
      b: { card: card(State.Review, minutes(-60)) },
    };
    expect(buildQueue(cards, [], now, 5)).toEqual(['b']);
  });
});

describe('advanceQueue', () => {
  it('drops the head, or moves it a few cards later', () => {
    expect(advanceQueue(['a', 'b', 'c'], false)).toEqual(['b', 'c']);
    expect(advanceQueue(['a', 'b', 'c', 'd', 'e'], true)).toEqual(['b', 'c', 'd', 'a', 'e']);
    expect(advanceQueue(['a', 'b'], true)).toEqual(['b', 'a']);
    expect(advanceQueue(['a'], true)).toEqual(['a']);
  });
});

describe('dayKey', () => {
  it('uses the local date', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
