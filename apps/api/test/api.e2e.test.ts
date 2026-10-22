import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;

beforeAll(async () => {
  if (process.env['TEST_DATABASE_URL'] === undefined) process.loadEnvFile?.('.env');
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';
  const { AppModule } = await import('../src/app.module.js');
  app = await NestFactory.create(AppModule, { logger: false });
  app.use(cookieParser());
  await app.init();
  http = app.getHttpServer();
});

afterAll(async () => {
  await app?.close();
});

const card = (due: string, stability = 2) => ({
  due,
  stability,
  difficulty: 5,
  elapsed_days: 0,
  scheduled_days: 1,
  learning_steps: 0,
  reps: 1,
  lapses: 0,
  state: 2,
  last_review: null,
});

const review = (wordId: string) => ({
  id: randomUUID(),
  wordId,
  rating: 3,
  state: 0,
  review: Date.now(),
  due: Date.now(),
  stability: 0,
  difficulty: 0,
  elapsedDays: 0,
  scheduledDays: 0,
  durationMs: 2000,
});

async function signUp() {
  const email = `t${randomUUID()}@example.com`;
  const res = await request(http)
    .post('/v1/auth/register')
    .send({ email, password: 'correct horse battery' });
  expect(res.status).toBe(201);
  const cookie = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('tm_refresh='));
  return { email, token: res.body.accessToken as string, cookie: cookie?.split(';')[0] ?? '' };
}

describe('auth', () => {
  it('registers, rejects duplicates and wrong passwords', async () => {
    const { email, cookie } = await signUp();
    expect(cookie).toMatch(/^tm_refresh=/);
    expect(
      (await request(http).post('/v1/auth/register').send({ email, password: 'another password' }))
        .status,
    ).toBe(409);
    expect(
      (await request(http).post('/v1/auth/login').send({ email, password: 'wrong password' }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(http)
          .post('/v1/auth/login')
          .send({ email, password: 'correct horse battery' })
      ).status,
    ).toBe(200);
  });

  it('validates input', async () => {
    const res = await request(http)
      .post('/v1/auth/register')
      .send({ email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(['email', 'password']);
  });

  it('rotates refresh tokens and revokes the chain on reuse', async () => {
    const { cookie } = await signUp();
    const first = await request(http).post('/v1/auth/refresh').set('cookie', cookie);
    expect(first.status).toBe(200);
    const next = ([] as string[]).concat(first.headers['set-cookie'] ?? [])[0]?.split(';')[0] ?? '';
    // The old token again: reuse → the whole chain is revoked, including `next`.
    expect((await request(http).post('/v1/auth/refresh').set('cookie', cookie)).status).toBe(401);
    expect((await request(http).post('/v1/auth/refresh').set('cookie', next)).status).toBe(401);
  });

  it('protects personal routes', async () => {
    expect((await request(http).get('/v1/me/stats')).status).toBe(401);
    expect(
      (await request(http).get('/v1/me/stats').set('authorization', 'Bearer nonsense')).status,
    ).toBe(401);
  });
});

describe('sync', () => {
  it('merges cards last-write-wins and ignores duplicate reviews', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    const r = review('你好');

    const first = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({
        since: 0,
        cards: [{ wordId: '你好', updatedAt: 2000, card: card('2026-11-01T00:00:00.000Z', 5) }],
        reviews: [r],
      });
    expect(first.status).toBe(200);
    expect(first.body.cards).toHaveLength(1);

    // An older edit from another device loses; the same review again is ignored.
    const second = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({
        since: 0,
        cards: [{ wordId: '你好', updatedAt: 1000, card: card('2026-10-25T00:00:00.000Z', 1) }],
        reviews: [r],
      });
    expect(second.body.cards[0].card.stability).toBe(5);
    expect(second.body.cards[0].updatedAt).toBe(2000);

    // Nothing changed since the cursor → nothing returned.
    const third = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: second.body.cursor, cards: [], reviews: [] });
    expect(third.body.cards).toEqual([]);

    const stats = await request(http).get('/v1/me/stats').set(auth);
    expect(stats.body.reviews.total).toBe(1);
    expect(stats.body.cards.learned).toBe(1);
  });

  it('keeps the newer settings and deck', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    const settings = (newPerDay: number, updatedAt: number) => ({
      value: {
        phonetics: 'zhuyin',
        glyphStyle: 'kai',
        theme: 'auto',
        newPerDay,
        levels: ['N1'],
        retention: 0.9,
      },
      updatedAt,
    });
    await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: 0, cards: [], reviews: [], settings: settings(20, 500) });
    const res = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: 0, cards: [], reviews: [], settings: settings(5, 100) });
    expect(res.body.settings.value.newPerDay).toBe(20);
  });
});

