// Persistence behind a small interface, so server sync can wrap it (see sync.ts) without touching
// the store or UI. One snapshot (settings, cards, counters) plus an append-only review log.

import { DEFAULT_SETTINGS, type Level, type Settings } from '@taiwan-mandarin/shared';
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

export interface StorageAdapter {
  /** The saved snapshot, possibly in an older format (see `migrate`). */
  load(): Promise<StoredSnapshot | null>;
  save(snapshot: Snapshot): Promise<void>;
  addReview(review: ReviewRecord): Promise<void>;
  /** Reviews at or after `since` (epoch ms), oldest first. */
  reviews(since?: number): Promise<ReviewRecord[]>;
  /** Marks reviews as stored on the server. */
  markSynced(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'taiwan-mandarin:v1';
const REVIEWS_KEY = 'taiwan-mandarin:reviews';

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
  delete settings.meaning; // Kyrgyz / English meanings: the app is English-only now
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    cards,
    deck: [],
    daily: raw.daily,
    updatedAt: raw.updatedAt,
  };
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
      const request = indexedDB.open('taiwan-mandarin', 2);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (event.oldVersion < 1) db.createObjectStore('kv');
        if (event.oldVersion < 2) {
          db.createObjectStore('reviews', { keyPath: 'id' }).createIndex('review', 'review');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async run<T>(
    store: 'kv' | 'reviews',
    mode: IDBTransactionMode,
    op: (s: IDBObjectStore) => IDBRequest<T>,
  ) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = op(tx.objectStore(store));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
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
    const db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('reviews', 'readwrite');
      const store = tx.objectStore('reviews');
      for (const id of ids) {
        const request = store.get(id);
        request.onsuccess = () => {
          const review = request.result as ReviewRecord | undefined;
          if (review?.pending) store.put({ ...review, pending: false });
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clear(): Promise<void> {
    await this.run('kv', 'readwrite', (s) => s.delete(KEY));
    await this.run('reviews', 'readwrite', (s) => s.clear());
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

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(REVIEWS_KEY);
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

  private async attempt<T>(fn: (a: StorageAdapter) => Promise<T>): Promise<T> {
    if (this.primary) {
      try {
        return await fn(this.primary);
      } catch {
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
  clear = () => this.attempt((a) => a.clear());
}
