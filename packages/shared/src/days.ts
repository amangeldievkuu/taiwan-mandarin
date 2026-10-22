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

/** An IANA time zone this runtime knows ("Asia/Taipei", "UTC"). */
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** This device's time zone. */
export const currentTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
