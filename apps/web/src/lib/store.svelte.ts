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
  activeLooks,
  currentTimeZone,
  dayKeyIn,
  DEFAULT_SETTINGS,
  kintsugi,
  LEVEL_IDS,
  practicedDays,
  totalXp,
  XP,
  xpForDay,
  type DayActivity,
  type Lang,
  type LookOf,
  type PracticeKind,
  type Settings,
  type Slot,
  type Word,
} from '@taiwan-mandarin/shared';
import { fillParams, MAX_DECK } from '@taiwan-mandarin/shared/api';
import {
  applyDownload,
  countPractice,
  countReview,
  emptyActivity,
  mergedDays,
  rebuildActivity,
  type ActivityState,
} from './activity';
import { content } from './content.svelte';
import { devLanguage, firstRunLanguage } from './i18n/detect';
import { locale, t } from './i18n/index.svelte';
import type { ExportData } from './export';
import { unsentSince, UNSENT_MARGIN_MS } from './sync-batches';
import { toasts } from './toast.svelte';
import { uuid } from './uuid';
import {
  adoptSnapshot,
  askToKeepData,
  BrowserStorage,
  mergeSettings,
  migrate,
  readSaveStamp,
  SAVE_STAMP_KEY,
  writeSaveStamp,
  type CardRecord,
  type Daily,
  type PracticeRecord,
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
/** Held while a tab takes in the others' saves and saves its own (see flush). */
const SAVE_LOCK = 'taiwan-mandarin:save';

class Store {
  ready = $state(false);
  error = $state<string | null>(null);
  /** A first visit follows the browser's language; saved settings replace these in init(). */
  settings = $state<Settings>({ ...DEFAULT_SETTINGS, language: firstRunLanguage() });
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
  /** The looks in use: chosen ones the ink has unlocked, defaults elsewhere. */
  looks = $derived(activeLooks(this.settings.looks, this.xp.total));
  /** The seal album: milestones earned and on the way. */
  seals = $derived(achievements(this.days, this.streak));
  /** XP earned in this study session. */
  sessionXp = $derived(this.stats.reviewed * XP.review + this.stats.learned * XP.newWord);

  private pending: { preview: IPreview; at: Date } | null = null;
  private shownAt = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private storage: StorageAdapter;
  private askedToKeepData = false;
  /** Names this tab in the save stamp, so two saves in the same millisecond still differ. */
  private readonly tab = uuid();
  /** The save stamp this tab last wrote or took in; another one means another tab saved since. */
  private seenStamp: string | null = null;
  /** Cards changed here and not saved yet: kept when another tab's save is taken in. */
  private unsaved = new Set<string>();
  /** Answers and practice counted here and not saved yet: counted again on top of that save. */
  private uncounted: { reviews: ReviewRecord[]; practice: PracticeRecord[] } = {
    reviews: [],
    practice: [],
  };
  private adopting: Promise<void> | null = null;
  /** A sync in this run has sent everything the logs held; later ones read only recent entries. */
  private sentAll = false;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async init(): Promise<void> {
    try {
      const manifest = await content.init();
      // Read before the snapshot: a save that lands in between is then seen as a newer one.
      this.seenStamp = readSaveStamp();
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
      const since = saved.countedUpTo + 1;
      const missed = await this.storage.reviews(since).catch(() => []);
      const missedPractice = await this.storage.practice(since).catch(() => []);
      this.activity = missedPractice.reduce(countPractice, missed.reduce(countReview, saved));
    } else {
      // First run with activity, or the device moved to another time zone.
      this.activity = rebuildActivity(
        await this.storage.reviews(0).catch(() => []),
        await this.storage.practice(0).catch(() => []),
        timeZone,
      );
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

  /**
   * Adds words to the learner's deck, skipping ones already in it or studied; they come before
   * the path's new words. A full deck (MAX_DECK, what one sync can carry) takes no more.
   */
  addToDeck(...words: Pick<Word, 'id' | 'level'>[]): void {
    const inDeck = new Set(this.deck.map((d) => d.id));
    // Each word once, and only those not studied or in the deck yet.
    const fresh = [...new Map(words.map((w) => [w.id, w])).values()].filter(
      (w) => !this.cards[w.id] && !inDeck.has(w.id),
    );
    const room = Math.max(0, MAX_DECK - this.deck.length);
    if (fresh.length > room) {
      toasts.show({
        kind: 'info',
        title: fillParams(t().errors.codes.deckFull, { limit: MAX_DECK }),
      });
    }
    const now = Date.now();
    const added = fresh.slice(0, room).map((w) => ({ id: w.id, level: w.level, addedAt: now }));
    if (!added.length) return;
    this.deck = [...this.deck, ...added];
    this.syncState.deckUpdatedAt = now;
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
    this.unsaved.add(id);
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
    if (!this.askedToKeepData) {
      this.askedToKeepData = true;
      void askToKeepData();
    }
    const { card, log } = this.pending.preview[grade];
    const isNew = !this.cards[id];
    const requeue = shouldRequeue(grade, card, this.pending.at);
    const now = Date.now();

    this.cards[id] = {
      card,
      updatedAt: now,
      level: content.word(id)?.level ?? this.cards[id]?.level,
    };
    this.unsaved.add(id);
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
    this.uncounted.reviews.push(review);

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

  /** All the learner's data on this device. Reviews sync upward only: others' aren't here. */
  async exportData(): Promise<ExportData> {
    return {
      settings: $state.snapshot(this.settings),
      cards: $state.snapshot(this.cards),
      deck: $state.snapshot(this.deck),
      reviews: await this.storage.reviews(0),
      practice: await this.storage.practice(0),
    };
  }

  /**
   * Practice away from the cards, for XP: a story read to the end, a message sent in Talk, a
   * character written. The same story or character counts once a day; false when it already has.
   */
  async practiced(kind: PracticeKind, ref: string): Promise<boolean> {
    const at = Date.now();
    const { timeZone } = this.activity;
    const today = dayKeyIn(at, timeZone);
    const recent = await this.storage.practice(at - 26 * 3_600_000).catch(() => []);
    if (recent.some((p) => p.kind === kind && p.ref === ref && dayKeyIn(p.at, timeZone) === today))
      return false;
    const entry: PracticeRecord = { id: uuid(), kind, ref, at, pending: true };
    try {
      await this.storage.addPractice(entry);
    } catch {
      return false;
    }
    this.activity = countPractice(this.activity, entry);
    this.uncounted.practice.push(entry);
    this.changed();
    return true;
  }

  /** Shows the app, and loads its content, in the learner's language. */
  private applyLanguage(): void {
    locale.lang = this.settings.language;
    locale.hanViet = this.settings.hanViet;
    content.setLanguage(this.settings.language);
  }

  /**
   * Switches the language. Before this device has synced with any account it changes nothing
   * else and stays the oldest version of the settings, so signing in to an existing account
   * keeps that account's settings (its levels, its pace) rather than replacing them with this
   * device's defaults.
   */
  async chooseLanguage(language: Lang): Promise<void> {
    if (this.syncState.userId === undefined && this.syncState.settingsUpdatedAt === 0) {
      this.settings = { ...this.settings, language };
      this.applyLanguage();
      this.persist();
      return;
    }
    await this.updateSettings({ language });
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

  /** Uses a look ink has unlocked (it syncs with the settings). */
  async chooseLook<S extends Slot>(slot: S, value: LookOf<S>): Promise<void> {
    await this.updateSettings({ looks: { ...this.settings.looks, [slot]: value } });
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
    this.unsaved.clear();
    this.uncounted = { reviews: [], practice: [] };
    this.configureFsrs();
    await this.storage.clear();
    await this.startSession();
    // Over whatever another tab saved meanwhile: starting over is meant for all of them.
    await this.flush({ overwrite: true });
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
    practice: PracticeRecord[];
    startedAt: number;
  }> {
    const startedAt = Date.now();
    const cards = Object.entries($state.snapshot(this.cards) as Record<string, CardRecord>).filter(
      ([, r]) => r.updatedAt > this.syncState.pushedAt,
    );
    const since = unsentSince(this.syncState.pushedAt, this.sentAll);
    const reviews = (await this.storage.reviews(since)).filter((r) => r.pending);
    const practice = (await this.storage.practice(since)).filter((p) => p.pending);
    return { cards, reviews, practice, startedAt };
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

  /** The server's cards over this device's, where the server's copy is as new or newer. */
  private mergeCards(cards: [string, CardRecord][]): void {
    for (const [id, record] of cards) {
      const local = this.cards[id];
      if (!local || local.updatedAt <= record.updatedAt) this.cards[id] = record;
    }
  }

  /**
   * One request of a sync sent in several (a long history never sent before): what the server
   * stored is no longer waiting, and its newer copies of the cards sent are taken. The cursor and
   * everything else come with the last request (applyRemote), so a sync that stops halfway sends
   * the cards again and loses nothing.
   */
  async applySent(remote: {
    cards: [string, CardRecord][];
    acceptedReviews: string[];
    acceptedPractice: string[];
  }): Promise<void> {
    this.mergeCards(remote.cards);
    await this.storage.markSynced(remote.acceptedReviews);
    await this.storage.markPracticeSynced(remote.acceptedPractice);
    this.persist();
  }

  /** Applies the server's answer: newer cards, settings and deck, personal FSRS weights. */
  async applyRemote(remote: {
    cursor: number;
    cards: [string, CardRecord][];
    settings?: { value: Settings; updatedAt: number };
    deck?: { entries: Snapshot['deck']; updatedAt: number };
    fsrsWeights?: number[];
    acceptedReviews: string[];
    acceptedPractice: string[];
    pushedAt: number;
    activity?: { timeZone: string; full: boolean; days: DayActivity[] };
  }): Promise<void> {
    this.mergeCards(remote.cards);
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
    await this.storage.markPracticeSynced(remote.acceptedPractice);
    this.sentAll = true;
    if (remote.activity) {
      // Everything pending when the sync began was sent; what is pending now came later (its
      // review time is when the card was turned over, which may be hours earlier).
      const since = remote.pushedAt - UNSENT_MARGIN_MS;
      const unsent = (await this.storage.reviews(since)).filter((r) => r.pending);
      const unsentPractice = (await this.storage.practice(since)).filter((p) => p.pending);
      this.activity = applyDownload(
        this.activity,
        remote.activity,
        remote.cursor,
        unsent,
        unsentPractice,
      );
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

  /**
   * Saves everything this tab holds. Another tab's save since this one last looked is taken in
   * first (see catchUp), so saving never puts that tab's progress back; `overwrite` skips that.
   */
  async flush(options: { overwrite?: boolean } = {}): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    // One tab at a time: two taking in each other's saves at once would both miss the other's
    // and the later save would drop the other's cards. Without locks (older browsers), as before.
    const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
    if (locks) await locks.request(SAVE_LOCK, () => this.save(options));
    else await this.save(options);
  }

  private async save(options: { overwrite?: boolean }): Promise<void> {
    if (!options.overwrite) await this.catchUp();
    // What is saved now; a card changed while the save is on its way waits for the next one.
    const saving = { cards: this.unsaved, counted: this.uncounted };
    this.unsaved = new Set();
    this.uncounted = { reviews: [], practice: [] };
    const updatedAt = Date.now();
    try {
      await this.storage.save({
        version: 2,
        settings: $state.snapshot(this.settings),
        cards: $state.snapshot(this.cards) as Record<string, CardRecord>,
        deck: $state.snapshot(this.deck),
        daily: $state.snapshot(this.daily),
        updatedAt,
        sync: $state.snapshot(this.syncState),
        activity: this.activity,
      });
      const stamp = `${updatedAt}:${this.tab}`;
      if (writeSaveStamp(stamp)) this.seenStamp = stamp;
    } catch {
      for (const id of saving.cards) this.unsaved.add(id);
      this.uncounted = {
        reviews: [...saving.counted.reviews, ...this.uncounted.reviews],
        practice: [...saving.counted.practice, ...this.uncounted.practice],
      };
    }
  }

  /**
   * Takes in what another tab (or the installed app beside the browser) saved since this one last
   * looked. Called before every save, when the browser says another tab saved, and when this tab
   * comes back. Never fails.
   */
  async catchUp(): Promise<void> {
    const stamp = readSaveStamp();
    if (stamp === null || stamp === this.seenStamp) return;
    this.adopting ??= this.adopt(stamp)
      .catch(() => undefined)
      .finally(() => (this.adopting = null));
    await this.adopting;
  }

  private async adopt(stamp: string): Promise<void> {
    const stored = await this.storage.load();
    this.seenStamp = stamp;
    // Cleared (the other tab is starting over; its save follows) or from an older app.
    if (!stored || stored.version !== 2) return;
    const next = adoptSnapshot(
      {
        settings: $state.snapshot(this.settings),
        cards: $state.snapshot(this.cards) as Record<string, CardRecord>,
        deck: $state.snapshot(this.deck),
        daily: $state.snapshot(this.daily),
        sync: $state.snapshot(this.syncState),
      },
      stored,
      this.unsaved,
    );
    this.settings = next.settings;
    this.cards = next.cards;
    this.deck = next.deck;
    this.daily = next.daily;
    this.syncState = next.sync;
    this.applyLanguage();
    this.configureFsrs();
    // The other tab's totals hold everything saved so far; this tab's unsaved answers go on top.
    const totals = stored.activity;
    if (totals && totals.timeZone === currentTimeZone()) {
      this.activity = this.uncounted.practice.reduce(
        countPractice,
        this.uncounted.reviews.reduce(countReview, totals),
      );
    } else await this.loadActivity(undefined);
    this.reviewRevision++;
    // The other tab's answers are no longer due here. An open answer stays as it is.
    if (!this.revealed) void this.refreshQueue();
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
        // A tab that slept may not have heard of another's saves.
        void this.catchUp().then(() => {
          if (!this.revealed) void this.refreshQueue();
        });
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SAVE_STAMP_KEY) void this.catchUp();
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
    addEventListener('storage', onStorage);
    return () => {
      clearTimeout(midnight);
      clearInterval(minute);
      document.removeEventListener('visibilitychange', onChange);
      removeEventListener('storage', onStorage);
    };
  }

  private hideAnswer(): void {
    this.revealed = false;
    this.pending = null;
    this.intervals = null;
  }
}

export const store = new Store(new BrowserStorage());
