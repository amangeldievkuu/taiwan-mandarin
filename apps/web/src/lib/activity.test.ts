import { emptyDay } from '@taiwan-mandarin/shared';
import { describe, expect, it } from 'vitest';
import {
  applyDownload,
  countPractice,
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
    let state = rebuildActivity(mine, [], 'UTC');
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

  it('counts practice until the server has it, the same story once a day', () => {
    const read = (ref: string, iso: string) => ({
      kind: 'read' as const,
      ref,
      at: Date.parse(iso),
    });
    let state = rebuildActivity(
      [],
      [read('mrt', '2026-10-21T08:00:00Z'), read('mrt', '2026-10-21T09:00:00Z')],
      'UTC',
    );
    state = countPractice(state, {
      kind: 'talk',
      ref: 'm1',
      at: Date.parse('2026-10-21T10:00:00Z'),
    });
    expect(mergedDays(state)['2026-10-21']).toMatchObject({ read: 1, talk: 1, reviews: 0 });
    expect(state.countedUpTo).toBe(Date.parse('2026-10-21T10:00:00Z'));
    const download = {
      timeZone: 'UTC',
      full: true,
      days: [{ ...emptyDay('2026-10-21'), read: 1, talk: 1 }],
    };
    state = applyDownload(state, download, 3, [], [read('jiufen', '2026-10-21T11:00:00Z')]);
    expect(mergedDays(state)['2026-10-21']).toMatchObject({ read: 2, talk: 1 });
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
