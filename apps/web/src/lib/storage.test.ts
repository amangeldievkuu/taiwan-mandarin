import { describe, expect, it } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import { DEFAULT_SETTINGS } from '@taiwan-mandarin/shared';
import { adoptSnapshot, mergeSettings, migrate, type Snapshot, type TabState } from './storage';

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

describe('mergeSettings', () => {
  const local = { ...DEFAULT_SETTINGS, language: 'vi' as const, hanViet: false, newPerDay: 30 };

  it("takes the account's copy", () => {
    const merged = mergeSettings(local, { ...DEFAULT_SETTINGS, language: 'en', newPerDay: 5 });
    expect(merged.language).toBe('en');
    expect(merged.newPerDay).toBe(5);
  });

  it("keeps this device's language when an older app wrote the account's copy", () => {
    const older = { phonetics: 'pinyin' as const, levels: ['L1' as const] };
    expect(mergeSettings(local, older)).toEqual({
      ...DEFAULT_SETTINGS,
      language: 'vi',
      hanViet: false,
      phonetics: 'pinyin',
      levels: ['L1'],
    });
  });
});

describe('adoptSnapshot', () => {
  const card = createEmptyCard(new Date('2026-10-01'));
  const record = (updatedAt: number) => ({ card, updatedAt });
  const sync = { cursor: 0, pushedAt: 0, settingsUpdatedAt: 0, deckUpdatedAt: 0 };
  const daily = { date: '2026-11-10', newCount: 0, reviewCount: 0 };
  /** What this tab holds: it started with 你好 and 謝謝 studied yesterday. */
  const tab = (over: Partial<TabState> = {}): TabState => ({
    settings: DEFAULT_SETTINGS,
    cards: { 你好: record(100), 謝謝: record(100) },
    deck: [],
    daily,
    sync,
    ...over,
  });
  /** What the other tab saved. */
  const saved = (over: Partial<Snapshot> = {}): Snapshot => ({
    version: 2,
    settings: DEFAULT_SETTINGS,
    cards: { 你好: record(100), 謝謝: record(100) },
    deck: [],
    daily,
    updatedAt: 1000,
    sync,
    ...over,
  });

  it('takes the cards the other tab studied, so saving here doesn’t put them back', () => {
    const next = adoptSnapshot(
      tab(),
      saved({
        cards: { 你好: record(500), 謝謝: record(100), 再見: record(510) },
        daily: { ...daily, newCount: 1, reviewCount: 2 },
      }),
    );
    expect(next.cards['你好']?.updatedAt).toBe(500);
    expect(Object.keys(next.cards)).toEqual(['你好', '謝謝', '再見']);
    expect(next.daily).toEqual({ ...daily, newCount: 1, reviewCount: 2 });
  });

  it('keeps a card answered here and not saved yet', () => {
    const mine = tab({
      cards: { 你好: record(100), 謝謝: record(600), 老師: record(610) },
      daily: { ...daily, newCount: 1, reviewCount: 2 },
    });
    const next = adoptSnapshot(
      mine,
      saved({
        cards: { 你好: record(500), 謝謝: record(100) },
        daily: { ...daily, newCount: 0, reviewCount: 1 },
      }),
      new Set(['謝謝', '老師']),
    );
    expect(next.cards['你好']?.updatedAt).toBe(500);
    expect(next.cards['謝謝']?.updatedAt).toBe(600);
    expect(next.cards['老師']?.updatedAt).toBe(610);
    // Neither tab's count for the day goes down.
    expect(next.daily).toEqual({ ...daily, newCount: 1, reviewCount: 2 });
  });

  it('takes the other tab’s answer to a card answered in both, when that one is newer', () => {
    const next = adoptSnapshot(
      tab({ cards: { 你好: record(600) } }),
      saved({ cards: { 你好: record(700) } }),
      new Set(['你好']),
    );
    expect(next.cards['你好']?.updatedAt).toBe(700);
  });

  it('starts over when the other tab did: its cards are gone here too', () => {
    const next = adoptSnapshot(tab(), saved({ cards: {} }));
    expect(next.cards).toEqual({});
  });

  it('keeps the newer deck and settings, each by the time of its last change', () => {
    const deck = [{ id: '夜市', addedAt: 900 }];
    const theirs = saved({
      settings: { ...DEFAULT_SETTINGS, newPerDay: 20 },
      deck: [],
      sync: { ...sync, cursor: 7, pushedAt: 8, settingsUpdatedAt: 950, deckUpdatedAt: 100 },
    });
    const next = adoptSnapshot(
      tab({
        settings: { ...DEFAULT_SETTINGS, newPerDay: 5 },
        deck,
        sync: { ...sync, settingsUpdatedAt: 300, deckUpdatedAt: 900 },
      }),
      theirs,
    );
    // Their settings are newer; the deck was changed here later.
    expect(next.settings.newPerDay).toBe(20);
    expect(next.deck).toEqual(deck);
    // The older push of the two (this tab's): see the next test.
    expect(next.sync).toEqual({
      cursor: 7,
      pushedAt: 0,
      settingsUpdatedAt: 950,
      deckUpdatedAt: 900,
    });
  });

  it('takes a new day from whichever tab has it', () => {
    const tomorrow = { date: '2026-11-11', newCount: 1, reviewCount: 1 };
    expect(adoptSnapshot(tab(), saved({ daily: tomorrow })).daily).toEqual(tomorrow);
    expect(adoptSnapshot(tab({ daily: tomorrow }), saved()).daily).toEqual(tomorrow);
  });

  it('keeps the older push, so a card the other tab’s sync never saw is still sent', () => {
    // This tab changed 謝謝 at 600; the other tab's sync began at 650 without it.
    const next = adoptSnapshot(
      tab({ cards: { 你好: record(100), 謝謝: record(600) }, sync: { ...sync, pushedAt: 400 } }),
      saved({ sync: { ...sync, cursor: 7, pushedAt: 650 } }),
      new Set(['謝謝']),
    );
    expect(next.sync).toMatchObject({ cursor: 7, pushedAt: 400 });
    expect(adoptSnapshot(tab({ sync: { ...sync, pushedAt: 900 } }), saved()).sync.pushedAt).toBe(0);
  });

  it('takes everything when the other tab signed in to another account', () => {
    const next = adoptSnapshot(
      tab({ cards: { 你好: record(600) }, sync: { ...sync, userId: 'a' } }),
      saved({ cards: { 貓: record(50) }, sync: { ...sync, cursor: 3, userId: 'b' } }),
      new Set(['你好']),
    );
    expect(Object.keys(next.cards)).toEqual(['貓']);
    expect(next.sync).toMatchObject({ cursor: 3, userId: 'b' });
  });
});
