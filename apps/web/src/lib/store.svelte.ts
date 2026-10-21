// App state with Svelte 5 runes: settings, FSRS cards, today's counters and the study session.

import type { IPreview } from 'ts-fsrs';
import {
  advanceQueue,
  buildQueue,
  dayKey,
  intervalLabels,
  newCard,
  preview,
  shouldRequeue,
  Rating,
  type Card,
  type Grade,
} from './srs';
import { VOCAB, WORD_BY_ID, type Settings, type Word } from '@taiwan-mandarin/shared';
import { BrowserStorage, type CardRecord, type Daily, type StorageAdapter } from './storage';

export type Tab = 'study' | 'words' | 'settings';

export interface SessionStats {
  reviewed: number;
  learned: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export const DEFAULT_SETTINGS: Settings = {
  phonetics: 'zhuyin',
  meaning: 'ky',
  glyphStyle: 'kai',
  newPerDay: 10,
};

const WORD_IDS = VOCAB.map((w) => w.id);
const GRADE_KEY = {
  [Rating.Again]: 'again',
  [Rating.Hard]: 'hard',
  [Rating.Good]: 'good',
  [Rating.Easy]: 'easy',
} as const;

const emptyStats = (): SessionStats => ({
  reviewed: 0,
  learned: 0,
  again: 0,
  hard: 0,
  good: 0,
  easy: 0,
});
const freshDaily = (): Daily => ({ date: dayKey(new Date()), newCount: 0, reviewCount: 0 });

class Store {
  ready = $state(false);
  tab = $state<Tab>('study');
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  cards = $state<Record<string, CardRecord>>({});
  daily = $state<Daily>(freshDaily());

  /** Word ids still to study this session; the head is the current card. */
  queue = $state<string[]>([]);
  finished = $state(0);
  stats = $state<SessionStats>(emptyStats());
  revealed = $state(false);
  intervals = $state<Record<Grade, string> | null>(null);

  current: Word | undefined = $derived(this.queue[0] ? WORD_BY_ID.get(this.queue[0]) : undefined);
  progress = $derived(
    this.finished + this.queue.length === 0
      ? 1
      : this.finished / (this.finished + this.queue.length),
  );
  nextDue: Date | null = $derived.by(() => {
    let min: Date | null = null;
    for (const { card } of Object.values(this.cards)) if (!min || card.due < min) min = card.due;
    return min;
  });

  private pending: { preview: IPreview; at: Date } | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async init(): Promise<void> {
    const snapshot = await this.storage.load().catch(() => null);
    if (snapshot) {
      this.settings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
      this.cards = snapshot.cards;
      this.daily = snapshot.daily ?? freshDaily();
    }
    this.startSession();
    this.ready = true;
  }

  /** Full restart: new queue and zeroed session stats. */
  startSession(): void {
    this.finished = 0;
    this.stats = emptyStats();
    this.refreshQueue();
  }

  /** Rebuild the queue (e.g. new limit changed or the app resumed) while keeping stats. */
  refreshQueue(): void {
    if (this.daily.date !== dayKey(new Date())) {
      this.daily = freshDaily();
      this.finished = 0;
      this.stats = emptyStats();
    }
    const cards: Record<string, Card> = {};
    for (const [id, record] of Object.entries(this.cards)) cards[id] = record.card;
    const allowance = this.settings.newPerDay - this.daily.newCount;
    this.queue = buildQueue(WORD_IDS, cards, new Date(), allowance);
    this.hideAnswer();
  }

  cardFor(id: string): Card | undefined {
    return this.cards[id]?.card;
  }

  reveal(): void {
    const id = this.queue[0];
    if (!id || this.revealed) return;
    const at = new Date();
    const card = this.cards[id] ? $state.snapshot(this.cards[id].card) : newCard(at);
    this.pending = { preview: preview(card as Card, at), at };
    this.intervals = intervalLabels(this.pending.preview, at);
    this.revealed = true;
  }

  rate(grade: Grade): void {
    const id = this.queue[0];
    if (!id || !this.revealed || !this.pending) return;
    const { card } = this.pending.preview[grade];
    const isNew = !this.cards[id];
    const requeue = shouldRequeue(grade, card, this.pending.at);

    this.cards[id] = { card, updatedAt: Date.now() };
    this.daily.reviewCount++;
    if (isNew) {
      this.daily.newCount++;
      this.stats.learned++;
    }
    this.stats.reviewed++;
    this.stats[GRADE_KEY[grade]]++;
    if (!requeue) this.finished++;
    this.queue = advanceQueue(this.queue, requeue);
    this.hideAnswer();
    this.persist();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    if (patch.newPerDay !== undefined && !this.revealed) this.refreshQueue();
    this.persist();
  }

  async resetProgress(): Promise<void> {
    this.cards = {};
    this.daily = freshDaily();
    this.startSession();
    await this.flush();
  }

  /** Debounced save; call after every mutation. */
  persist(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), 300);
  }

  async flush(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    await this.storage
      .save({
        version: 1,
        settings: $state.snapshot(this.settings),
        cards: $state.snapshot(this.cards) as Record<string, CardRecord>,
        daily: $state.snapshot(this.daily),
        updatedAt: Date.now(),
      })
      .catch(() => {});
  }

  /** Flush pending writes when the page is hidden; refresh the queue when it comes back. */
  watchVisibility(): () => void {
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        if (this.saveTimer) void this.flush();
      } else if (!this.revealed) {
        this.refreshQueue();
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }

  private hideAnswer(): void {
    this.revealed = false;
    this.pending = null;
    this.intervals = null;
  }
}

export const store = new Store(new BrowserStorage());
