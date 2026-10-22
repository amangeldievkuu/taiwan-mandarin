// Personal FSRS parameters: fit the scheduler's weights to one learner's review history with the
// fsrs-rs optimizer (native, or the WASI build where the CPU can't run it: binding.ts). The web app
// picks the weights up on its next sync.

import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { utcOffsetMinutes } from '@taiwan-mandarin/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { fsrsBinding } from './binding.js';
import { trainingItems } from './items.js';

/** fsrs-rs needs a few hundred reviews before personal weights beat the defaults. */
export const MIN_REVIEWS = 400;
/** For learners who haven't synced a time zone yet; most learn in Taiwan. */
const DEFAULT_TIME_ZONE = 'Asia/Taipei';

@Injectable()
export class FsrsService {
  private readonly logger = new Logger(FsrsService.name);
  private running = new Set<string>();

  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  /** `timeoutMs` caps training; fsrs-rs returns the best weights found so far. */
  async optimize(
    userId: string,
    offsetMinutes = 480,
    timeoutMs = 30_000,
  ): Promise<{ w: number[]; reviewCount: number; trainedAt: string }> {
    if (this.running.has(userId)) throw new BadRequestException('Already optimizing');
    this.running.add(userId);
    try {
      const reviews = await this.db.reviewLog.findMany({
        where: { userId },
        select: { wordId: true, reviewedAt: true, rating: true },
        orderBy: { reviewedAt: 'asc' },
      });
      if (reviews.length < MIN_REVIEWS) {
        throw new BadRequestException(
          `Personal parameters need ${MIN_REVIEWS} reviews; you have ${reviews.length}.`,
        );
      }
      // Recorded first, so a fit that fails waits for more history instead of every night.
      await this.db.user.update({
        where: { id: userId },
        data: { fsrsAttemptedCount: reviews.length },
      });
      const { computeParameters, FSRSBindingItem, FSRSBindingReview } = await fsrsBinding();
      const items = trainingItems(reviews, offsetMinutes).map(
        (steps) => new FSRSBindingItem(steps.map((s) => new FSRSBindingReview(s.rating, s.deltaT))),
      );
      const w = await computeParameters(items, { enableShortTerm: true, timeout: timeoutMs });
      if (!w.every(Number.isFinite)) throw new Error('Optimizer returned invalid weights');
      const trainedAt = new Date();
      await this.db.user.update({
        where: { id: userId },
        data: { fsrsWeights: w, fsrsTrainedAt: trainedAt, fsrsReviewCount: reviews.length },
      });
      this.logger.log(`Optimized FSRS for ${userId} on ${reviews.length} reviews`);
      return { w, reviewCount: reviews.length, trainedAt: trainedAt.toISOString() };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.warn(
        `FSRS optimization failed for ${userId}: ${e instanceof Error ? e.message : e}`,
      );
      throw new BadRequestException(
        'Not enough varied review history to fit personal parameters yet',
      );
    } finally {
      this.running.delete(userId);
    }
  }

  /**
   * Nightly (at 04:00 in Taiwan): refit learners with at least MIN_REVIEWS new reviews since their
   * last attempt, counting days in each learner's own time zone.
   */
  @Cron('0 4 * * *', { timeZone: DEFAULT_TIME_ZONE })
  async nightly(): Promise<void> {
    const counts = await this.db.reviewLog.groupBy({ by: ['userId'], _count: { _all: true } });
    const users = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: counts.map((c) => c.userId) } },
          select: { id: true, fsrsReviewCount: true, fsrsAttemptedCount: true, timeZone: true },
        })
      ).map((u) => [u.id, u]),
    );
    for (const { userId, _count } of counts) {
      const user = users.get(userId);
      if (!user) continue;
      const last = Math.max(user.fsrsReviewCount, user.fsrsAttemptedCount);
      if (_count._all - last < MIN_REVIEWS) continue;
      const offset = utcOffsetMinutes(Date.now(), user.timeZone ?? DEFAULT_TIME_ZONE);
      await this.optimize(userId, offset, 300_000).catch(() => undefined);
    }
  }
}
