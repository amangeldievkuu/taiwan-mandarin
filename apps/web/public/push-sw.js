// The daily reminder, in the service worker (imported by the generated one, see vite.config.ts).
// Every push shows a notification: Safari takes the permission back from pushes that show none.

self.addEventListener('push', (event) => {
  const data = read(event.data);
  const title = data.title || '墨 · 練習時間';
  const shown = self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/pwa-192x192.png',
    lang: 'zh-Hant-TW',
    tag: 'daily-reminder',
    data: { url: data.url || '/' },
  });
  const badge =
    typeof data.due === 'number' && 'setAppBadge' in self.navigator
      ? data.due > 0
        ? self.navigator.setAppBadge(data.due)
        : self.navigator.clearAppBadge()
      : Promise.resolve();
  event.waitUntil(Promise.all([shown, badge.catch(() => undefined)]));
});

/** The JSON payload, or plain text as the body. */
function read(message) {
  if (!message) return {};
  try {
    return message.json();
  } catch {
    return { body: message.text() };
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
