// Persistence behind a small interface, so server sync can wrap it (see sync.ts) without touching
// the store or UI. One snapshot (settings, cards, counters) plus append-only review and practice
// logs.

import {
  DEFAULT_SETTINGS,
  type Level,
  type PracticeEntry,
  type Settings,
} from '@taiwan-mandarin/shared';
import { TypeConvert, type Card } from 'ts-fsrs';
import type { ActivityState } from './activity';

export interface CardRecord {
  card: Card;
  /** Epoch ms of the last change, for last-write-wins merging during sync. */
  updatedAt: number;
  /** Level of the word, so its content file can be loaded without searching. */
  level?: Level;
  /** Hidden from study until unsuspended. */
  suspended?: boolean;
}

export interface Daily {
  /** Local day, "2026-10-21". */
  date: string;
  newCount: number;
  reviewCount: number;
}

export interface SyncState {
  /** Server cursor from the last sync. */
  cursor: number;
  /** Client time of the last successful push: cards changed after it are sent next time. */
  pushedAt: number;
  settingsUpdatedAt: number;
  deckUpdatedAt: number;
  /** Personal FSRS weights from the server. */
  fsrsWeights?: number[];
  /** The account last synced with; another account starts its downloads over. */
  userId?: string;
}

export interface Snapshot {
  version: 2;
  settings: Settings;
  cards: Record<string, CardRecord>;
  /** Words the learner added (from a reader, the dictionary…), studied before the path's words. */
  deck: { id: string; level?: Level; addedAt: number }[];
  daily: Daily;
  updatedAt: number;
  sync?: SyncState;
  /** Practice per day for the streak, XP and charts (missing before it existed: rebuilt). */
  activity?: ActivityState;
}

/** One answer to one card. Mirrors ts-fsrs's ReviewLog plus what sync and stats need. */
export interface ReviewRecord {
  /** Client-generated UUID; the server ignores duplicates. */
  id: string;
  wordId: string;
  /** 1 Again, 2 Hard, 3 Good, 4 Easy. */
  rating: number;
  /** Card state before the review: 0 New, 1 Learning, 2 Review, 3 Relearning. */
  state: number;
  /** Epoch ms of the review. */
  review: number;
  /** Due date before the review (epoch ms). */
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  /** Time from showing the card to answering, ms. */
  durationMs: number;
  /** Not yet sent to the server. */
  pending?: boolean;
}

/** A story read to the end, a message sent in Talk, a character written. */
export interface PracticeRecord extends PracticeEntry {
  /** Client-generated UUID; the server ignores duplicates. */
  id: string;
  /** Not yet sent to the server. */
  pending?: boolean;
}

