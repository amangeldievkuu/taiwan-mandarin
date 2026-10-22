import { describe, expect, it } from 'vitest';
import { dayDiff, dayKeyIn, isTimeZone, shiftDay, weekStart, weekdayOf } from './days.ts';

describe('day keys', () => {
  it('shifts across months, years and leap days', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29');
    expect(dayDiff('2026-10-19', '2026-10-21')).toBe(2);
    expect(dayDiff('2026-10-21', '2026-10-19')).toBe(-2);
  });

  it('finds the weekday and the Monday of the week', () => {
    expect(weekdayOf('2026-10-19')).toBe(0); // Monday
    expect(weekdayOf('2026-10-25')).toBe(6); // Sunday
    expect(weekStart('2026-10-21')).toBe('2026-10-19');
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });
});

describe('dayKeyIn', () => {
  it('gives the calendar day in a time zone', () => {
    const t = Date.parse('2026-10-20T16:30:00Z');
    expect(dayKeyIn(t, 'Asia/Taipei')).toBe('2026-10-21');
    expect(dayKeyIn(t, 'UTC')).toBe('2026-10-20');
  });

  it('follows daylight saving (New York, 1 November 2026)', () => {
    expect(dayKeyIn(Date.parse('2026-11-01T04:30:00Z'), 'America/New_York')).toBe('2026-11-01');
    expect(dayKeyIn(Date.parse('2026-11-02T04:30:00Z'), 'America/New_York')).toBe('2026-11-01');
    expect(dayKeyIn(Date.parse('2026-11-02T05:30:00Z'), 'America/New_York')).toBe('2026-11-02');
  });

  it('knows real time zones', () => {
    expect(isTimeZone('Asia/Taipei')).toBe(true);
    expect(isTimeZone('Mars/Base')).toBe(false);
  });
});
