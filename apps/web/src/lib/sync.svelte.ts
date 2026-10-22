// Account and sync. Signed out, the app is fully local. Signed in, it syncs on start, when it
// becomes visible again, a few seconds after changes, and on sign-in (the first sign-in on a device
// merges its local progress into the account).

import type { Settings } from '@taiwan-mandarin/shared';
import type {
  AuthResponse,
  CardRecordDto,
  LoginBody,
  RegisterBody,
  SyncRequest,
  SyncResponse,
  UserDto,
} from '@taiwan-mandarin/shared/api';
import { TypeConvert, type Card } from 'ts-fsrs';
import { api, ApiError, onSessionLost, refreshSession, setSession } from './api';
import type { CardRecord } from './storage';
import { store } from './store.svelte';

const toDto = (wordId: string, r: CardRecord): CardRecordDto => ({
  wordId,
  updatedAt: r.updatedAt,
  ...(r.level ? { level: r.level } : {}),
  ...(r.suspended ? { suspended: true } : {}),
  card: {
    due: r.card.due.toISOString(),
    stability: r.card.stability,
    difficulty: r.card.difficulty,
    elapsed_days: r.card.elapsed_days,
    scheduled_days: r.card.scheduled_days,
    learning_steps: r.card.learning_steps ?? 0,
    reps: r.card.reps,
    lapses: r.card.lapses,
    state: r.card.state,
    last_review: r.card.last_review?.toISOString() ?? null,
  },
});

const fromDto = (dto: CardRecordDto): [string, CardRecord] => [
  dto.wordId,
  {
    card: TypeConvert.card(dto.card as unknown as Card),
    updatedAt: dto.updatedAt,
    ...(dto.level ? { level: dto.level as CardRecord['level'] } : {}),
    ...(dto.suspended ? { suspended: true } : {}),
  },
];

class Account {
  user = $state<UserDto | null>(null);
  /** Checked the refresh cookie at startup. */
  checked = $state(false);
  syncing = $state(false);
  lastSync = $state<Date | null>(null);
  error = $state<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;

  async init(): Promise<void> {
    onSessionLost(() => (this.user = null));
    const session = await refreshSession();
    this.user = session?.user ?? null;
    this.checked = true;
    store.onLocalChange = () => this.scheduleSync();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.sync();
    });
    addEventListener('online', () => void this.sync());
    if (this.user) await this.sync();
  }

  async register(body: RegisterBody): Promise<void> {
    this.signedIn(
      await api<AuthResponse>('/v1/auth/register', { method: 'POST', body, auth: false }),
    );
    await this.sync();
  }

  async login(body: LoginBody): Promise<void> {
    this.signedIn(await api<AuthResponse>('/v1/auth/login', { method: 'POST', body, auth: false }));
    await this.sync();
  }

  async logout(): Promise<void> {
    await api('/v1/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
    setSession(null);
    this.user = null;
  }

  async deleteAccount(): Promise<void> {
    await api('/v1/auth/me', { method: 'DELETE' });
    setSession(null);
    this.user = null;
  }

  /** Debounced sync a few seconds after local changes. */
  scheduleSync(delay = 5000): void {
    if (!this.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), delay);
  }

  async sync(): Promise<void> {
    if (!this.user || this.syncing || !navigator.onLine) return;
    clearTimeout(this.timer);
    this.syncing = true;
    this.error = null;
    try {
      store.useAccount(this.user.id);
      const local = await store.pendingChanges();
      const request: SyncRequest = {
        since: store.syncState.cursor,
        cards: local.cards.map(([id, r]) => toDto(id, r)),
        reviews: local.reviews.map((r) => ({ ...r, pending: undefined })),
        deck: { entries: $state.snapshot(store.deck), updatedAt: store.syncState.deckUpdatedAt },
        settings: {
          value: $state.snapshot(store.settings),
          updatedAt: store.syncState.settingsUpdatedAt,
        },
        activity: store.activityRequest(),
      };
      const response = await api<SyncResponse>('/v1/sync', { method: 'POST', body: request });
      await store.applyRemote({
        cursor: response.cursor,
        cards: response.cards.map(fromDto),
        settings: response.settings as { value: Settings; updatedAt: number } | undefined,
        deck: response.deck,
        fsrsWeights: response.fsrs?.w,
        acceptedReviews: response.acceptedReviews,
        pushedAt: local.startedAt,
        activity: response.activity,
      });
      this.lastSync = new Date();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.syncing = false;
    }
  }

  private signedIn(session: AuthResponse): void {
    setSession(session.accessToken);
    this.user = session.user;
  }
}

export const account = new Account();
