import { describe, expect, it } from 'vitest';
import {
  activityFromReviews,
  activityWithPractice,
  addToActivity,
  dailyFromActivity,
  emptyDay,
  practicedDays,
  retentionOf,
  sumActivity,
  totalXp,
  windowTotals,
  xpForDay,
  type DayActivity,
  type ReviewEntry,
} from './activity.ts';

const at = (day: string, rating = 3, state = 2, durationMs = 1000): ReviewEntry => ({
  rating,
  state,
  durationMs,
  review: Date.parse(`${day}T10:00:00Z`),
});
const utc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe('activity', () => {
  const map = activityFromReviews(
    [at('2026-10-21', 1), at('2026-10-21', 4, 0), at('2026-10-21', 3), at('2026-10-20', 2)],
    utc,
  );

  it('counts each day', () => {
    expect(map['2026-10-21']).toMatchObject({
      reviews: 3,
      again: 1,
      easy: 1,
      good: 1,
      learned: 1,
      graded: 2,
      kept: 1,
      ms: 3000,
    });
    expect(practicedDays(map).sort()).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('adds one review without changing the old map', () => {
    const next = addToActivity(map, at('2026-10-21', 3), utc);
    expect(next['2026-10-21']?.reviews).toBe(4);
    expect(map['2026-10-21']?.reviews).toBe(3);
  });

  it('adds two maps day by day', () => {
    const sum = sumActivity(map, activityFromReviews([at('2026-10-21'), at('2026-10-01')], utc));
    expect(sum['2026-10-21']?.reviews).toBe(4);
    expect(sum['2026-10-01']?.reviews).toBe(1);
  });

  it('fills the chart window, oldest first', () => {
    const days = dailyFromActivity(map, '2026-10-21', 3);
    expect(days.map((d) => d.date)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(days[2]).toMatchObject({ again: 1, easy: 1, total: 3 });
    expect(days[0]?.total).toBe(0);
  });

  it('works out retention over a window', () => {
    const totals = windowTotals(map, '2026-10-21', 30);
    expect(totals).toEqual({ reviews: 4, graded: 3, kept: 2, ms: 4000 });
    expect(retentionOf(totals)).toBeCloseTo(2 / 3);
    expect(retentionOf({ graded: 0, kept: 0 })).toBeNull();
  });

  it('gives XP for effort, the same for every grade', () => {
    // 12 reviews, 3 of them new words: 12 × 10 + 3 × 5.
    const day = activityFromReviews(
      [
        ...Array.from({ length: 9 }, () => at('2026-10-21', 1)),
        ...Array.from({ length: 3 }, () => at('2026-10-21', 4, 0)),
      ],
      utc,
    );
    expect(xpForDay(day['2026-10-21'])).toBe(135);
    expect(totalXp(map)).toBe(4 * 10 + 5);
  });

  it('gives XP for practice away from the cards, the same thing once a day', () => {
    const entry = (kind: 'read' | 'talk' | 'write', ref: string, date = '2026-10-21') => ({
      kind,
      ref,
      at: Date.parse(`${date}T12:00:00Z`),
    });
    const days = activityWithPractice(
      map,
      [
        entry('read', 'mrt'),
        entry('read', 'mrt'),
        entry('talk', 'm1'),
        entry('talk', 'm2'),
        entry('write', '愛'),
        entry('write', '愛', '2026-10-22'),
      ],
      utc,
    );
    expect(days['2026-10-21']).toMatchObject({ read: 1, talk: 2, write: 1 });
    // Practice alone doesn't water the plant: the streak still counts days with reviews.
    expect(practicedDays(days)).not.toContain('2026-10-22');
    expect(xpForDay(days['2026-10-22'])).toBe(10);
    expect(totalXp(days)).toBe(totalXp(map) + 50 + 2 * 10 + 10 + 10);
  });

  it('adds up days saved before the practice counts existed', () => {
    const old: Partial<DayActivity> = emptyDay('2026-10-21');
    delete old.read;
    delete old.talk;
    delete old.write;
    const sum = sumActivity(
      { '2026-10-21': old as DayActivity },
      {
        '2026-10-21': { ...emptyDay('2026-10-21'), talk: 1 },
      },
    );
    expect(sum['2026-10-21']?.talk).toBe(1);
    expect(xpForDay(sum['2026-10-21'])).toBe(10);
  });
});
