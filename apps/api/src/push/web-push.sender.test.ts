import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.js';

const sendNotification = vi.hoisted(() => vi.fn(async () => ({ statusCode: 201 })));
vi.mock('web-push', () => ({ default: { sendNotification } }));

const { SEND_TIMEOUT_MS, WebPushSender } = await import('./web-push.sender.js');

const env = {
  WEB_ORIGIN: 'https://example.tw',
  VAPID_PUBLIC_KEY: 'public',
  VAPID_PRIVATE_KEY: 'private',
} as Env;
const target = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/x',
  keys: { p256dh: 'k', auth: 'a' },
};

describe('WebPushSender', () => {
  beforeEach(() => sendNotification.mockClear());

  it('gives a push service a limited time to answer', async () => {
    // Without one, web-push waits for ever, and the reminder job sends one at a time.
    await new WebPushSender(env).send(target, '{}');
    expect(sendNotification).toHaveBeenCalledWith(
      target,
      '{}',
      expect.objectContaining({ timeout: SEND_TIMEOUT_MS }),
    );
    expect(SEND_TIMEOUT_MS).toBeGreaterThan(0);
    expect(SEND_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });

  it('has no key, and sends nothing, without VAPID keys', async () => {
    const sender = new WebPushSender({ WEB_ORIGIN: 'https://example.tw' } as Env);
    expect(sender.publicKey).toBeNull();
    await expect(sender.send(target, '{}')).rejects.toThrow(/not configured/);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