export interface StorageAdapter {
  /** The saved snapshot, possibly in an older format (see `migrate`). */
  load(): Promise<StoredSnapshot | null>;
  save(snapshot: Snapshot): Promise<void>;
  addReview(review: ReviewRecord): Promise<void>;
  /** Reviews at or after `since` (epoch ms), oldest first. */
  reviews(since?: number): Promise<ReviewRecord[]>;
  /** Marks reviews as stored on the server. */
  markSynced(ids: readonly string[]): Promise<void>;
  addPractice(entry: PracticeRecord): Promise<void>;
  /** Practice at or after `since` (epoch ms), oldest first. */
  practice(since?: number): Promise<PracticeRecord[]>;
  /** Marks practice entries as stored on the server. */
  markPracticeSynced(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Asks the browser not to clear this app's data when space runs short or the app goes unused
 * (Safari clears sites after about a week away). Without an account it's the only copy. The browser
 * may say no; nothing depends on the answer.
 */
export async function askToKeepData(): Promise<void> {
  try {
    if (!(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    // Not available here.
  }
}

const KEY = 'taiwan-mandarin:v1';
const REVIEWS_KEY = 'taiwan-mandarin:reviews';
const PRACTICE_KEY = 'taiwan-mandarin:practice';

interface SnapshotV1 {
  version: 1;
  settings: Partial<Settings> & { meaning?: string };
  cards: Record<string, { card: Card; updatedAt: number }>;
  daily: Daily;
  updatedAt: number;
}

/**
 * v1 (121 hand-written words with slug ids like "ni-hao") → v2 (TOCFL ids like "你好").
 * `legacyIds` comes from the content manifest. Cards whose word no longer exists are dropped.
 */
export function migrate(raw: SnapshotV1 | Snapshot, legacyIds: Record<string, string>): Snapshot {
  if (raw.version === 2) return raw;
  const cards: Record<string, CardRecord> = {};
  for (const [legacy, record] of Object.entries(raw.cards ?? {})) {
    const id = legacyIds[legacy];
    if (id) cards[id] = { card: record.card, updatedAt: record.updatedAt };
  }
  const settings: Partial<Settings> & { meaning?: string } = { ...raw.settings };
  delete settings.meaning; // Kyrgyz / English meanings: Kyrgyz is gone
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    cards,
    deck: [],
    daily: raw.daily,
    updatedAt: raw.updatedAt,
  };
}

/**
 * The account's settings over this device's. A key the account's copy lacks was written by an
 * older app: language and Hán-Việt keep this device's value (rather than resetting it to English),
 * anything else its default.
 */
export function mergeSettings(local: Settings, incoming: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, language: local.language, hanViet: local.hanViet, ...incoming };
}

/** A snapshot's parts that a tab holds in memory and another tab may have saved since. */
export interface TabState {
  settings: Settings;
  cards: Record<string, CardRecord>;
  deck: Snapshot['deck'];
  daily: Daily;
  sync: SyncState;
}

/**
 * What a tab holds after another tab (or the installed app beside the browser) saved: the saved
 * snapshot, keeping what this tab changed and has not saved yet. Each tab saves everything it
 * holds, so without this the one that saves last would put the other's progress back to what it
 * was when that tab last looked.
 *
 * `unsaved`: the cards this tab changed since it last saved. Any other card this tab has and the
 * saved snapshot doesn't was removed there (progress reset), so it goes here too. Deck and
 * settings carry the time of their last change; the newer one is kept. Another account in the
 * saved snapshot (signed in, or out, in the other tab) replaces everything.
 */
export function adoptSnapshot(
  mine: TabState,
  saved: Snapshot,
  unsaved: ReadonlySet<string> = new Set(),
): TabState {
  const settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  const deck = saved.deck ?? [];
  if (saved.sync?.userId !== mine.sync.userId) {
    const none = { cursor: 0, pushedAt: 0, settingsUpdatedAt: 0, deckUpdatedAt: 0 };
    return {
      settings,
      cards: saved.cards,
      deck,
      daily: saved.daily ?? mine.daily,
      sync: saved.sync ?? none,
    };
  }
  const cards = { ...saved.cards };
  for (const id of unsaved) {
    const own = mine.cards[id];
    const theirs = cards[id];
    if (own && (!theirs || theirs.updatedAt <= own.updatedAt)) cards[id] = own;
  }
  const sync = saved.sync ?? mine.sync;
  const ownDeck = mine.sync.deckUpdatedAt > sync.deckUpdatedAt;
  const ownSettings = mine.sync.settingsUpdatedAt > sync.settingsUpdatedAt;
  // The same day in both: neither tab's count goes down (the new-word allowance depends on it).
  const theirs = saved.daily ?? mine.daily;
  const daily =
    theirs.date === mine.daily.date
      ? {
          date: mine.daily.date,
          newCount: Math.max(theirs.newCount, mine.daily.newCount),
          reviewCount: Math.max(theirs.reviewCount, mine.daily.reviewCount),
        }
      : theirs.date > mine.daily.date
        ? theirs
        : mine.daily;
  return {
    settings: ownSettings ? mine.settings : settings,
    cards,
    deck: ownDeck ? mine.deck : deck,
    daily,
    sync: {
      ...sync,
      ...(ownDeck ? { deckUpdatedAt: mine.sync.deckUpdatedAt } : {}),
      ...(ownSettings ? { settingsUpdatedAt: mine.sync.settingsUpdatedAt } : {}),
    },
  };
}

/**
 * Names the last save, in localStorage: every tab reads it before saving, and the browser tells
 * the other tabs when it changes (a `storage` event), so a tab knows at once, and for almost
 * nothing, whether another one saved since it last looked.
 */
export const SAVE_STAMP_KEY = 'taiwan-mandarin:saved';

export function readSaveStamp(): string | null {
  try {
    return localStorage.getItem(SAVE_STAMP_KEY);
  } catch {
    return null;
  }
}

export function writeSaveStamp(stamp: string): boolean {
  try {
    localStorage.setItem(SAVE_STAMP_KEY, stamp);
    return true;
  } catch {
    // Storage blocked or full: tabs then don't hear of each other's saves, as before.
    return false;
  }
}

/** Dates come back as strings from JSON; normalize them to Date objects. */
export function revive<T extends { cards: Record<string, { card: Card }> }>(snapshot: T): T {
  const cards: Record<string, unknown> = {};
  for (const [id, record] of Object.entries(snapshot.cards ?? {})) {
    cards[id] = { ...record, card: TypeConvert.card(record.card) };
  }
  return { ...snapshot, cards } as T;
}

/** Raw stored value: v1 snapshots are migrated by the store once the manifest is loaded. */
export type StoredSnapshot = Snapshot | SnapshotV1;

export class IndexedDbAdapter implements StorageAdapter {
  private db: Promise<IDBDatabase> | undefined;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('taiwan-mandarin', 3);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (event.oldVersion < 1) db.createObjectStore('kv');
        if (event.oldVersion < 2) {
          db.createObjectStore('reviews', { keyPath: 'id' }).createIndex('review', 'review');
        }
        if (event.oldVersion < 3) {
          db.createObjectStore('practice', { keyPath: 'id' }).createIndex('at', 'at');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // A newer version of the app is upgrading the database in another tab: step aside rather
        // than block it, and reopen on next use.
        db.onversionchange = () => {
          db.close();
          this.db = undefined;
        };
        // Safari sometimes drops the connection ("Connection to Indexed Database server lost").
        db.onclose = () => (this.db = undefined);
        resolve(db);
      };
      request.onerror = () => {
        this.db = undefined;
        reject(request.error);
      };
    });
    return this.db;
  }

  /** Runs `fn` on the database, reopening it once if the connection was closed under us. */
  private async withDb<T>(fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.open());
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'InvalidStateError')) throw e;
      this.db = undefined;
      return fn(await this.open());
    }
  }

  private run<T>(
    store: 'kv' | 'reviews' | 'practice',
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest<T>,
  ) {
    return this.withDb(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const tx = db.transaction(store, mode);
          const request = op(tx.objectStore(store));
          tx.oncomplete = () => resolve(request.result);
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );
  }

  async load(): Promise<StoredSnapshot | null> {
    const value = await this.run<StoredSnapshot | undefined>('kv', 'readonly', (s) => s.get(KEY));
    return value ? revive(value) : null;
  }

  async save(snapshot: Snapshot): Promise<void> {
    await this.run('kv', 'readwrite', (s) => s.put(snapshot, KEY));
  }

  async addReview(review: ReviewRecord): Promise<void> {
    await this.run('reviews', 'readwrite', (s) => s.put(review));
  }

  async reviews(since = 0): Promise<ReviewRecord[]> {
    return this.run<ReviewRecord[]>('reviews', 'readonly', (s) =>
      s.index('review').getAll(IDBKeyRange.lowerBound(since)),
    );
  }

  async markSynced(ids: readonly string[]): Promise<void> {
    await this.markStored('reviews', ids);
  }

  async addPractice(entry: PracticeRecord): Promise<void> {
    await this.run('practice', 'readwrite', (s) => s.put(entry));
  }

  async practice(since = 0): Promise<PracticeRecord[]> {
    return this.run<PracticeRecord[]>('practice', 'readonly', (s) =>
      s.index('at').getAll(IDBKeyRange.lowerBound(since)),
    );
  }

  async markPracticeSynced(ids: readonly string[]): Promise<void> {
    await this.markStored('practice', ids);
  }

  private async markStored(name: 'reviews' | 'practice', ids: readonly string[]): Promise<void> {
    await this.withDb(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(name, 'readwrite');
          const store = tx.objectStore(name);
          for (const id of ids) {
            const request = store.get(id);
            request.onsuccess = () => {
              const entry = request.result as { pending?: boolean } | undefined;
              if (entry?.pending) store.put({ ...entry, pending: false });
            };
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        }),
    );
  }

  async clear(): Promise<void> {
    await this.run('kv', 'readwrite', (s) => s.delete(KEY));
    await this.run('reviews', 'readwrite', (s) => s.clear());
    await this.run('practice', 'readwrite', (s) => s.clear());
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  }

  async load(): Promise<StoredSnapshot | null> {
    const value = this.read<StoredSnapshot>(KEY);
    return value ? revive(value) : null;
  }

  async save(snapshot: Snapshot): Promise<void> {
    this.write(KEY, snapshot);
  }

  async addReview(review: ReviewRecord): Promise<void> {
    const all = this.read<ReviewRecord[]>(REVIEWS_KEY) ?? [];
    const index = all.findIndex((r) => r.id === review.id);
    if (index >= 0) all[index] = review;
    else all.push(review);
    this.write(REVIEWS_KEY, all);
  }

  async reviews(since = 0): Promise<ReviewRecord[]> {
    return (this.read<ReviewRecord[]>(REVIEWS_KEY) ?? []).filter((r) => r.review >= since);
  }

  async markSynced(ids: readonly string[]): Promise<void> {
    const done = new Set(ids);
    const all = this.read<ReviewRecord[]>(REVIEWS_KEY) ?? [];
    this.write(
      REVIEWS_KEY,
      all.map((r) => (done.has(r.id) ? { ...r, pending: false } : r)),
    );
  }

  async addPractice(entry: PracticeRecord): Promise<void> {
    const all = this.read<PracticeRecord[]>(PRACTICE_KEY) ?? [];
    if (!all.some((p) => p.id === entry.id)) this.write(PRACTICE_KEY, [...all, entry]);
  }

  async practice(since = 0): Promise<PracticeRecord[]> {
    return (this.read<PracticeRecord[]>(PRACTICE_KEY) ?? []).filter((p) => p.at >= since);
  }

  async markPracticeSynced(ids: readonly string[]): Promise<void> {
    const done = new Set(ids);
    const all = this.read<PracticeRecord[]>(PRACTICE_KEY) ?? [];
    this.write(
      PRACTICE_KEY,
      all.map((p) => (done.has(p.id) ? { ...p, pending: false } : p)),
    );
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(REVIEWS_KEY);
      localStorage.removeItem(PRACTICE_KEY);
    } catch {
      // ignore
    }
  }
}

