import { describe, expect, it, vi } from 'vitest';
import type { ContentService } from '../content/content.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { FsrsService, MIN_REVIEWS } from './fsrs.service.js';

/** A learner whose review log has one review a day of each of `wordIds`, in order. */
function service(wordIds: string[], known: ReadonlySet<string>) {
  const reviews = wordIds.map((wordId, i) => ({
    wordId,
    reviewedAt: new Date(Date.UTC(2026, 0, 1) + i * 86_400_000),
    rating: 3,
  }));
  const update = vi.fn(async () => ({}));
  const db = { reviewLog: { findMany: vi.fn(async () => reviews) }, user: { update } };
  const content = {
    manifest: {},
    word: (id: string) => (known.has(id) ? { id } : undefined),
  };
  return {
    update,
    fsrs: new FsrsService(db as unknown as PrismaService, content as unknown as ContentService),
  };
}

describe('fitting personal FSRS parameters', () => {
  it('counts only reviews of words in the study path, and says so with a code', async () => {
    const { fsrs, update } = service(
      [...Array<string>(MIN_REVIEWS).fill('not-a-word'), ...Array<string>(10).fill('你好')],
      new Set(['你好']),
    );
    await expect(fsrs.optimize('u')).rejects.toMatchObject({
      response: { code: 'fsrsTooFewReviews', params: { need: MIN_REVIEWS, have: 10 } },
    });
    expect(update).not.toHaveBeenCalled();
  });
});
