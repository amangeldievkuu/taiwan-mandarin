import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { migrate } from './storage';

describe('migrate', () => {
  it('maps v1 slug ids to TOCFL ids, drops unknown words and the meaning setting', () => {
    const card = createEmptyCard(new Date('2026-10-01'));
    const v1 = {
      version: 1 as const,
      settings: {
        phonetics: 'pinyin' as const,
        meaning: 'ky',
        glyphStyle: 'sans' as const,
        newPerDay: 15,
      },
      cards: {
        'ni-hao': { card, updatedAt: 1 },
        'le-se': { card, updatedAt: 2 },
        gone: { card, updatedAt: 3 },
      },
      daily: { date: '2026-10-20', newCount: 3, reviewCount: 9 },
      updatedAt: 4,
    };
    const v2 = migrate(v1, { 'ni-hao': '你好', 'le-se': '垃圾' });
    expect(v2.version).toBe(2);
    expect(Object.keys(v2.cards)).toEqual(['你好', '垃圾']);
    expect(v2.cards['垃圾']?.updatedAt).toBe(2);
    expect(v2.settings).toMatchObject({
      phonetics: 'pinyin',
      glyphStyle: 'sans',
      newPerDay: 15,
      levels: ['N1'],
    });
    expect('meaning' in v2.settings).toBe(false);
    expect(v2.deck).toEqual([]);
    expect(v2.daily).toEqual(v1.daily);
  });

  it('leaves v2 snapshots alone', () => {
    const v2 = migrate(
      {
        version: 1,
        settings: {},
        cards: {},
        daily: { date: 'x', newCount: 0, reviewCount: 0 },
        updatedAt: 0,
      },
      {},
    );
    expect(migrate(v2, {})).toBe(v2);
  });
});
