import { kintsugi, shiftDay } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import { arrivalMood, onceADay } from './mo';

const today = '2026-10-30';
/** Practice on these days before today (1 = yesterday); 0 is today. */
const practiced = (...ago: number[]) =>
  kintsugi(
    ago.map((n) => shiftDay(today, -n)),
    today,
  );
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const noon = (streak: ReturnType<typeof kintsugi>, queueLeft = 5) => ({
  streak,
  queueLeft,
  hour: 12,
});

describe('arrivalMood on Today', () => {
  it('greets a learner on an ordinary day', () => {
    expect(arrivalMood('today', noon(practiced(1, 2)))).toBe('greet');
    expect(arrivalMood('today', noon(practiced()))).toBe('greet');
  });

  it('welcomes back after missed days, mendable or not', () => {
    expect(arrivalMood('today', noon(practiced(3, 4)))).toBe('back');
    expect(arrivalMood('today', noon(practiced(20, 21)))).toBe('back');
  });

  it('notices the mend once the learner practises', () => {
    expect(arrivalMood('today', noon(practiced(0, 3, 4)))).toBe('mended');
  });

  it('marks streak milestones', () => {
    expect(arrivalMood('today', noon(practiced(0, 1, 2)))).toBe('milestone');
    expect(arrivalMood('today', noon(practiced(0, 1, 2, 3)))).toBe('greet');
    expect(arrivalMood('today', noon(practiced(...range(0, 6))))).toBe('milestone');
  });

  it('says all done when the queue is empty', () => {
    expect(arrivalMood('today', noon(practiced(0, 1), 0))).toBe('doneToday');
    // Not before practising: an empty queue alone is no achievement.
    expect(arrivalMood('today', noon(practiced(1), 0))).toBe('greet');
  });

  it('says each of today’s lines once, then the next, then the greeting', () => {
    const state = noon(practiced(0, 1, 2), 0);
    expect(arrivalMood('today', state, new Set(['milestone']))).toBe('doneToday');
    expect(arrivalMood('today', state, new Set(['milestone', 'doneToday']))).toBe('greet');
  });
});

describe('arrivalMood elsewhere', () => {
  it('tells a late learner to sleep, on Study only', () => {
    const late = { streak: practiced(1), queueLeft: 5, hour: 23 };
    expect(arrivalMood('study', late)).toBe('lateNight');
    expect(arrivalMood('study', { ...late, hour: 20 })).toBeNull();
    expect(arrivalMood('dict', late)).toBeNull();
  });
});

describe('onceADay', () => {
  it('repeats only the greeting and the late-night line', () => {
    expect(onceADay('greet')).toBe(false);
    expect(onceADay('lateNight')).toBe(false);
    expect(onceADay('milestone')).toBe(true);
  });
});
