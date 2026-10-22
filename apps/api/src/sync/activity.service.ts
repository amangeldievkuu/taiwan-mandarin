// Practice totals per calendar day in the learner's time zone, straight from the review log: the
// same numbers on every device (streak, XP, the 30-day chart, retention), without sending every
// review back down.

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DayActivity } from '@taiwan-mandarin/shared';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Re-sent margin before the cursor, for reviews another device stored as the cursor was taken. */
const OVERLAP_MS = 5 * 60_000;

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  /** Time zones Postgres knows (its tzdata can lag the browser's). */
  private readonly zones = new Map<string, boolean>();

  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  async knows(timeZone: string): Promise<boolean> {
    let known = this.zones.get(timeZone);
    if (known === undefined) {
      const rows = await this.db.$queryRaw<{ known: boolean }[]>`
        SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${timeZone}) AS known`;
      known = rows[0]?.known === true;
      this.zones.set(timeZone, known);
      if (!known) this.logger.warn(`Postgres doesn't know the time zone "${timeZone}"`);
    }
    return known;
  }

  /**
   * Totals for every day with a review (`since` 0), or only the days with reviews stored after
   * `since`, each counted in full. Undefined when Postgres doesn't know the time zone.
   */
  async days(userId: string, timeZone: string, since = 0): Promise<DayActivity[] | undefined> {
    if (!(await this.knows(timeZone))) return undefined;
    // Review times are stored as UTC wall-clock time; days are counted in the learner's zone.
    const changed = since
      ? Prisma.sql`AND r."createdAt" >= (to_timestamp(${(since - OVERLAP_MS) / 1000}::float8) AT TIME ZONE 'UTC')`
      : Prisma.empty;
    return this.db.$queryRaw<DayActivity[]>`
      WITH touched AS (
        SELECT DISTINCT ((r."reviewedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}::text)::date AS day
        FROM "ReviewLog" r
        WHERE r."userId" = ${userId}::uuid ${changed}
      ), bounds AS (
        SELECT day,
               (day::timestamp AT TIME ZONE ${timeZone}::text) AT TIME ZONE 'UTC' AS lo,
               ((day + 1)::timestamp AT TIME ZONE ${timeZone}::text) AT TIME ZONE 'UTC' AS hi
        FROM touched
      )
      SELECT to_char(b.day, 'YYYY-MM-DD') AS date,
             count(*)::int AS reviews,
             count(*) FILTER (WHERE r.rating = 1)::int AS again,
             count(*) FILTER (WHERE r.rating = 2)::int AS hard,
             count(*) FILTER (WHERE r.rating = 3)::int AS good,
             count(*) FILTER (WHERE r.rating = 4)::int AS easy,
             count(*) FILTER (WHERE r.state = 0)::int AS learned,
             count(*) FILTER (WHERE r.state = 2)::int AS graded,
             count(*) FILTER (WHERE r.state = 2 AND r.rating >= 2)::int AS kept,
             coalesce(sum(r."durationMs"), 0)::float8 AS ms
      FROM bounds b
      JOIN "ReviewLog" r
        ON r."userId" = ${userId}::uuid AND r."reviewedAt" >= b.lo AND r."reviewedAt" < b.hi
      GROUP BY b.day
      ORDER BY b.day`;
  }
}
