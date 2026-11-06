import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { dayKeyIn } from '@taiwan-mandarin/shared';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiError } from '@taiwan-mandarin/shared/api';

export type QuotaKind = 'ai' | 'speech';

/** Days start at midnight in Taiwan, wherever the server runs (a container's clock is UTC). */
const QUOTA_TIME_ZONE = 'Asia/Taipei';
const today = () => dayKeyIn(Date.now(), QUOTA_TIME_ZONE);

/**
 * Daily limits on paid API calls: per user (AI_DAILY_LIMIT, SPEECH_DAILY_LIMIT) and for the whole
 * server (AI_GLOBAL_DAILY_LIMIT, SPEECH_GLOBAL_DAILY_LIMIT), because signing up is free and needs
 * no email check, so per-user limits alone don't bound the bill.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger('Quota');
  /** The day each kind last hit the server's limit, so the log says it once a day. */
  private readonly warned = new Map<QuotaKind, string>();

  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  limit(kind: QuotaKind): number {
    return kind === 'ai' ? this.env.AI_DAILY_LIMIT : this.env.SPEECH_DAILY_LIMIT;
  }

  private globalLimit(kind: QuotaKind): number {
    return kind === 'ai' ? this.env.AI_GLOBAL_DAILY_LIMIT : this.env.SPEECH_GLOBAL_DAILY_LIMIT;
  }

  async used(userId: string, kind: QuotaKind): Promise<number> {
    const row = await this.db.aiUsage.findUnique({
      where: { userId_day_kind: { userId, day: today(), kind } },
    });
    return row?.count ?? 0;
  }

  /**
   * Counts one use, or throws 429 when today's limit is reached, the learner's own or the server's.
   * A refused use is given back: it cost nothing, and retrying must not use up the server's limit.
   */
  async consume(userId: string, kind: QuotaKind): Promise<void> {
    const day = today();
    const row = await this.db.aiUsage.upsert({
      where: { userId_day_kind: { userId, day, kind } },
      create: { userId, day, kind, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (row.count > this.limit(kind)) {
      await this.refund(userId, kind).catch(() => undefined);
      throw new HttpException(
        apiError('dailyLimit', { limit: this.limit(kind) }),
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const { _sum } = await this.db.aiUsage.aggregate({
      where: { day, kind },
      _sum: { count: true },
    });
    if ((_sum.count ?? 0) > this.globalLimit(kind)) {
      await this.refund(userId, kind).catch(() => undefined);
      if (this.warned.get(kind) !== day) {
        this.warned.set(kind, day);
        this.logger.warn(`The server's daily ${kind} limit (${this.globalLimit(kind)}) is reached`);
      }
      throw new HttpException(apiError('serverDailyLimit'), HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /** Gives back a use that produced nothing (the request failed). */
  async refund(userId: string, kind: QuotaKind): Promise<void> {
    await this.db.aiUsage.updateMany({
      where: { userId, day: today(), kind, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }

  /** Runs `work` on one use of today's quota, given back if it fails. */
  async spend<T>(userId: string, kind: QuotaKind, work: () => Promise<T>): Promise<T> {
    await this.consume(userId, kind);
    try {
      return await work();
    } catch (error) {
      await this.refund(userId, kind).catch(() => undefined);
      throw error;
    }
  }
}