/** IndexedDB when it works, otherwise localStorage (which itself degrades to memory-only). */
export class BrowserStorage implements StorageAdapter {
  private fallback = new LocalStorageAdapter();
  private primary: StorageAdapter | null =
    typeof indexedDB === 'undefined' ? null : new IndexedDbAdapter();

  /** IndexedDB has answered once: a later failure is an error, not a browser without it. */
  private working = false;

  private async attempt<T>(fn: (a: StorageAdapter) => Promise<T>): Promise<T> {
    if (this.primary) {
      try {
        const result = await fn(this.primary);
        this.working = true;
        return result;
      } catch (e) {
        // Switching now would split saved data between two stores, and the next start would
        // read the older one.
        if (this.working) throw e;
        this.primary = null; // e.g. private mode without IndexedDB
      }
    }
    return fn(this.fallback);
  }

  load = () => this.attempt((a) => a.load());
  save = (snapshot: Snapshot) => this.attempt((a) => a.save(snapshot));
  addReview = (review: ReviewRecord) => this.attempt((a) => a.addReview(review));
  reviews = (since?: number) => this.attempt((a) => a.reviews(since));
  markSynced = (ids: readonly string[]) => this.attempt((a) => a.markSynced(ids));
  addPractice = (entry: PracticeRecord) => this.attempt((a) => a.addPractice(entry));
  practice = (since?: number) => this.attempt((a) => a.practice(since));
  markPracticeSynced = (ids: readonly string[]) => this.attempt((a) => a.markPracticeSynced(ids));
  clear = () => this.attempt((a) => a.clear());
}
