import { describe, expect, it } from 'vitest';
import {
  advanceQueue,
  buildQueue,
  dayKey,
  formatInterval,
  intervalLabels,
  newCard,
  preview,
  Rating,
  shouldRequeue,
  State,
  type Card,
} from './srs';

const now = new Date('2026-10-21T09:00:00');
const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

describe('formatInterval', () => {
  it.each([
    [30_000, '<1m'],
    [10 * 60_000, '10m'],
    [3 * 3_600_000, '3h'],
    [86_400_000, '1d'],
    [4 * 86_400_000, '4d'],
    [62 * 86_400_000, '2mo'],
    [548 * 86_400_000, '1.5y'],
    [59.6 * 60_000, '1h'],
    [23.6 * 3_600_000, '1d'],
    [29.7 * 86_400_000, '1mo'],
  ])('%d ms → %s', (ms, label) => {
    expect(formatInterval(ms)).toBe(label);
  });
});

describe('scheduling', () => {
  it('previews increasing intervals for a new card', () => {
    const result = preview(newCard(now), now);
    const due = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy].map((g) =>
      result[g as 1 | 2 | 3 | 4].card.due.getTime(),
    );
    expect(due).toEqual([...due].sort((a, b) => a - b));
    expect(intervalLabels(result, now)[Rating.Again]).toBe('1m');
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
      a: card(State.Review, minutes(-60)),
      b: card(State.Review, minutes(-120)),
      c: card(State.Review, minutes(60 * 24)), // not due
      d: card(State.Learning, minutes(5)), // learning, within learn-ahead
    };
    const ids = ['a', 'b', 'c', 'd', 'n1', 'n2', 'n3'];
    expect(buildQueue(ids, cards, now, 2)).toEqual(['b', 'a', 'd', 'n1', 'n2']);
    expect(buildQueue(ids, cards, now, 0)).toEqual(['b', 'a', 'd']);
    expect(buildQueue(ids, cards, now, -3)).toEqual(['b', 'a', 'd']);
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
