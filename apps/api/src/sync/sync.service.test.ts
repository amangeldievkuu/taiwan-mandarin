import { PayloadTooLargeException } from '@nestjs/common';
import type { SyncRequest } from '@taiwan-mandarin/shared/api';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ActivityService } from './activity.service.js';
import { MAX_CARDS, MAX_PRACTICE, MAX_REVIEWS, SyncService } from './sync.service.js';

const card = { wordId: 'w', updatedAt: 1 } as SyncRequest['cards'][number];
const review = { id: 'r' } as SyncRequest['reviews'][number];
const practice = { id: 'p' } as SyncRequest['practice'][number];
const empty: SyncRequest = { since: 0, cards: [], reviews: [], practice: [] };

/** An account holding this many rows; every write throws, to show none is reached. */
function service(stored: { cards?: number; reviews?: number; practice?: number }) {
  const write = vi.fn(() => {
    throw new Error('wrote');
  });
  const table = (rows = 0) => ({
    count: vi.fn(async () => rows),
    findMany: write,
    createMany: write,
  });
  const db = {
    card: table(stored.cards),
    reviewLog: table(stored.reviews),
    practiceLog: table(stored.practice),
  };
  return {
    db,
    write,
    sync: new SyncService(db as unknown as PrismaService, {} as ActivityService),
  };
}

describe('the storage limits of an account', () => {
  it.each([
    ['cards', { cards: MAX_CARDS }, { cards: [card] }],
    ['reviews', { reviews: MAX_REVIEWS }, { reviews: [review] }],
    ['practice', { practice: MAX_PRACTICE }, { practice: [practice] }],
  ])('refuses more %s at the limit, before writing anything', async (_, stored, sent) => {
    const { sync, write } = service(stored);
    const refused = sync.sync('u', { ...empty, ...sent });
    await expect(refused).rejects.toBeInstanceOf(PayloadTooLargeException);
    await expect(refused).rejects.toMatchObject({ response: { code: 'accountFull' } });
    expect(write).not.toHaveBeenCalled();
  });

  it('lets a full account still download: a sync that sends nothing counts nothing', async () => {
    const { sync, db } = service({ cards: MAX_CARDS, reviews: MAX_REVIEWS });
    await expect(sync.sync('u', empty)).rejects.not.toBeInstanceOf(PayloadTooLargeException);
    expect(db.card.count).not.toHaveBeenCalled();
    expect(db.reviewLog.count).not.toHaveBeenCalled();
  });

  it('takes a request that just fits', async () => {
    const { sync } = service({ reviews: MAX_REVIEWS - 1 });
    await expect(sync.sync('u', { ...empty, reviews: [review] })).rejects.toThrow('wrote');
  });
});
