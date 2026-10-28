// Account and sync. Signed out, the app is fully local. Signed in, it syncs on start, when it
// becomes visible again, a few seconds after changes, and on sign-in (the first sign-in on a device
// merges its local progress into the account). The remembered account shows at once; the server
// is asked in the background, and only its "no session" signs the learner out.

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
import {
  api,
  ApiError,
  onSessionLost,
  onSessionRenewed,
  refreshSession,
  sessionFresh,
  setSession,
} from './api';
import type { CardRecord } from './storage';
import { store } from './store.svelte';
import { toasts } from './toast.svelte';

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
/** Set when signing out failed to reach the server, so the cookie is still revoked later. */
const LOGOUT_KEY = 'tm-logout-pending';
/** The account remembered on this device, if any (readable before the account module starts). */
export function rememberedUser(): UserDto | null {
  return remembered();
}

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
  /** Startup is done: the remembered account (if any) is shown and the server has been asked. */
  checked = $state(false);
  /** Still asking the server whether the remembered session holds. */
  verifying = $state(false);
  syncing = $state(false);
  lastSync = $state<Date | null>(null);
  error = $state<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private inflight: Promise<void> | null = null;

  async init(): Promise<void> {
    onSessionLost(() => this.sessionLost());
    // Another tab's session: a refresh answers for the account whose cookie the browser holds.
    onSessionRenewed((session) => {
      if (session.user.id !== this.user?.id) this.setUser(session.user);
    });
    store.onLocalChange = () => this.scheduleSync();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.resume();
    });
    addEventListener('online', () => void this.resume());
    // Signing in or out in another tab: follow it.
    addEventListener('storage', (event) => {
      if (event.key !== USER_KEY && event.key !== null) return;
      const other = remembered();
      if (other?.id === this.user?.id) return;
      this.user = other;
      setSession(null);
      if (other) void this.sync();
    });

    if (this.pendingLogout()) await this.finishLogout();
    // Show the remembered account straight away; the server is asked in the background.
    this.user = this.pendingLogout() ? null : remembered();
    this.checked = true;
    this.verifying = true;
    try {
      const session = await refreshSession();
      // Offline, or the server is down: still signed in as last time. The next sync refreshes
      // the session, and signs out only if the server says it is gone.
      if (!session) this.setUser(null);
      else if (session.user.id !== this.user?.id) this.setUser(session.user);
    } catch {
      // keep the remembered user
    } finally {
      this.verifying = false;
    }
    if (this.user) await this.sync();
  }

  /** The app is back (or back online): a fresh token first, then sync. */
  private async resume(): Promise<void> {
    if (this.pendingLogout()) {
      await this.finishLogout();
      return;
    }
    if (!this.user || !navigator.onLine) return;
    if (!sessionFresh()) await refreshSession().catch(() => null);
    await this.sync();
  }

  private sessionLost(): void {
    const was = this.user;
    this.setUser(null);
    if (was) {
      toasts.show({
        kind: 'info',
        title: 'Signed out',
        body: 'Your session ended. Sign in again to keep syncing.',
      });
    }
  }

  private pendingLogout(): boolean {
    try {
      return localStorage.getItem(LOGOUT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private markLogout(pending: boolean): void {
    try {
      if (pending) localStorage.setItem(LOGOUT_KEY, '1');
      else localStorage.removeItem(LOGOUT_KEY);
    } catch {
      // nothing to remember it in
    }
  }

  /** Revokes the cookie of a sign-out that happened offline; stays pending if still offline. */
  private async finishLogout(): Promise<void> {
    try {
      await api('/v1/auth/logout', { method: 'POST', auth: false });
      this.markLogout(false);
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) this.markLogout(false);
    }
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
    await this.sync().catch(() => undefined);
    setSession(null);
    this.setUser(null);
    // Offline, the cookie would bring the session back at the next start: finish it later.
    this.markLogout(true);
    await this.finishLogout();
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

  /** Syncs now; a sync already running is shared, so a caller waits for its changes to go out. */
  sync(): Promise<void> {
    if (!this.user || !navigator.onLine) return Promise.resolve();
    this.inflight ??= this.run().finally(() => (this.inflight = null));
    return this.inflight;
  }

  private async run(): Promise<void> {
    if (!this.user) return;
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
      // A 401 here already signed the learner out (see api.ts); the status line says so.
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.syncing = false;
    }
  }

  private signedIn(session: AuthResponse): void {
    this.markLogout(false);
    setSession(session.accessToken, session.expiresIn);
    this.setUser(session.user);
  }

  private setUser(user: UserDto | null): void {
    this.user = user;
    remember(user);
  }
}

export const account = new Account();
