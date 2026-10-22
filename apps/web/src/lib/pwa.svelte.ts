// The service worker and app updates. A new version waits until the learner chooses to reload
// (never mid-answer by surprise); the app checks for one every hour while it stays open.

import { registerSW } from 'virtual:pwa-register';

const CHECK_EVERY_MS = 60 * 60_000;

class Pwa {
  /** A new version is installed and waiting for a reload. */
  needRefresh = $state(false);
  private update: ((reloadPage?: boolean) => Promise<void>) | null = null;

  start(onOfflineReady: () => void): void {
    if (!('serviceWorker' in navigator)) return;
    this.update = registerSW({
      onNeedRefresh: () => (this.needRefresh = true),
      onOfflineReady,
      onRegisteredSW: (_url, registration) => {
        if (registration) setInterval(() => void registration.update(), CHECK_EVERY_MS);
      },
    });
  }

  /** Activates the waiting version and reloads into it. */
  reload(): void {
    void this.update?.(true);
  }

  later(): void {
    this.needRefresh = false;
  }
}

export const pwa = new Pwa();
