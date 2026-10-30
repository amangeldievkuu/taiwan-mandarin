// The daily practice reminder: at a time of day the learner picks, in their own time zone.

import { dayKeyIn, utcOffsetMinutes } from './days.ts';

/** How often the server looks for reminders to send; a reminder is late by less than this. */
export const REMINDER_WINDOW_MINUTES = 15;

/** "HH:MM", 24-hour. */
export const REMINDER_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes after midnight: "20:30" → 1230. Undefined for anything else. */
export function minutesOfDay(time: string): number | undefined {
  const match = REMINDER_TIME.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

/**
 * The learner's day key when a reminder is due at `now`: the local time has reached
 * `reminderTime` by less than the window, and none was sent that day (`lastDay`). Otherwise null.
 */
export function reminderDue(
  now: number,
  timeZone: string,
  reminderTime: string,
  lastDay: string | null,
): string | null {
  const target = minutesOfDay(reminderTime);
  if (target === undefined) return null;
  const local = Math.floor((now + utcOffsetMinutes(now, timeZone) * 60_000) / 60_000);
  const minute = ((local % 1440) + 1440) % 1440;
  if (minute < target || minute >= target + REMINDER_WINDOW_MINUTES) return null;
  const today = dayKeyIn(now, timeZone);
  return today === lastDay ? null : today;
}
