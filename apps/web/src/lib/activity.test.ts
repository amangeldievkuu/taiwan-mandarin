import { describe, expect, it } from 'vitest';
import {
  applyDownload,
  countReview,
  emptyActivity,
  mergedDays,
  rebuildActivity,
  type ActivityState,
} from './activity';

const at = (iso: string, rating = 3, state = 2) => ({ review: Date.parse(iso), rating, state });
const reviews = (state: ActivityState, date: string) => mergedDays(state)[date]?.reviews ?? 0;

describe('activity state', () => {
  it('counts this device’s reviews in its time zone', () => {
    let state = emptyActivity('Asia/Taipei');
    state = countReview(state, at('2026-10-20T16:30:00Z'));
    expect(reviews(state, '2026-10-21')).toBe(1);
    expect(state.countedUpTo).toBe(Date.parse('2026-10-20T16:30:00Z'));
  });

  it('keeps counting after another device has synced the same day', () => {
    // The laptop knows the phone did 20 today; its own reviews add to that.
    const download = {
      timeZone: 'UTC',
      full: true,
      days: [{ ...emptyDay('2026-10-21'), reviews: 20 }],
    };
    let state = applyDownload(emptyActivity('UTC'), download, 1000, []);
    expect(reviews(state, '2026-10-21')).toBe(20);
    state = countReview(state, at('2026-10-21T09:00:00Z'));
    expect(reviews(state, '2026-10-21')).toBe(21);
  });

  it('never counts a review twice once the server has it', () => {
    const mine = [at('2026-10-21T08:00:00Z'), at('2026-10-21T09:00:00Z')];
    let state = rebuildActivity(mine, 'UTC');
    expect(reviews(state, '2026-10-21')).toBe(2);
    // The server now has both (plus one from the phone); nothing is left unsent.
    const download = {
      timeZone: 'UTC',
      full: true,
      days: [{ ...emptyDay('2026-10-21'), reviews: 3 }],
    };
    state = applyDownload(state, download, 2000, []);
    expect(reviews(state, '2026-10-21')).toBe(3);
    expect(state.remoteComplete).toBe(true);
  });

  it('merges an update into the days it names', () => {
    const full = {
      timeZone: 'UTC',
      full: true,
      days: [
        { ...emptyDay('2026-10-20'), reviews: 5 },
        { ...emptyDay('2026-10-21'), reviews: 1 },
      ],
    };
    let state = applyDownload(emptyActivity('UTC'), full, 1, []);
    const update = {
      timeZone: 'UTC',
      full: false,
      days: [{ ...emptyDay('2026-10-21'), reviews: 4 }],
    };
    state = applyDownload(state, update, 2, [at('2026-10-21T10:00:00Z')]);
    expect(reviews(state, '2026-10-20')).toBe(5);
    expect(reviews(state, '2026-10-21')).toBe(5); // 4 on the server + 1 still unsent
    expect(state.cursor).toBe(2);
  });

  it('ignores totals counted in another time zone', () => {
    const state = emptyActivity('Asia/Taipei');
    const download = {
      timeZone: 'UTC',
      full: true,
      days: [{ ...emptyDay('2026-10-21'), reviews: 9 }],
    };
    expect(applyDownload(state, download, 1, [])).toBe(state);
  });
});

function emptyDay(date: string) {
  return {
    date,
    reviews: 0,
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    learned: 0,
    graded: 0,
    kept: 0,
    ms: 0,
  };
}
