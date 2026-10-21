// App state with Svelte 5 runes: settings, FSRS cards, the learner's own deck, today's counters
// and the study session. Words come from `content`; every answer is also kept as a review log
// (for stats, sync and personalized FSRS parameters).

import type { IPreview } from 'ts-fsrs';
import {
  advanceQueue,
  buildQueue,
  configureScheduler,
  dayKey,
  intervalLabels,
  newCard,
  preview,
  shouldRequeue,
  Rating,
  type Card,
  type Grade,
} from './srs';
import { DEFAULT_SETTINGS, LEVEL_IDS, type Settings, type Word } from '@taiwan-mandarin/shared';
import { content } from './content.svelte';
import {
  BrowserStorage,
  migrate,
  type CardRecord,
  type Daily,
  type ReviewRecord,
  type Snapshot,
  type StorageAdapter,
} from './storage';

export interface SessionStats {
  reviewed: number;
  learned: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

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

/** crypto.randomUUID needs a secure context; plain-http LAN testing (an iPad on 192.168.x) has none. */
export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

class Store {
  ready = $state(false);
  error = $state<string | null>(null);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  cards = $state<Record<string, CardRecord>>({});
  deck = $state<Snapshot['deck']>([]);
  daily = $state<Daily>(freshDaily());
  /** Bumped after every review, so stats reload. */
  reviewRevision = $state(0);

  /** Word ids still to study this session; the head is the current card. */
  queue = $state<string[]>([]);
  finished = $state(0);
  stats = $state<SessionStats>(emptyStats());
  revealed = $state(false);
  intervals = $state<Record<Grade, string> | null>(null);

  current: Word | undefined = $derived(this.queue[0] ? content.word(this.queue[0]) : undefined);
  progress = $derived(
    this.finished + this.queue.length === 0
      ? 1
      : this.finished / (this.finished + this.queue.length),
  );
  nextDue: Date | null = $derived.by(() => {
    let min: Date | null = null;
    for (const { card, suspended } of Object.values(this.cards)) {
      if (!suspended && (!min || card.due < min)) min = card.due;
    }
    return min;
  });
  dueCount = $derived.by(() => {
    const now = Date.now();
    return Object.values(this.cards).filter((r) => !r.suspended && r.card.due.getTime() <= now)
      .length;
  });

  private pending: { preview: IPreview; at: Date } | null = null;
  private shownAt = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async init(): Promise<void> {
    try {
      const manifest = await content.init();
      const stored = await this.storage.load().catch(() => null);
      if (stored) {
        const snapshot = migrate(stored, manifest.legacyIds);
        this.settings = { ...DEFAULT_SETTINGS, ...snapshot.settings };
        this.cards = snapshot.cards;
        this.deck = snapshot.deck ?? [];
        this.daily = snapshot.daily ?? freshDaily();
        if (stored.version !== 2) await this.flush();
      }
      configureScheduler({ retention: this.settings.retention });
      await this.fillMissingLevels();
      await this.startSession();
      this.ready = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** Migrated cards don't know their level yet; find it once so later loads are direct. */
  private async fillMissingLevels(): Promise<void> {
    let changed = false;
    for (const [id, record] of Object.entries(this.cards)) {
      if (record.level) continue;
      const word = await content.findWord(id);
      if (word) {
        record.level = word.level;
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  /** New words in study order: the learner's own deck first, then the active path levels. */
  private candidates(): string[] {
    const fromDeck = this.deck.map((d) => d.id);
    const fromPath = LEVEL_IDS.filter((l) => this.settings.levels.includes(l)).flatMap((l) =>
      content.level(l).map((w) => w.id),
    );
    return [...fromDeck, ...fromPath];
  }

  /** Full restart: new queue and zeroed session stats. */
  async startSession(): Promise<void> {
    this.finished = 0;
    this.stats = emptyStats();
    await this.refreshQueue();
  }

  /** Rebuild the queue (e.g. settings changed or the app resumed) while keeping stats. */
  async refreshQueue(): Promise<void> {
    if (this.daily.date !== dayKey(new Date())) {
      this.daily = freshDaily();
      this.finished = 0;
      this.stats = emptyStats();
    }
    const now = new Date();
    const dueLevels = Object.values(this.cards)
      .filter((r) => r.card.due.getTime() <= now.getTime() + 60 * 60_000)
      .flatMap((r) => (r.level ? [r.level] : []));
    await content.ensureLevels([
      ...this.settings.levels,
      ...dueLevels,
      ...this.deck.flatMap((d) => (d.level ? [d.level] : [])),
    ]);
    const allowance = this.settings.newPerDay - this.daily.newCount;
    const queue = buildQueue(this.cards, this.candidates(), now, allowance);
    // Drop anything whose word file failed to load, rather than showing a blank card.
    this.queue = queue.filter((id) => content.word(id));
    this.hideAnswer();
  }

  cardFor(id: string): Card | undefined {
    return this.cards[id]?.card;
  }

  inDeck(id: string): boolean {
    return this.deck.some((d) => d.id === id);
  }

  /** Adds a word to the learner's deck; it is studied before the path's new words. */
  addToDeck(word: Pick<Word, 'id' | 'level'>): void {
    if (this.cards[word.id] || this.inDeck(word.id)) return;
    this.deck = [...this.deck, { id: word.id, level: word.level, addedAt: Date.now() }];
    this.persist();
    if (!this.revealed) void this.refreshQueue();
  }

  removeFromDeck(id: string): void {
    this.deck = this.deck.filter((d) => d.id !== id);
    this.persist();
  }

  setSuspended(id: string, suspended: boolean): void {
    const record = this.cards[id];
    if (!record) return;
    record.suspended = suspended || undefined;
    record.updatedAt = Date.now();
    this.persist();
    if (!this.revealed) void this.refreshQueue();
  }

  /** Marks the moment the current card is shown, for review durations. */
  markShown(): void {
    this.shownAt = Date.now();
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
    const { card, log } = this.pending.preview[grade];
    const isNew = !this.cards[id];
    const requeue = shouldRequeue(grade, card, this.pending.at);
    const now = Date.now();

    this.cards[id] = {
      card,
      updatedAt: now,
      level: content.word(id)?.level ?? this.cards[id]?.level,
    };
    if (isNew) this.deck = this.deck.filter((d) => d.id !== id);
    const review: ReviewRecord = {
      id: uuid(),
      wordId: id,
      rating: grade,
      state: log.state,
      review: log.review.getTime(),
      due: log.due.getTime(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: log.elapsed_days,
      scheduledDays: log.scheduled_days,
      durationMs: this.shownAt ? Math.min(now - this.shownAt, 10 * 60_000) : 0,
      pending: true,
    };
    void this.storage.addReview(review).then(() => this.reviewRevision++);

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

  reviews(since?: number): Promise<ReviewRecord[]> {
    return this.storage.reviews(since);
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    if (patch.retention !== undefined) configureScheduler({ retention: this.settings.retention });
    this.persist();
    if ((patch.newPerDay !== undefined || patch.levels !== undefined) && !this.revealed) {
      await this.refreshQueue();
    }
  }

  async resetProgress(): Promise<void> {
    this.cards = {};
    this.deck = [];
    this.daily = freshDaily();
    await this.storage.clear();
    await this.startSession();
    await this.flush();
    this.reviewRevision++;
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
        version: 2,
        settings: $state.snapshot(this.settings),
        cards: $state.snapshot(this.cards) as Record<string, CardRecord>,
        deck: $state.snapshot(this.deck),
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
        void this.refreshQueue();
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