describe('activity', () => {
  const at = (iso: string, rating = 3, state = 2) => ({
    ...review('你好'),
    rating,
    state,
    review: Date.parse(iso),
    durationMs: 1500,
  });
  const sync = (auth: object, body: object) =>
    request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: 0, cards: [], reviews: [], ...body });

  it('counts each day in the learner’s time zone, for every device', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    // 23:30 and 00:30 in Taipei: two days there, one in UTC.
    const phone = await sync(auth, {
      reviews: [at('2026-10-20T15:30:00Z', 1, 2), at('2026-10-20T16:30:00Z', 4, 0)],
      activity: { timeZone: 'Asia/Taipei', since: 0 },
    });
    expect(phone.status).toBe(200);
    expect(phone.body.activity).toMatchObject({ timeZone: 'Asia/Taipei', full: true });
    expect(phone.body.activity.days).toEqual([
      expect.objectContaining({ date: '2026-10-20', reviews: 1, again: 1, graded: 1, kept: 0 }),
      expect.objectContaining({ date: '2026-10-21', reviews: 1, easy: 1, learned: 1, ms: 1500 }),
    ]);
    const utc = await sync(auth, { activity: { timeZone: 'UTC', since: 0 } });
    expect(utc.body.activity.days).toEqual([
      expect.objectContaining({ date: '2026-10-20', reviews: 2 }),
    ]);

    // A second device, already in sync, gets the day it touched with both devices' totals
    // (and days stored minutes before its cursor again, which it simply replaces).
    const laptop = await sync(auth, {
      since: phone.body.cursor,
      reviews: [at('2026-10-21T02:00:00Z')],
      activity: { timeZone: 'Asia/Taipei', since: phone.body.cursor },
    });
    expect(laptop.body.activity.full).toBe(false);
    expect(laptop.body.activity.days).toContainEqual(
      expect.objectContaining({ date: '2026-10-21', reviews: 2 }),
    );

    const stats = await request(http).get('/v1/me/stats').query({ tz: 'Asia/Taipei' }).set(auth);
    expect(stats.status).toBe(200);
    expect(stats.body.reviews.total).toBe(3);
    expect(stats.body.xp.total).toBe(3 * 10 + 5);
  });

  it('follows daylight saving: the 25-hour day in New York', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    const res = await sync(auth, {
      reviews: [at('2026-11-01T04:30:00Z'), at('2026-11-02T04:30:00Z'), at('2026-11-02T05:30:00Z')],
      activity: { timeZone: 'America/New_York', since: 0 },
    });
    expect(
      res.body.activity.days.map((d: { date: string; reviews: number }) => [d.date, d.reviews]),
    ).toEqual([
      ['2026-11-01', 2],
      ['2026-11-02', 1],
    ]);
  });

  it('rejects unknown time zones and sends nothing unasked', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    const bad = await sync(auth, { activity: { timeZone: 'Mars/Base', since: 0 } });
    expect(bad.status).toBe(400);
    expect(bad.body.issues.map((i: { path: string }) => i.path)).toEqual(['activity.timeZone']);
    const plain = await sync(auth, {});
    expect(plain.body.activity).toBeUndefined();
  });
});

describe('personal access tokens', () => {
  it('reads data but cannot manage tokens', async () => {
    const { token } = await signUp();
    const created = await request(http)
      .post('/v1/me/tokens')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'test' });
    expect(created.status).toBe(201);
    expect(created.body.token).toMatch(/^tm_/);
    const pat = { authorization: `Bearer ${created.body.token}` };
    expect((await request(http).get('/v1/me/stats').set(pat)).status).toBe(200);
    expect((await request(http).get('/v1/me/tokens').set(pat)).status).toBe(403);
    await request(http)
      .delete(`/v1/me/tokens/${created.body.id}`)
      .set('authorization', `Bearer ${token}`)
      .expect(204);
    expect((await request(http).get('/v1/me/stats').set(pat)).status).toBe(401);
  });
});

describe('public content API', () => {
  it('serves levels and searches words', async () => {
    const levels = await request(http).get('/v1/levels');
    expect(levels.body.map((l: { id: string }) => l.id)).toEqual([
      'N1',
      'N2',
      'L1',
      'L2',
      'L3',
      'L4',
      'L5',
      'L6',
    ]);
    const words = await request(http).get('/v1/words').query({ q: 'jieyun' });
    if (words.body.total === 0) return; // content not built in this checkout
    expect(words.body.items[0].hanzi).toBe('捷運');
  });

  it('segments text', async () => {
    const res = await request(http).post('/v1/segment').send({ text: '我想坐捷運' });
    expect(res.status).toBe(201);
    expect(res.body.tokens.map((t: { text: string }) => t.text).join('')).toBe('我想坐捷運');
  });
});
