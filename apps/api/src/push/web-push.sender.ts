// Delivery through the browsers' push services (Web Push with VAPID). Its own provider so tests
// can stand in for the push services.

import { Inject, Injectable } from '@nestjs/common';
import webpush from 'web-push';
import { ENV, type Env } from '../config/env.js';

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** A push service's answer when the subscription is gone (unsubscribed, app removed, expired). */
export const isGone = (e: unknown): boolean =>
  typeof e === 'object' &&
  e !== null &&
  'statusCode' in e &&
  (e.statusCode === 404 || e.statusCode === 410);

@Injectable()
export class WebPushSender {
  readonly publicKey: string | null;
  private readonly vapid: (webpush.VapidKeys & { subject: string }) | null;

  constructor(@Inject(ENV) env: Env) {
    const subject =
      env.VAPID_SUBJECT ??
      (env.WEB_ORIGIN.startsWith('https://') ? env.WEB_ORIGIN : 'mailto:reminders@localhost');
    this.vapid =
      env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
        ? { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject }
        : null;
    this.publicKey = this.vapid?.publicKey ?? null;
  }

  /** Sends one message; throws the push service's error (see isGone). */
  async send(target: PushTarget, payload: string): Promise<void> {
    if (!this.vapid)
      throw new Error('Web Push is not configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)');
    await webpush.sendNotification(target, payload, {
      vapidDetails: this.vapid,
      // A reminder that can't be delivered within hours is no longer useful; a newer one replaces
      // one still waiting.
      TTL: 4 * 60 * 60,
      topic: 'daily-reminder',
      urgency: 'normal',
    });
  }
}
