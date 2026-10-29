// App state with Svelte 5 runes: settings, FSRS cards, the learner's own deck, today's counters,
// the study session, and practice per day (the kintsugi streak and XP). Words come from `content`;
// every answer is also kept as a review log (for stats, sync and personalized FSRS parameters).

import type { IPreview } from 'ts-fsrs';
import {
  advanceQueue,
  buildQueue,
  configureScheduler,
  dayKey,
  intervalTimes,
  newCard,
  preview,
  shouldRequeue,
  Rating,
  type Card,
  type Grade,
} from './srs';
import {
  achievements,
  currentTimeZone,
  DEFAULT_SETTINGS,
  kintsugi,
  LEVEL_IDS,
  practicedDays,
  totalXp,
  XP,
  xpForDay,
  type DayActivity,
  type Settings,
  type Word,
} from '@taiwan-mandarin/shared';
import {
  applyDownload,
  countReview,
  emptyActivity,
  mergedDays,
  rebuildActivity,
  type ActivityState,
} from './activity';
import { content } from './content.svelte';
import { devLanguage } from './i18n/detect';
import { locale, t } from './i18n/index.svelte';
import { toasts } from './toast.svelte';
import {
  BrowserStorage,
  mergeSettings,
  migrate,
  type CardRecord,
  type Daily,
  type ReviewRecord,
  type Snapshot,
  type StorageAdapter,
  type SyncState,
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
  /** Today's local date, kept current when the app comes back and at midnight. */
  today = $state(dayKey(new Date()));
  /** Practice per day: the server's totals plus this device's unsent reviews. Replaced, never mutated. */
  activity = $state.raw<ActivityState>(emptyActivity());
  syncState = $state<SyncState>({ cursor: 0, pushedAt: 0, settingsUpdatedAt: 0, deckUpdatedAt: 0 });
  /** Called after any change worth syncing (set by the account module). */
  onLocalChange: (() => void) | null = null;

  /** Word ids still to study this session; the head is the current card. */
  queue = $state<string[]>([]);
  finished = $state(0);
  stats = $state<SessionStats>(emptyStats());
  revealed = $state(false);
  /** Time until each grade's next review, in ms. */
  intervals = $state<Record<Grade, number> | null>(null);

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
  /** Now, to the minute, so counts of due cards keep up while the app stays open. */
  clock = $state(Date.now());
  dueCount = $derived.by(() => {
    const now = this.clock;
    return Object.values(this.cards).filter((r) => !r.suspended && r.card.due.getTime() <= now)
      .length;
  });

  /** Every day with practice, on all devices (as of the last sync) and this one. */
  days = $derived(mergedDays(this.activity));
  /** The kintsugi streak: missed days mend with gold. */
  streak = $derived(kintsugi(practicedDays(this.days), this.today));
  xp = $derived({ total: totalXp(this.days), today: xpForDay(this.days[this.today]) });
  /** The seal album: milestones earned and on the way. */
  seals = $derived(achievements(this.days, this.streak));
  /** XP earned in this study session. */
  sessionXp = $derived(this.stats.reviewed * XP.review + this.stats.learned * XP.newWord);

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
        if (snapshot.sync) this.syncState = snapshot.sync;
        if (stored.version !== 2) await this.flush();
      }
      // Development only: ?lang=vi shows the app in another language without changing settings.
      const forced = devLanguage();
      if (forced) this.settings.language = forced;
      this.applyLanguage();
      await this.loadActivity(stored && 'activity' in stored ? stored.activity : undefined);
      this.configureFsrs();
      await this.fillMissingLevels();
      await this.startSession();
      this.ready = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  /** The saved activity, caught up with reviews saved after it; rebuilt from the log otherwise. */
  private async loadActivity(saved: ActivityState | undefined): Promise<void> {
    const timeZone = currentTimeZone();
    if (saved && saved.timeZone === timeZone) {
      const missed = await this.storage.reviews(saved.countedUpTo + 1).catch(() => []);
      this.activity = missed.reduce(countReview, saved);
    } else {
      // First run with activity, or the device moved to another time zone.
      this.activity = rebuildActivity(await this.storage.reviews(0).catch(() => []), timeZone);
    }
  }

  private configureFsrs(): void {
    configureScheduler({ retention: this.settings.retention, w: this.syncState.fsrsWeights });
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
    await this.refreshQueue(true);
  }

  /** A new day: today's new-word allowance and the session start over. */
  private rollDay(): void {
    this.today = dayKey(new Date());
    if (this.daily.date !== this.today) {
      this.daily = freshDaily();
      this.finished = 0;
      this.stats = emptyStats();
    }
  }

  /**
   * Rebuild the queue (e.g. settings changed or the app resumed) while keeping stats. Unless
   * `force`d, an answer revealed while the word lists were loading stays open and the queue as it is.
   */
  async refreshQueue(force = false): Promise<void> {
    this.rollDay();
    const now = new Date();
    this.clock = now.getTime();
    const dueLevels = Object.values(this.cards)
      .filter((r) => r.card.due.getTime() <= now.getTime() + 60 * 60_000)
      .flatMap((r) => (r.level ? [r.level] : []));
    await content.ensureLevels([
      ...this.settings.levels,
      ...dueLevels,
      ...this.deck.flatMap((d) => (d.level ? [d.level] : [])),
    ]);
    if (this.revealed && !force) return;
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
    this.syncState.deckUpdatedAt = Date.now();
    this.changed();
    if (!this.revealed) void this.refreshQueue();
  }

  removeFromDeck(id: string): void {
    this.deck = this.deck.filter((d) => d.id !== id);
    this.syncState.deckUpdatedAt = Date.now();
    this.changed();
  }

  setSuspended(id: string, suspended: boolean): void {
    const record = this.cards[id];
    if (!record) return;
    record.suspended = suspended || undefined;
    record.updatedAt = Date.now();
    this.changed();
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
    this.intervals = intervalTimes(this.pending.preview, at);
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
    if (isNew && this.inDeck(id)) {
      this.deck = this.deck.filter((d) => d.id !== id);
      this.syncState.deckUpdatedAt = now;
    }
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
    void this.storage
      .addReview(review)
      .then(() => this.reviewRevision++)
      .catch(() =>
        toasts.show({
          kind: 'info',
          title: t().sync.saveFailed,
          body: t().sync.saveFailedBody,
        }),
      );
    this.activity = countReview(this.activity, review);

    // Past midnight with the answer open: this answer counts for the new day.
    this.rollDay();
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
    this.changed();
  }

  reviews(since?: number): Promise<ReviewRecord[]> {
    return this.storage.reviews(since);
  }

  /** Shows the app, and loads its content, in the learner's language. */
  private applyLanguage(): void {
    locale.lang = this.settings.language;
    locale.hanViet = this.settings.hanViet;
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    if (patch.language !== undefined || patch.hanViet !== undefined) this.applyLanguage();
    this.syncState.settingsUpdatedAt = Date.now();
    if (patch.retention !== undefined) this.configureFsrs();
    this.changed();
    if ((patch.newPerDay !== undefined || patch.levels !== undefined) && !this.revealed) {
      await this.refreshQueue();
    }
  }

  /** Deletes all progress on this device (the account's copy is deleted first by the caller). */
  async resetProgress(): Promise<void> {
    await this.clearProgress({
      cursor: 0,
      pushedAt: 0,
      settingsUpdatedAt: 0,
      deckUpdatedAt: 0,
      ...(this.syncState.userId ? { userId: this.syncState.userId } : {}),
    });
  }

  /** Forgets cards, deck, review log and activity on this device; settings stay. */
  private async clearProgress(sync: SyncState): Promise<void> {
    this.cards = {};
    this.deck = [];
    this.syncState = sync;
    this.daily = freshDaily();
    this.activity = emptyActivity();
    this.configureFsrs();
    await this.storage.clear();
    await this.startSession();
    await this.flush();
    this.reviewRevision++;
  }

  /** Save, and let sync know something changed. */
  private changed(): void {
    this.persist();
    this.onLocalChange?.();
  }

  // ---- Sync (see sync.svelte.ts) ----

  /** Local changes since the last push. */
  async pendingChanges(): Promise<{
    cards: [string, CardRecord][];
    reviews: ReviewRecord[];
    startedAt: number;
  }> {
    const startedAt = Date.now();
    const cards = Object.entries($state.snapshot(this.cards) as Record<string, CardRecord>).filter(
      ([, r]) => r.updatedAt > this.syncState.pushedAt,
    );
    const reviews = (await this.storage.reviews(0)).filter((r) => r.pending);
    return { cards, reviews, startedAt };
  }

  /**
   * Signed in to another account than at the last sync. This device's progress is the other
   * account's (it was sent before signing out), so start over from this account's.
   */
  async useAccount(userId: string): Promise<void> {
    if (this.syncState.userId === userId) return;
    // Before accounts were remembered, or after deleting one, local progress belongs to whoever
    // signs in next: the first sync merges it into their account.
    if (this.syncState.userId === undefined) {
      this.syncState = { ...this.syncState, userId };
      this.activity = { ...this.activity, remote: {}, cursor: 0, remoteComplete: false };
      return;
    }
    await this.clearProgress({
      cursor: 0,
      pushedAt: 0,
      settingsUpdatedAt: 0,
      deckUpdatedAt: 0,
      userId,
    });
  }

  /** The account was deleted: keep the local copy, tied to no account. */
  forgetAccount(): void {
    const { settingsUpdatedAt, deckUpdatedAt } = this.syncState;
    this.syncState = { cursor: 0, pushedAt: 0, settingsUpdatedAt, deckUpdatedAt };
    this.configureFsrs();
    this.persist();
  }

  /** What the next sync asks about activity: every day until we have them all, then changes. */
  activityRequest(): { timeZone: string; since: number } {
    const a = this.activity;
    return { timeZone: a.timeZone, since: a.remoteComplete ? a.cursor : 0 };
  }

  /** Applies the server's answer: newer cards, settings and deck, personal FSRS weights. */
  async applyRemote(remote: {
    cursor: number;
    cards: [string, CardRecord][];
    settings?: { value: Settings; updatedAt: number };
    deck?: { entries: Snapshot['deck']; updatedAt: number };
    fsrsWeights?: number[];
    acceptedReviews: string[];
    pushedAt: number;
    activity?: { timeZone: string; full: boolean; days: DayActivity[] };
  }): Promise<void> {
    for (const [id, record] of remote.cards) {
      const local = this.cards[id];
      if (!local || local.updatedAt <= record.updatedAt) this.cards[id] = record;
    }
    if (remote.settings && remote.settings.updatedAt > this.syncState.settingsUpdatedAt) {
      this.settings = mergeSettings(this.settings, remote.settings.value);
      this.applyLanguage();
      this.syncState.settingsUpdatedAt = remote.settings.updatedAt;
    }
    if (remote.deck && remote.deck.updatedAt > this.syncState.deckUpdatedAt) {
      this.deck = remote.deck.entries;
      this.syncState.deckUpdatedAt = remote.deck.updatedAt;
    }
    this.syncState.cursor = remote.cursor;
    this.syncState.pushedAt = remote.pushedAt;
    if (remote.fsrsWeights) this.syncState.fsrsWeights = remote.fsrsWeights;
    this.configureFsrs();
    await this.storage.markSynced(remote.acceptedReviews);
    if (remote.activity) {
      // Everything pending when the sync began was sent; what is pending now came later (its
      // review time is when the card was turned over, up to ten minutes earlier).
      const unsent = (await this.storage.reviews(remote.pushedAt - 10 * 60_000)).filter(
        (r) => r.pending,
      );
      this.activity = applyDownload(this.activity, remote.activity, remote.cursor, unsent);
    }
    await this.flush();
    if (!this.revealed) await this.refreshQueue();
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
        sync: $state.snapshot(this.syncState),
        activity: this.activity,
      })
      .catch(() => {});
  }

  /**
   * Flush pending writes when the page is hidden; refresh the queue when it comes back. Keeps
   * `today` right across midnight too, for the streak.
   */
  watchVisibility(): () => void {
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        if (this.saveTimer) void this.flush();
      } else {
        this.clock = Date.now();
        this.rollDay();
        if (!this.revealed) void this.refreshQueue();
      }
    };
    let midnight: ReturnType<typeof setTimeout> | undefined;
    const atMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      midnight = setTimeout(() => {
        // A new day while the app is open: fresh new-word allowance, and its new words queued.
        this.rollDay();
        if (!this.revealed) void this.refreshQueue();
        atMidnight();
      }, next.getTime() - Date.now());
    };
    atMidnight();
    const minute = setInterval(() => (this.clock = Date.now()), 60_000);
    document.addEventListener('visibilitychange', onChange);
    return () => {
      clearTimeout(midnight);
      clearInterval(minute);
      document.removeEventListener('visibilitychange', onChange);
    };
  }

  private hideAnswer(): void {
    this.revealed = false;
    this.pending = null;
    this.intervals = null;
  }
}

export const store = new Store(new BrowserStorage());
