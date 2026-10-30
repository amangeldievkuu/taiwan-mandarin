// The daily reminder: every 15 minutes, learners whose reminder time has come and who haven't
// practised yet today (in their own time zone) get one push on each device that turned it on.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  DEFAULT_SETTINGS,
  LANG_IDS,
  dayKeyIn,
  dayNumber,
  reminderDue,
  utcOffsetMinutes,
  type Lang,
} from '@taiwan-mandarin/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { reminderText } from './messages.js';
import { PushService } from './push.service.js';

/** For learners who haven't synced a time zone yet (as the nightly FSRS job). */
const DEFAULT_TIME_ZONE = 'Asia/Taipei';
const DAY_MS = 86_400_000;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);
  private running = false;

  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(PushService) private readonly push: PushService,
  ) {}

  /** Every REMINDER_WINDOW_MINUTES (15), on the quarter hour. */
  @Cron('0 */15 * * * *')
  async tick(now = Date.now()): Promise<number> {
    if (!this.push.publicKey || this.running) return 0;
    this.running = true;
    try {
      const users = await this.db.user.findMany({
        where: { pushSubs: { some: {} } },
        select: { id: true, timeZone: true, settings: true, reminderDay: true },
      });
      let sent = 0;
      for (const user of users) {
        try {
          if (await this.remind(user, now)) sent++;
        } catch (e) {
          this.logger.warn(`Reminder for ${user.id} failed: ${e instanceof Error ? e.message : e}`);
        }
      }
      return sent;
    } finally {
      this.running = false;
    }
  }

  private async remind(
    user: { id: string; timeZone: string | null; settings: unknown; reminderDay: string | null },
    now: number,
  ): Promise<boolean> {
    const settings = (user.settings ?? {}) as { reminderTime?: string; language?: string };
    const timeZone = user.timeZone ?? DEFAULT_TIME_ZONE;
    const day = reminderDue(
      now,
      timeZone,
      settings.reminderTime ?? DEFAULT_SETTINGS.reminderTime,
      user.reminderDay,
    );
    if (!day) return false;
    // Claim the day before sending, so a second instance or a retry never sends it twice.
    const claimed = await this.db.user.updateMany({
      where: { id: user.id, OR: [{ reminderDay: null }, { reminderDay: { not: day } }] },
      data: { reminderDay: day },
    });
    if (!claimed.count || (await this.practised(user.id, day, timeZone, now))) return false;
    return (await this.send(user.id, settings.language, day, now)).sent > 0;
  }

  /** Sends today's reminder now, whatever the time (the "Send a test" button). */
  async sendNow(userId: string, now = Date.now()): Promise<{ sent: number; errors: string[] }> {
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { settings: true, timeZone: true },
    });
    const language = (user.settings as { language?: string } | null)?.language;
    return this.send(userId, language, dayKeyIn(now, user.timeZone ?? DEFAULT_TIME_ZONE), now);
  }

  /** The reminder, with the cards due now (for the icon badge), to each of the learner's devices. */
  private async send(userId: string, language: string | undefined, day: string, now: number) {
    const due = await this.db.card.count({
      where: { userId, suspended: false, due: { lte: new Date(now) } },
    });
    const lang = (LANG_IDS as string[]).includes(language ?? '')
      ? (language as Lang)
      : DEFAULT_SETTINGS.language;
    return this.push.sendToUser(userId, { ...reminderText(lang, due, day), due, url: '/' });
  }

  /** Whether the learner reviewed or practised on `day`, as synced so far. */
  private async practised(userId: string, day: string, timeZone: string, now: number) {
    const start = dayNumber(day) * DAY_MS - utcOffsetMinutes(now, timeZone) * 60_000;
    const during = { gte: new Date(start), lt: new Date(start + DAY_MS) };
    const [review, practice] = await Promise.all([
      this.db.reviewLog.findFirst({ where: { userId, reviewedAt: during }, select: { id: true } }),
      this.db.practiceLog.findFirst({ where: { userId, at: during }, select: { id: true } }),
    ]);
    return review !== null || practice !== null;
  }
}
