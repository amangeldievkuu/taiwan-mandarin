// Devices that turned the daily reminder on, and sending to all of a learner's devices.

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PushPayload, PushSubscribeBody } from '@taiwan-mandarin/shared/api';
import { PrismaService } from '../prisma/prisma.service.js';
import { isGone, WebPushSender } from './web-push.sender.js';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(WebPushSender) private readonly sender: WebPushSender,
  ) {}

  get publicKey(): string | null {
    return this.sender.publicKey;
  }

  /** Stores a device's subscription; a browser that signed in to another account moves over. */
  async subscribe(userId: string, { endpoint, keys }: PushSubscribeBody): Promise<void> {
    const data = { userId, p256dh: keys.p256dh, auth: keys.auth };
    await this.db.pushSubscription.upsert({
      where: { endpoint },
      create: { endpoint, ...data },
      update: data,
    });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.db.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /** Sends to every device of the learner; returns how many took it. Gone devices are removed. */
  async sendToUser(userId: string, payload: PushPayload): Promise<number> {
    const subs = await this.db.pushSubscription.findMany({ where: { userId } });
    const json = JSON.stringify(payload);
    let sent = 0;
    for (const sub of subs) {
      try {
        await this.sender.send(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json,
        );
        sent++;
        await this.db.pushSubscription.update({
          where: { id: sub.id },
          data: { lastSentAt: new Date() },
        });
      } catch (e) {
        if (isGone(e)) {
          await this.db.pushSubscription.deleteMany({ where: { id: sub.id } });
        } else {
          this.logger.warn(
            `Push to ${new URL(sub.endpoint).host} failed: ${e instanceof Error ? e.message : e}`,
          );
        }
      }
    }
    return sent;
  }
}
