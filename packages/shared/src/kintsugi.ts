// The kintsugi (金繼) streak. Missing a day breaks nothing: come back within three days and the
// gap is mended with gold, a seam in the bowl, and the count goes on. Only a longer absence fires
// the bowl: it goes on the shelf with all its gold, and the next practice starts a new one.

import { dayDiff, shiftDay, weekStart } from './days.ts';

/** Days in a row that can be missed and still be mended. */
export const GRACE_DAYS = 3;

export interface Seam {
  /** First and last missed day. */
  from: string;
  to: string;
  days: number;
  /** The day of the return that mended it. */
  mendedOn: string;
}

export interface Bowl {
  start: string;
  /** Last day practiced. */
  end: string;
  /** Days practiced: the streak this bowl holds. */
  days: number;
  seams: Seam[];
  /** For a bowl on the shelf: the first day its gap could no longer be mended. */
  firedOn?: string;
}

/** A day in the week strip. "empty" is a day without practice that needed no mending. */
export type DayMark = 'done' | 'mended' | 'crack' | 'empty' | 'today' | 'future';

export interface WeekDay {
  date: string;
  mark: DayMark;
  today: boolean;
}

export interface Kintsugi {
  /** The bowl being made; null before the first practice and after a firing. */
  current: Bowl | null;
  /** Fired bowls, oldest first. */
  shelf: Bowl[];
  /** Days practiced in the current bowl: the streak. */
  count: number;
  /** The most days practiced in one bowl. */
  longest: number;
  practicedToday: boolean;
  /** Days missed since the last practice, while they can still be mended (0 when none). */
  crack: number;
  /** The last day on which practice still mends the crack. */
  mendBy: string | null;
  /** The seam that today's practice mended. */
  mendedToday: Seam | null;
  /** Gold seams in every bowl. */
  seams: number;
  /** Monday to Sunday of this week. */
  week: WeekDay[];
}

export function kintsugi(practiced: Iterable<string>, today: string, grace = GRACE_DAYS): Kintsugi {
  const days = [...new Set(practiced)].filter((d) => d <= today).sort();
  const fire = (bowl: Bowl): Bowl => ({ ...bowl, firedOn: shiftDay(bowl.end, grace + 2) });
  const shelf: Bowl[] = [];
  let current: Bowl | null = null;
  for (const day of days) {
    if (!current) {
      current = { start: day, end: day, days: 1, seams: [] };
      continue;
    }
    const gap = dayDiff(current.end, day) - 1;
    if (gap > grace) {
      shelf.push(fire(current));
      current = { start: day, end: day, days: 1, seams: [] };
      continue;
    }
    if (gap > 0) {
      current.seams.push({
        from: shiftDay(current.end, 1),
        to: shiftDay(day, -1),
        days: gap,
        mendedOn: day,
      });
    }
    current.days++;
    current.end = day;
  }

  let crack = 0;
  let mendBy: string | null = null;
  if (current) {
    const missed = dayDiff(current.end, today) - 1;
    if (missed > grace) {
      shelf.push(fire(current));
      current = null;
    } else if (missed > 0) {
      crack = missed;
      mendBy = shiftDay(current.end, grace + 1);
    }
  }

  const practicedToday = current?.end === today;
  const lastSeam = current?.seams.at(-1);
  const bowls = current ? [...shelf, current] : shelf;
  const done = new Set(days);
  const seams = bowls.flatMap((b) => b.seams);
  const mark = (date: string): DayMark => {
    if (date > today) return 'future';
    if (done.has(date)) return 'done';
    if (date === today) return 'today';
    if (seams.some((s) => s.from <= date && date <= s.to)) return 'mended';
    if (crack && current && date > current.end) return 'crack';
    return 'empty';
  };
  const monday = weekStart(today);
  return {
    current,
    shelf,
    count: current?.days ?? 0,
    longest: Math.max(0, ...bowls.map((b) => b.days)),
    practicedToday,
    crack,
    mendBy,
    mendedToday: practicedToday && lastSeam?.mendedOn === today ? lastSeam : null,
    seams: seams.length,
    week: Array.from({ length: 7 }, (_, i) => {
      const date = shiftDay(monday, i);
      return { date, mark: mark(date), today: date === today };
    }),
  };
}
