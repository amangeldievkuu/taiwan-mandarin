// Body size limits as main.ts sets them: small by default, large where a route needs it.

import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyBodyLimits } from '../src/common/body-limits.js';

let app: NestExpressApplication;
let http: ReturnType<NestExpressApplication['getHttpServer']>;
let auth: { authorization: string };

const KB = 1024;
const padded = (bytes: number) => 'x'.repeat(bytes);

beforeAll(async () => {
  if (process.env['TEST_DATABASE_URL'] === undefined) process.loadEnvFile?.('.env');
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';
  const { AppModule } = await import('../src/app.module.js');
  app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    bodyParser: false,
  });
  applyBodyLimits(app);
  await app.init();
  http = app.getHttpServer();
  const res = await request(http)
    .post('/v1/auth/register')
    .send({ email: `b${randomUUID()}@example.com`, password: 'correct horse battery' });
  auth = { authorization: `Bearer ${res.body.accessToken as string}` };
});

afterAll(async () => {
  await app?.close();
});

describe('body limits', () => {
  it('refuses a large body on an ordinary route', async () => {
    const res = await request(http)
      .post('/v1/auth/login')
      .send({ email: 'a@example.com', password: padded(200 * KB) });
    expect(res.status).toBe(413);
  });

  it('still reads a small body on an ordinary route', async () => {
    const res = await request(http)
      .post('/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong password' });
    expect(res.status).toBe(401);
  });

  it('accepts a first sync far over the small limit', async () => {
    const cards = Array.from({ length: 5000 }, (_, i) => ({
      wordId: `w${i}`,
      card: {
        due: new Date().toISOString(),
        stability: 2,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 1,
        learning_steps: 0,
        reps: 1,
        lapses: 0,
        state: 2,
        last_review: null,
      },
      updatedAt: Date.now(),
    }));
    const body = { since: 0, cards, reviews: [] };
    expect(JSON.stringify(body).length).toBeGreaterThan(200 * KB);
    const res = await request(http).post('/v1/sync').set(auth).send(body);
    expect(res.status).toBe(200);
  });

  it('lets a photo reach the explain routes', async () => {
    const image = { mediaType: 'image/png', data: padded(200 * KB) };
    for (const path of ['/v1/ai/explain', '/v1/ai/explain/stream']) {
      const res = await request(http).post(path).set(auth).send({ image });
      // Past the body parser: without an OpenAI key it stops later, not with 413.
      expect(res.status).not.toBe(413);
    }
  });

  it('refuses a body over the large limit, even on a large route', async () => {
    const res = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ padding: padded(11 * KB * KB) });
    expect(res.status).toBe(413);
  });
});
