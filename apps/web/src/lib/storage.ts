// Persistence behind a small interface so a server sync (e.g. NestJS) can be added later
// as another StorageAdapter without touching the store or UI.

import type { Settings } from '@taiwan-mandarin/shared';
import { TypeConvert, type Card } from 'ts-fsrs';

export interface CardRecord {
  card: Card;
  /** Epoch ms of the last change, for last-write-wins merging during sync. */
  updatedAt: number;
}

export interface Daily {
  /** Local day, "2026-10-21". */
  date: string;
  newCount: number;
  reviewCount: number;
}

export interface Snapshot {
  version: 1;
  settings: Settings;
  cards: Record<string, CardRecord>;
  daily: Daily;
  updatedAt: number;
}

export interface StorageAdapter {
  load(): Promise<Snapshot | null>;
  save(snapshot: Snapshot): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'taiwan-mandarin:v1';

/** Dates come back as strings from JSON; normalize them to Date objects. */
function revive(snapshot: Snapshot): Snapshot {
  const cards: Record<string, CardRecord> = {};
  for (const [id, record] of Object.entries(snapshot.cards ?? {})) {
    cards[id] = { card: TypeConvert.card(record.card), updatedAt: record.updatedAt };
  }
  return { ...snapshot, cards };
}

export class IndexedDbAdapter implements StorageAdapter {
  private db: Promise<IDBDatabase> | undefined;

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('taiwan-mandarin', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.db;
  }

  private async run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction('kv', mode);
      const request = op(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async load(): Promise<Snapshot | null> {
    const value = await this.run<Snapshot | undefined>('readonly', (s) => s.get(KEY));
    return value ? revive(value) : null;
  }

  async save(snapshot: Snapshot): Promise<void> {
    await this.run('readwrite', (s) => s.put(snapshot, KEY));
  }

  async clear(): Promise<void> {
    await this.run('readwrite', (s) => s.delete(KEY));
  }
}

export class LocalStorageAdapter implements StorageAdapter {
  async load(): Promise<Snapshot | null> {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? revive(JSON.parse(raw) as Snapshot) : null;
    } catch {
      return null;
    }
  }

  async save(snapshot: Snapshot): Promise<void> {
    try {
      localStorage.setItem(KEY, JSON.stringify(snapshot));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(KEY);
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
  clear = () => this.attempt((a) => a.clear());
}
