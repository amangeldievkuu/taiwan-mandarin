import { describe, expect, it } from 'vitest';
import { kintsugi } from './kintsugi.ts';

// A Wednesday: the week strip runs Monday 19 to Sunday 25 October.
const today = '2026-10-21';
const days = (...d: number[]) => d.map((n) => `2026-10-${String(n).padStart(2, '0')}`);
const marks = (k: ReturnType<typeof kintsugi>) => k.week.map((d) => d.mark);

describe('kintsugi', () => {
  it('starts empty', () => {
    const k = kintsugi([], today);
    expect(k).toMatchObject({ current: null, count: 0, longest: 0, crack: 0, seams: 0 });
    expect(marks(k)).toEqual(['empty', 'empty', 'today', 'future', 'future', 'future', 'future']);
  });

  it('counts days in a row', () => {
    const k = kintsugi(days(19, 20, 21), today);
    expect(k).toMatchObject({ count: 3, practicedToday: true, crack: 0 });
    expect(marks(k).slice(0, 3)).toEqual(['done', 'done', 'done']);
  });

  it("keeps yesterday's count until today's first review", () => {
    const k = kintsugi(days(19, 20), today);
    expect(k).toMatchObject({ count: 2, practicedToday: false, crack: 0 });
    expect(k.week[2]?.mark).toBe('today');
  });

  it('mends a gap with gold when the learner comes back', () => {
    const k = kintsugi(days(18, 21), today);
    expect(k.count).toBe(2);
    expect(k.mendedToday).toEqual({
      from: '2026-10-19',
      to: '2026-10-20',
      days: 2,
      mendedOn: '2026-10-21',
    });
    expect(marks(k).slice(0, 3)).toEqual(['mended', 'mended', 'done']);
    expect(k.seams).toBe(1);
  });

  it('mends up to three missed days, and fires the bowl after more', () => {
    expect(kintsugi(days(17, 21), today).mendedToday?.days).toBe(3);
    const fired = kintsugi(days(16, 21), today);
    expect(fired.mendedToday).toBeNull();
    expect(fired.count).toBe(1);
    expect(fired.shelf).toEqual([
      { start: '2026-10-16', end: '2026-10-16', days: 1, seams: [], firedOn: '2026-10-21' },
    ]);
  });

  it('shows an open crack and the last day to mend it', () => {
    const k = kintsugi(days(18), today);
    expect(k).toMatchObject({ count: 1, crack: 2, mendBy: '2026-10-22' });
    expect(marks(k).slice(0, 3)).toEqual(['crack', 'crack', 'today']);
    expect(kintsugi(days(17), today)).toMatchObject({ crack: 3, mendBy: today });
    const gone = kintsugi(days(16), today);
    expect(gone.current).toBeNull();
    expect(gone.shelf).toHaveLength(1);
  });

  it('keeps every seam in the bowl and the longest bowl on the shelf', () => {
    const k = kintsugi(days(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 18, 21), today);
    expect(k.shelf[0]).toMatchObject({ start: '2026-10-01', days: 10 });
    expect(k.current).toMatchObject({ start: '2026-10-15', days: 4 });
    expect(k.current?.seams.map((s) => s.days)).toEqual([1, 2]);
    expect(k.longest).toBe(10);
  });

  it('ignores duplicates, order and future days', () => {
    expect(kintsugi(['2026-10-21', '2026-10-20', '2026-10-21', '2026-10-25'], today).count).toBe(2);
  });

  it('handles weeks across the end of the year', () => {
    const k = kintsugi(['2026-12-28', '2026-12-31'], '2027-01-01');
    expect(k.week.map((d) => d.date)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(marks(k).slice(0, 5)).toEqual(['done', 'mended', 'mended', 'done', 'today']);
  });

  it('is a classic streak with no grace', () => {
    const k = kintsugi(days(18, 20, 21), today, 0);
    expect(k.count).toBe(2);
    expect(k.shelf).toHaveLength(1);
  });
});
