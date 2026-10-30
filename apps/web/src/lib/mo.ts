// What 墨 says on arriving at a page, from how the learner is doing: welcome back after days
// away, a mended streak, a milestone, everything done for today, or a word about the hour. Lines
// about something that happened today are said once a day; after that, the usual line.

import type { Kintsugi } from '@taiwan-mandarin/shared';
import { partOfDay } from './greeting';
import type { RouteName } from './router.svelte';

/** On arriving: a line about the learner's day; 'greet' is Today's time-of-day greeting. */
export type MoMood = 'back' | 'mended' | 'milestone' | 'doneToday' | 'lateNight' | 'greet';
/** While studying: right answers in a row, and the session done. */
export type MoCheer = 'combo' | 'finished';

/** Streak lengths worth a word. */
export const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
/** Right answers in a row worth a word. */
export const COMBOS = [5, 10, 20];

export interface MoState {
  streak: Kintsugi;
  /** Cards still in today's queue. */
  queueLeft: number;
  /** The local hour. */
  hour: number;
}

/**
 * The mood for arriving at `route`, or null for the page's usual line. `said` holds today's
 * once-a-day moods already said, so tab after tab doesn't repeat them.
 */
export function arrivalMood(
  route: RouteName,
  { streak, queueLeft, hour }: MoState,
  said: ReadonlySet<MoMood> = new Set(),
): MoMood | null {
  if (route === 'study') return partOfDay(hour) === 'night' ? 'lateNight' : null;
  if (route !== 'today') return null;
  const today: [MoMood, boolean][] = [
    // Days missed: still mendable, or so many that the last bowl went on the shelf.
    [
      'back',
      !streak.practicedToday && (streak.crack > 0 || (!streak.current && !!streak.shelf.length)),
    ],
    ['mended', !!streak.mendedToday],
    ['milestone', streak.practicedToday && MILESTONES.includes(streak.count)],
    ['doneToday', streak.practicedToday && queueLeft === 0],
  ];
  return today.find(([mood, now]) => now && !said.has(mood))?.[0] ?? 'greet';
}

/** Moods about something that happened today: said once a day. */
export const onceADay = (mood: MoMood): boolean => mood !== 'lateNight' && mood !== 'greet';
