// A sync sends what this device has in requests of a bounded size. The server takes at most 20,000
// cards, reviews or practice entries and 10 MB in one request, and months of study without an
// account can hold more than that: sent whole, every sync would be refused, for good.

/** Cards, reviews and practice entries in one request, each. About 3 MB at the most. */
export const SYNC_BATCH = 5000;

export interface SyncBatch<C, R, P> {
  cards: C[];
  reviews: R[];
  practice: P[];
}

/**
 * What is waiting to be sent, split into requests in order. Always at least one, which may be
 * empty: the last request is also the one that asks the server for its changes.
 */
export function syncBatches<C, R, P>(
  pending: SyncBatch<C, R, P>,
  size = SYNC_BATCH,
): SyncBatch<C, R, P>[] {
  const count = Math.max(
    1,
    Math.ceil(pending.cards.length / size),
    Math.ceil(pending.reviews.length / size),
    Math.ceil(pending.practice.length / size),
  );
  return Array.from({ length: count }, (_, i) => ({
    cards: pending.cards.slice(i * size, (i + 1) * size),
    reviews: pending.reviews.slice(i * size, (i + 1) * size),
    practice: pending.practice.slice(i * size, (i + 1) * size),
  }));
}

/**
 * How far before the last push's start a sync looks for reviews and practice still to send. A
 * review's time is when its card was turned over, and an answer can stay open for hours (a phone
 * locked with it showing), so a day.
 */
export const UNSENT_MARGIN_MS = 24 * 3_600_000;

/**
 * Where to start reading the logs for what is still to send: everything on the first sync of a
 * run (in case the clock was changed since), then from the last push, so a long history isn't
 * read in full every few seconds while studying.
 */
export const unsentSince = (pushedAt: number, sentAll: boolean): number =>
  sentAll ? Math.max(0, pushedAt - UNSENT_MARGIN_MS) : 0;
