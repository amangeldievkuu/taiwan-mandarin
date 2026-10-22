// Calendar days as "YYYY-MM-DD" keys. Arithmetic on keys runs in UTC, so it never trips over
// daylight saving or the machine's own time zone.

const DAY_MS = 86_400_000;

/** Days since 1970-01-01: "1970-01-02" → 1. */
export function dayNumber(key: string): number {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function dayFromNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export const shiftDay = (key: string, days: number): string => dayFromNumber(dayNumber(key) + days);

/** Days from `from` to `to`; positive when `to` is later. */
export const dayDiff = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

/** 0 = Monday … 6 = Sunday. */
export const weekdayOf = (key: string): number =>
  (new Date(dayNumber(key) * DAY_MS).getUTCDay() + 6) % 7;

/** The Monday of the week the day is in. */
export const weekStart = (key: string): string => shiftDay(key, -weekdayOf(key));

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day of an instant in a time zone: dayKeyIn(t, 'Asia/Taipei') → "2026-10-21". */
export function dayKeyIn(epochMs: number, timeZone: string): string {
  let format = formatters.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(epochMs).map((p) => [p.type, p.value]));
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}

/**
 * The canonical name of an IANA time zone this runtime knows ("asia/taipei" → "Asia/Taipei"), or
 * undefined. Other systems (PostgreSQL) only match the canonical spelling.
 */
export function canonicalTimeZone(value: string): string | undefined {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** An IANA time zone this runtime knows ("Asia/Taipei", "UTC"). */
export const isTimeZone = (value: string): boolean => canonicalTimeZone(value) !== undefined;

/** Minutes `timeZone` is ahead of UTC at `epochMs`: 480 in Taipei, -240 in New York in summer. */
export function utcOffsetMinutes(epochMs: number, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(epochMs)
      .find((p) => p.type === 'timeZoneName')?.value ?? '';
  const match = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(name);
  if (!match) return 0; // "GMT" itself
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** This device's time zone. */
export const currentTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
