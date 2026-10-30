// The daily reminder on this device (Web Push): whether this browser can get one, turning it on
// and off, and the count of due cards on the app icon. The time is a synced setting; the server
// sends the reminder (apps/api/src/push), the service worker shows it (public/push-sw.js).

import type { PushConfigDto, PushTestDto } from '@taiwan-mandarin/shared/api';
import { api } from './api';

/** `install`: iPhone and iPad get Web Push only in the app added to the Home Screen. */
export type ReminderSupport = 'ok' | 'install' | 'unsupported';

const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPadOS asks for desktop sites, as a Mac with a touch screen.
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function detect(): ReminderSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
    return 'ok';
  }
  return isAppleMobile() && !standalone() ? 'install' : 'unsupported';
}

/** A VAPID key (base64url) as the bytes PushManager.subscribe takes. */
function keyBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = (key + '='.repeat((4 - (key.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const own = sub.options.applicationServerKey;
  if (!own) return false;
  const bytes = new Uint8Array(own);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

/** The account this device's subscription was made for. */
const OWNER_KEY = 'tm-reminder-user';

function owner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

function setOwner(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // nowhere to keep it: refresh() then shows the reminder off
  }
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('No service worker');
  return reg;
}

class Reminders {
  readonly support: ReminderSupport = typeof window === 'undefined' ? 'unsupported' : detect();
  /** The server's key: undefined until asked, null when the server sends no reminders. */
  publicKey = $state<string | null | undefined>(undefined);
  permission = $state<NotificationPermission>(
    typeof Notification === 'undefined' ? 'default' : Notification.permission,
  );
  /** This device has a subscription the account knows. */
  on = $state(false);
  busy = $state(false);

  /** Asks the server for its key and this browser for its subscription (for `userId`'s account). */
  async refresh(userId: string | null): Promise<void> {
    if (this.publicKey === undefined) {
      try {
        this.publicKey = (await api<PushConfigDto>('/v1/push/config', { auth: false })).publicKey;
      } catch {
        return; // offline: ask again next time
      }
    }
    if (this.support !== 'ok') return;
    this.permission = Notification.permission;
    const sub = await navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .catch(() => null);
    // A subscription left by another account (a session that ended without signing out) is not
    // this one's: it stays off until turned on.
    this.on =
      sub !== null && this.permission === 'granted' && userId !== null && owner() === userId;
    // The account's copy follows the browser's (a server that lost it, a renewed subscription).
    if (this.on && sub) {
      void api('/v1/push/subscribe', { method: 'POST', body: sub.toJSON() }).catch(() => undefined);
    }
  }

  /** Turns the reminder on. Call it straight from the tap: Safari asks only from a gesture. */
  async enable(userId: string): Promise<void> {
    if (this.support !== 'ok') return;
    this.busy = true;
    try {
      this.permission = await Notification.requestPermission();
      if (this.permission !== 'granted') return;
      const key = this.publicKey ?? (await api<PushConfigDto>('/v1/push/config')).publicKey;
      if (!key) return;
      const bytes = keyBytes(key);
      const push = (await registration()).pushManager;
      let sub = await push.getSubscription();
      // Made with keys the server no longer has: no push would ever reach it.
      if (sub && !sameKey(sub, bytes)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await push.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await api('/v1/push/subscribe', { method: 'POST', body: sub.toJSON() });
      setOwner(userId);
      this.on = true;
    } finally {
      this.busy = false;
    }
  }

  async disable(): Promise<void> {
    this.busy = true;
    try {
      const sub = await (await registration()).pushManager.getSubscription();
      if (sub) {
        await api('/v1/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } });
        await sub.unsubscribe();
      }
      setOwner(null);
      this.on = false;
    } finally {
      this.busy = false;
    }
  }

  /**
   * Before signing out: the next account signed in here starts without reminders, and nothing
   * reaches this device for the last one. Never fails.
   */
  async forget(): Promise<void> {
    if (this.support !== 'ok') return;
    const sub = await navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .catch(() => null);
    if (!sub) return;
    await api('/v1/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(
      () => undefined,
    );
    await sub.unsubscribe().catch(() => undefined);
    setOwner(null);
    this.on = false;
  }

  /** Sends the reminder now: the devices it went to, and why push services refused it. */
  test(): Promise<PushTestDto> {
    return api<PushTestDto>('/v1/push/test', { method: 'POST' });
  }

  /** The cards due, on the app icon (where the system allows badges: notifications granted). */
  badge(due: number): void {
    if (!('setAppBadge' in navigator) || this.permission !== 'granted') return;
    void (due > 0 ? navigator.setAppBadge(due) : navigator.clearAppBadge()).catch(() => undefined);
  }
}

export const reminders = new Reminders();
