// This device's picture of the learner's practice per day: the server's totals (every device, as
// of the last sync) plus this device's reviews and practice the server hasn't counted yet. Adding the two is
// exact, so counts keep rising between syncs and nothing is counted twice. Pure functions; the
// store keeps the state in its snapshot.

import {
  activityFromReviews,
  activityWithPractice,
  addPractice,
  addToActivity,
  currentTimeZone,
  dayKeyIn,
  sumActivity,
  type ActivityMap,
  type DayActivity,
  type PracticeEntry,
  type ReviewEntry,
} from '@taiwan-mandarin/shared';

export interface ActivityState {
  /** Server totals per day, all devices, as of the last sync. */
  remote: ActivityMap;
  /** This device's reviews and practice that `remote` doesn't include yet. */
  local: ActivityMap;
  /** Days are counted in this zone; moving to another starts over. */
  timeZone: string;
  /** Sent back as `activity.since` on the next sync. */
  cursor: number;
  /** `remote` holds every day: a full download has happened in this zone. */
  remoteComplete: boolean;
  /** Newest review or practice time counted in `local`, to catch up after the app was closed mid-save. */
  countedUpTo: number;
}

export const emptyActivity = (timeZone = currentTimeZone()): ActivityState => ({
  remote: {},
  local: {},
  timeZone,
  cursor: 0,
  remoteComplete: false,
  countedUpTo: 0,
});

const dayIn = (timeZone: string) => (ms: number) => dayKeyIn(ms, timeZone);

/** Every day, as the learner sees it. */
export const mergedDays = (state: ActivityState): ActivityMap =>
  sumActivity(state.remote, state.local);

/** One more review on this device. */
export function countReview(state: ActivityState, review: ReviewEntry): ActivityState {
  return {
    ...state,
    local: addToActivity(state.local, review, dayIn(state.timeZone)),
    countedUpTo: Math.max(state.countedUpTo, review.review),
  };
}

/** One more story, Talk message or character on this device (the store logs each once a day). */
export function countPractice(state: ActivityState, entry: PracticeEntry): ActivityState {
  return {
    ...state,
    local: addPractice(state.local, entry, dayIn(state.timeZone)),
    countedUpTo: Math.max(state.countedUpTo, entry.at),
  };
}

const localActivity = (
  reviews: readonly ReviewEntry[],
  practice: readonly PracticeEntry[],
  timeZone: string,
): ActivityMap =>
  activityWithPractice(activityFromReviews(reviews, dayIn(timeZone)), practice, dayIn(timeZone));

/** From this device's whole review and practice logs: the first run, or a new time zone. */
export function rebuildActivity(
  reviews: readonly ReviewEntry[],
  practice: readonly PracticeEntry[] = [],
  timeZone = currentTimeZone(),
): ActivityState {
  return {
    ...emptyActivity(timeZone),
    local: localActivity(reviews, practice, timeZone),
    countedUpTo: Math.max(
      reviews.reduce((max, r) => Math.max(max, r.review), 0),
      practice.reduce((max, p) => Math.max(max, p.at), 0),
    ),
  };
}

/**
 * The server's totals: a full download replaces what we had, an update replaces the days it
 * names. Local then holds only the reviews and practice still waiting to be sent.
 */
export function applyDownload(
  state: ActivityState,
  download: { timeZone: string; full: boolean; days: readonly DayActivity[] },
  cursor: number,
  unsent: readonly ReviewEntry[],
  unsentPractice: readonly PracticeEntry[] = [],
): ActivityState {
  if (download.timeZone !== state.timeZone) return state;
  const days = Object.fromEntries(download.days.map((d) => [d.date, d]));
  return {
    ...state,
    remote: download.full ? days : { ...state.remote, ...days },
    local: localActivity(unsent, unsentPractice, state.timeZone),
    cursor,
    remoteComplete: state.remoteComplete || download.full,
  };
}
