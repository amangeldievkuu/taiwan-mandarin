import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { dayKey } from '@taiwan-mandarin/shared';
import { ENV, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type QuotaKind = 'ai' | 'speech';

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
      where: { userId_day_kind: { userId, day: dayKey(new Date()), kind } },
    });
    return row?.count ?? 0;
  }

  /** Counts one use, or throws 429 when today's limit is reached. */
  async consume(userId: string, kind: QuotaKind): Promise<void> {
    const day = dayKey(new Date());
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
}
