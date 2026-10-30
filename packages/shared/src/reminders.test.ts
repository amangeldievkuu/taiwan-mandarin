import { describe, expect, it } from 'vitest';
import { minutesOfDay, reminderDue } from './reminders.ts';

describe('reminders', () => {
  it('reads times of day', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('20:30')).toBe(1230);
    expect(minutesOfDay('24:00')).toBeUndefined();
    expect(minutesOfDay('8:00')).toBeUndefined();
  });

  it('is due from the time for one window, in the learner time zone', () => {
    // 20:00 in Taipei is 12:00 UTC.
    const at = (h: number, m: number) => Date.UTC(2026, 9, 30, h, m);
    expect(reminderDue(at(11, 59), 'Asia/Taipei', '20:00', null)).toBeNull();
    expect(reminderDue(at(12, 0), 'Asia/Taipei', '20:00', null)).toBe('2026-10-30');
    expect(reminderDue(at(12, 14), 'Asia/Taipei', '20:00', null)).toBe('2026-10-30');
    expect(reminderDue(at(12, 15), 'Asia/Taipei', '20:00', null)).toBeNull();
  });

  it('is sent once a day', () => {
    const now = Date.UTC(2026, 9, 30, 12, 5);
    expect(reminderDue(now, 'Asia/Taipei', '20:00', '2026-10-30')).toBeNull();
    expect(reminderDue(now, 'Asia/Taipei', '20:00', '2026-10-29')).toBe('2026-10-30');
  });

  it('counts the day where the learner is, across midnight UTC', () => {
    // 07:30 on the 31st in Taipei is still the 30th in UTC.
    expect(reminderDue(Date.UTC(2026, 9, 30, 23, 30), 'Asia/Taipei', '07:30', null)).toBe(
      '2026-10-31',
    );
    // 23:50 on the 30th in New York is the 31st in UTC.
    expect(reminderDue(Date.UTC(2026, 9, 31, 3, 50), 'America/New_York', '23:45', null)).toBe(
      '2026-10-30',
    );
  });

  it('keeps the local time across daylight saving', () => {
    // New York: UTC-4 in summer, UTC-5 in winter; 08:00 local either way.
    expect(reminderDue(Date.UTC(2026, 6, 1, 12, 0), 'America/New_York', '08:00', null)).toBe(
      '2026-07-01',
    );
    expect(reminderDue(Date.UTC(2026, 11, 1, 13, 0), 'America/New_York', '08:00', null)).toBe(
      '2026-12-01',
    );
    expect(reminderDue(Date.UTC(2026, 11, 1, 12, 0), 'America/New_York', '08:00', null)).toBeNull();
  });
});
