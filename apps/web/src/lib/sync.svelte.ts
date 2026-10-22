// Account and sync. Signed out, the app is fully local. Signed in, it syncs on start, when it
// becomes visible again, a few seconds after changes, and on sign-in (the first sign-in on a device
// merges its local progress into the account).

import type { Settings } from '@taiwan-mandarin/shared';
import type {
  AuthResponse,
  CardRecordDto,
  ChangePasswordBody,
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

// The signed-in user, so an offline start stays signed in; the session itself is the cookie.
const USER_KEY = 'tm-user';
function remembered(): UserDto | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as UserDto | null;
  } catch {
    return null;
  }
}
function remember(user: UserDto | null): void {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // Private mode or storage blocked: an offline start then shows the sign-in form.
  }
}

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
    onSessionLost(() => this.setUser(null));
    try {
      this.setUser((await refreshSession())?.user ?? null);
    } catch {
      // Offline, or the server is down: still signed in as last time. The next sync refreshes
      // the session, and signs out only if the server says it is gone.
      this.user = remembered();
    }
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
    // Send what this device has first: the next account signed in here starts from its own data.
    await this.sync();
    await api('/v1/auth/logout', { method: 'POST', auth: false }).catch(() => undefined);
    setSession(null);
    this.setUser(null);
  }

  /** Changes the password; the server signs out every other device and renews this session. */
  async changePassword(body: ChangePasswordBody): Promise<void> {
    this.signedIn(await api<AuthResponse>('/v1/auth/password', { method: 'POST', body }));
  }

  /** Signs out on every device, this one included (after sending what this device has). */
  async logoutEverywhere(): Promise<void> {
    await this.sync();
    await api('/v1/auth/logout-all', { method: 'POST' });
    setSession(null);
    this.setUser(null);
  }

  async deleteAccount(): Promise<void> {
    await api('/v1/auth/me', { method: 'DELETE' });
    setSession(null);
    this.setUser(null);
    // The local copy is kept, and belongs to no account: the next sign-in merges it in.
    store.forgetAccount();
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
      await store.useAccount(this.user.id);
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
    this.setUser(session.user);
  }

  private setUser(user: UserDto | null): void {
    this.user = user;
    remember(user);
  }
}

export const account = new Account();
