// The daily limits, per learner and for the whole server, against the real database.

import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { dayKeyIn } from '@taiwan-mandarin/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QuotaService } from '../src/ai/quota.service.js';
import { loadEnv, type Env } from '../src/config/env.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

let db: PrismaService;
let env: Env;

beforeAll(async () => {
  if (process.env['TEST_DATABASE_URL'] === undefined) process.loadEnvFile?.('.env');
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  env = loadEnv();
  db = new PrismaService(env);
  await db.$connect();
});

afterAll(async () => {
  await db?.$disconnect();
});

async function learner(): Promise<string> {
  const user = await db.user.create({
    data: { email: `q${randomUUID()}@example.com`, passwordHash: 'x' },
  });
  return user.id;
}

async function refusal(work: Promise<unknown>): Promise<{ status: number; code?: string }> {
  const error = await work.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(error instanceof HttpException))
    throw new Error(`Expected a refusal, got ${String(error)}`);
  return { status: error.getStatus(), code: (error.getResponse() as { code?: string }).code };
}

/** A service with room for `room` more uses today (the test database is shared by every run). */
async function withRoom(room: number, limits: Partial<Env> = {}): Promise<QuotaService> {
  const { _sum } = await db.aiUsage.aggregate({
    where: { kind: 'ai', day: dayKeyIn(Date.now(), 'Asia/Taipei') },
    _sum: { count: true },
  });
  return new QuotaService(db, {
    ...env,
    ...limits,
    AI_GLOBAL_DAILY_LIMIT: (_sum.count ?? 0) + room,
  });
}

describe('daily limits', () => {
  it('stops everyone at the server limit and gives the refused use back', async () => {
    const [first, second] = [await learner(), await learner()];
    const service = await withRoom(1);

    await service.consume(first, 'ai');
    expect(await refusal(service.consume(second, 'ai'))).toEqual({
      status: 429,
      code: 'serverDailyLimit',
    });
    expect(await service.used(first, 'ai')).toBe(1);
    expect(await service.used(second, 'ai')).toBe(0);
  });

  it("doesn't let retries past a learner's own limit use up the server limit", async () => {
    const [spammer, other] = [await learner(), await learner()];
    // Room for the spammer's one allowed use and the other learner's one.
    const service = await withRoom(2, { AI_DAILY_LIMIT: 1 });

    await service.consume(spammer, 'ai');
    for (let i = 0; i < 3; i++) {
      expect(await refusal(service.consume(spammer, 'ai'))).toEqual({
        status: 429,
        code: 'dailyLimit',
      });
    }
    expect(await service.used(spammer, 'ai')).toBe(1);

    await expect(service.consume(other, 'ai')).resolves.toBeUndefined();
    expect(await service.used(other, 'ai')).toBe(1);
  });

  it('counts each kind separately', async () => {
    const id = await learner();
    const service = await withRoom(0);

    expect((await refusal(service.consume(id, 'ai'))).code).toBe('serverDailyLimit');
    await expect(service.consume(id, 'speech')).resolves.toBeUndefined();
  });
});
