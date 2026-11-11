import { describe, expect, it } from 'vitest';
import { SYNC_BATCH, syncBatches, UNSENT_MARGIN_MS, unsentSince } from './sync-batches';

const numbers = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('syncBatches', () => {
  it('sends a little in one request', () => {
    const batches = syncBatches({ cards: numbers(3), reviews: numbers(40), practice: numbers(1) });
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual({ cards: numbers(3), reviews: numbers(40), practice: [0] });
  });

  it('still makes one request when nothing is waiting: it asks for the server’s changes', () => {
    expect(syncBatches({ cards: [], reviews: [], practice: [] })).toEqual([
      { cards: [], reviews: [], practice: [] },
    ]);
  });

  it('sends 12,000 reviews in three requests, each within what the server takes', () => {
    const pending = { cards: numbers(100), reviews: numbers(12_000), practice: numbers(5001) };
    const batches = syncBatches(pending);
    expect(batches.map((b) => b.reviews.length)).toEqual([5000, 5000, 2000]);
    expect(batches.map((b) => b.cards.length)).toEqual([100, 0, 0]);
    expect(batches.map((b) => b.practice.length)).toEqual([5000, 1, 0]);
    for (const batch of batches) {
      expect(batch.cards.length).toBeLessThanOrEqual(SYNC_BATCH);
      expect(batch.reviews.length).toBeLessThanOrEqual(SYNC_BATCH);
      expect(batch.practice.length).toBeLessThanOrEqual(SYNC_BATCH);
    }
    // Everything goes, once, in order.
    expect(batches.flatMap((b) => b.reviews)).toEqual(pending.reviews);
    expect(batches.flatMap((b) => b.cards)).toEqual(pending.cards);
    expect(batches.flatMap((b) => b.practice)).toEqual(pending.practice);
  });

  it('ends exactly at a full request', () => {
    expect(syncBatches({ cards: [], reviews: numbers(10), practice: [] }, 5)).toHaveLength(2);
  });
});

describe('where a sync looks for what it has to send', () => {
  const now = Date.UTC(2026, 10, 11, 9);

  it('reads everything on the first sync of a run', () => {
    expect(unsentSince(now, false)).toBe(0);
  });

  it('then reads from a day before the last push', () => {
    expect(unsentSince(now, true)).toBe(now - UNSENT_MARGIN_MS);
    expect(UNSENT_MARGIN_MS).toBe(24 * 3_600_000);
  });

  it('reads everything before any push', () => {
    expect(unsentSince(0, true)).toBe(0);
  });
});
