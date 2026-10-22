import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { dayKeyIn } from '@taiwan-mandarin/shared';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type QuotaKind = 'ai' | 'speech';

/** Days start at midnight in Taiwan, wherever the server runs (a container's clock is UTC). */
const QUOTA_TIME_ZONE = 'Asia/Taipei';
const today = () => dayKeyIn(Date.now(), QUOTA_TIME_ZONE);

/** Per-user daily limits on paid API calls (AI_DAILY_LIMIT, SPEECH_DAILY_LIMIT). */
@Injectable()
export class QuotaService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  limit(kind: QuotaKind): number {
    return kind === 'ai' ? this.env.AI_DAILY_LIMIT : this.env.SPEECH_DAILY_LIMIT;
  }

  async used(userId: string, kind: QuotaKind): Promise<number> {
    const row = await this.db.aiUsage.findUnique({
      where: { userId_day_kind: { userId, day: today(), kind } },
    });
    return row?.count ?? 0;
  }

  /** Counts one use, or throws 429 when today's limit is reached. */
  async consume(userId: string, kind: QuotaKind): Promise<void> {
    const day = today();
    const row = await this.db.aiUsage.upsert({
      where: { userId_day_kind: { userId, day, kind } },
      create: { userId, day, kind, count: 1 },
      update: { count: { increment: 1 } },
    });
    if (row.count > this.limit(kind)) {
      throw new HttpException(
        `Daily limit reached (${this.limit(kind)}). It resets tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
