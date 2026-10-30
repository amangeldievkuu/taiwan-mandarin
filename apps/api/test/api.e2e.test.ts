import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sha256 } from '../src/auth/crypto.js';

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

const refreshCookie = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('tm_refresh='))
    ?.split(';')[0] ?? '';

/** A new session (refresh-token family) for an existing account; sign-ups are rate-limited. */
async function signIn(email: string) {
  const res = await request(http)
    .post('/v1/auth/login')
    .send({ email, password: 'correct horse battery' });
  expect(res.status).toBe(200);
  return { token: res.body.accessToken as string, cookie: refreshCookie(res) };
}

/** An account made by the first auth test, for tests that need another session. */
let account = '';

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

  it('rotates refresh tokens and revokes the chain when a used-up token is replayed', async () => {
    const { email, cookie } = await signUp();
    account = email;
    const refresh = (c: string) => request(http).post('/v1/auth/refresh').set('cookie', c);
    const first = await refresh(cookie);
    expect(first.status).toBe(200);
    const next = refreshCookie(first);
    // The client moved on (it rotated `next`), so the old token is a stolen copy.
    const second = await refresh(next);
    expect(second.status).toBe(200);
    expect((await refresh(cookie)).status).toBe(401);
    // The whole chain is gone, including the newest token.
    expect((await refresh(refreshCookie(second))).status).toBe(401);
  });

  it('keeps the session when the rotated cookie never reached the client', async () => {
    const { cookie } = await signIn(account);
    const refresh = (c: string) => request(http).post('/v1/auth/refresh').set('cookie', c);
    // The server rotated, the response was lost: the browser still sends the old cookie, later.
    const first = await refresh(cookie);
    expect(first.status).toBe(200);
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    await app.get(PrismaService).refreshToken.updateMany({
      where: { tokenHash: sha256(cookie.slice(cookie.indexOf('=') + 1)) },
      data: { revokedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const again = await refresh(cookie);
    expect(again.status).toBe(200);
    // The replacement that did arrive this time carries on as normal, and from then on the old
    // token is a stolen copy.
    const recovered = refreshCookie(again);
    expect((await refresh(recovered)).status).toBe(200);
    expect((await refresh(cookie)).status).toBe(401);
  });

  it('cuts off a token replayed over and over', async () => {
    const { cookie } = await signIn(account);
    const refresh = (c: string) => request(http).post('/v1/auth/refresh').set('cookie', c);
    expect((await refresh(cookie)).status).toBe(200);
    expect((await refresh(cookie)).status).toBe(200);
    const last = await refresh(cookie);
    expect(last.status).toBe(200);
    // The fourth use ends the whole chain, newest replacement included.
    expect((await refresh(cookie)).status).toBe(401);
    expect((await refresh(refreshCookie(last))).status).toBe(401);
  });

  it('keeps the cookie when refreshing fails for a reason other than the session', async () => {
    const { cookie } = await signIn(account);
    const { AuthService } = await import('../src/auth/auth.service.js');
    const auth = app.get(AuthService);
    const real = auth.refresh.bind(auth);
    auth.refresh = async () => {
      throw new Error('database away');
    };
    try {
      const res = await request(http).post('/v1/auth/refresh').set('cookie', cookie);
      expect(res.status).toBe(500);
      expect(([] as string[]).concat(res.headers['set-cookie'] ?? [])).toEqual([]);
    } finally {
      auth.refresh = real;
    }
    expect((await request(http).post('/v1/auth/refresh').set('cookie', cookie)).status).toBe(200);
  });

  it('explains what is wrong with a sign-up', async () => {
    const res = await request(http)
      .post('/v1/auth/register')
      .send({ email: 'someone@example.com', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Use at least 8 characters for the password');
    // With a code, so the app can say it in the learner's language.
    expect(res.body.code).toBe('passwordTooShort');
  });

  it('keeps the session when two tabs refresh with the same cookie at once', async () => {
    const { cookie } = await signIn(account);
    const both = await Promise.all(
      [1, 2].map(() => request(http).post('/v1/auth/refresh').set('cookie', cookie)),
    );
    expect(both.map((r) => r.status)).toEqual([200, 200]);
    for (const res of both)
      expect(
        (await request(http).post('/v1/auth/refresh').set('cookie', refreshCookie(res))).status,
      ).toBe(200);
  });

  it('does not bring a logged-out session back', async () => {
    const { cookie } = await signIn(account);
    const first = await request(http).post('/v1/auth/refresh').set('cookie', cookie);
    await request(http).post('/v1/auth/logout').set('cookie', refreshCookie(first)).expect(204);
    expect((await request(http).post('/v1/auth/refresh').set('cookie', cookie)).status).toBe(401);
  });

  it('changes the password, ending other sessions, and signs out everywhere', async () => {
    const { email, token, cookie } = await signUp();
    const other = await signIn(email); // another device
    const me = (t: string) => request(http).get('/v1/auth/me').set('authorization', `Bearer ${t}`);
    const refresh = (c: string) => request(http).post('/v1/auth/refresh').set('cookie', c);
    const change = (currentPassword: string, newPassword: string) =>
      request(http)
        .post('/v1/auth/password')
        .set('authorization', `Bearer ${token}`)
        .send({ currentPassword, newPassword });

    // A wrong current password is 403, so clients don't take it for an expired session.
    expect((await change('not my password', 'a new long password')).status).toBe(403);
    const changed = await change('correct horse battery', 'a new long password');
    expect(changed.status).toBe(200);
    const fresh = { token: changed.body.accessToken as string, cookie: refreshCookie(changed) };

    // Every earlier session ends at once, access tokens included; this device carries on.
    for (const res of [await me(token), await me(other.token), await refresh(other.cookie)])
      expect(res.status).toBe(401);
    expect((await me(fresh.token)).status).toBe(200);
    expect(
      (
        await request(http)
          .post('/v1/auth/login')
          .send({ email, password: 'correct horse battery' })
      ).status,
    ).toBe(401);

    // Signing out everywhere ends this device's session too.
    await request(http)
      .post('/v1/auth/logout-all')
      .set('authorization', `Bearer ${fresh.token}`)
      .expect(204);
    expect((await me(fresh.token)).status).toBe(401);
    expect((await refresh(fresh.cookie)).status).toBe(401);
    expect((await refresh(cookie)).status).toBe(401);
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

    // Nothing changed since the cursor (and its margin) → nothing returned.
    const { PrismaService } = await import('../src/prisma/prisma.service.js');
    const db = app.get(PrismaService);
    const me = await request(http).get('/v1/auth/me').set(auth);
    await db.card.updateMany({
      where: { userId: me.body.id },
      data: { serverUpdatedAt: new Date(Date.now() - 10 * 60_000) },
    });
    const third = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: second.body.cursor, cards: [], reviews: [] });
    expect(third.body.cards).toEqual([]);

    const stats = await request(http).get('/v1/me/stats').set(auth);
    expect(stats.body.reviews.total).toBe(1);
    expect(stats.body.cards.learned).toBe(1);

    // An older copy sent after that: the server's newer copy comes back to correct it.
    const stale = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({
        since: third.body.cursor,
        cards: [{ wordId: '你好', updatedAt: 1500, card: card('2026-10-25T00:00:00.000Z', 1) }],
        reviews: [],
      });
    expect(stale.body.cards).toHaveLength(1);
    expect(stale.body.cards[0].updatedAt).toBe(2000);

    // A clock far ahead is clamped to about server time, so it can't win every later merge.
    const ahead = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({
        since: 0,
        cards: [
          {
            wordId: '謝謝',
            updatedAt: Date.now() + 365 * 86_400_000,
            card: card('2026-11-01T00:00:00.000Z'),
          },
        ],
        reviews: [],
      });
    const saved = ahead.body.cards.find((c: { wordId: string }) => c.wordId === '謝謝');
    expect(saved.updatedAt).toBeLessThanOrEqual(Date.now() + 5 * 60_000);

    // Numbers the database can't store are a 400, not a 500.
    const huge = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: 0, cards: [], reviews: [{ ...review('你好'), durationMs: 2 ** 31 }] });
    expect(huge.status).toBe(400);
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

  it('syncs the language, and takes settings from apps that predate it', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    const value = {
      phonetics: 'zhuyin',
      glyphStyle: 'kai',
      theme: 'auto',
      newPerDay: 10,
      levels: ['N1'],
      retention: 0.9,
    };
    const sync = (settings: object) =>
      request(http).post('/v1/sync').set(auth).send({ since: 0, cards: [], reviews: [], settings });

    const vi = await sync({ value: { ...value, language: 'vi', hanViet: false }, updatedAt: 100 });
    expect(vi.body.settings.value).toMatchObject({ language: 'vi', hanViet: false });

    // An older app sends no language: stored as it is, not reset to English.
    const older = await sync({ value: { ...value, newPerDay: 12 }, updatedAt: 200 });
    expect(older.status).toBe(200);
    expect(older.body.settings.value.newPerDay).toBe(12);
    expect('language' in older.body.settings.value).toBe(false);

    const unknown = await sync({ value: { ...value, language: 'fr' }, updatedAt: 300 });
    expect(unknown.status).toBe(400);
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

  it('counts practice away from the cards, the same story once a day', async () => {
    const { token } = await signUp();
    const auth = { authorization: `Bearer ${token}` };
    const practice = (kind: string, ref: string, iso: string) => ({
      id: randomUUID(),
      kind,
      ref,
      at: Date.parse(iso),
    });
    const read = practice('read', 'mrt', '2026-10-21T02:00:00Z');
    const phone = await sync(auth, {
      reviews: [at('2026-10-21T01:00:00Z')],
      practice: [
        read,
        practice('read', 'mrt', '2026-10-21T03:00:00Z'),
        practice('talk', 'message-1', '2026-10-21T04:00:00Z'),
        practice('talk', 'message-2', '2026-10-21T04:01:00Z'),
        // Practice alone still makes a day.
        practice('write', '愛', '2026-10-22T04:00:00Z'),
      ],
      activity: { timeZone: 'Asia/Taipei', since: 0 },
    });
    expect(phone.status).toBe(200);
    expect(phone.body.acceptedPractice).toContain(read.id);
    expect(phone.body.activity.days).toEqual([
      expect.objectContaining({ date: '2026-10-21', reviews: 1, read: 1, talk: 2, write: 0 }),
      expect.objectContaining({ date: '2026-10-22', reviews: 0, read: 0, write: 1 }),
    ]);

    // Sent again, or the same story read on another device that day: still counted once.
    const laptop = await sync(auth, {
      since: phone.body.cursor,
      practice: [read, practice('read', 'mrt', '2026-10-21T09:00:00Z')],
      activity: { timeZone: 'Asia/Taipei', since: phone.body.cursor },
    });
    expect(laptop.body.activity.days).toContainEqual(
      expect.objectContaining({ date: '2026-10-21', read: 1 }),
    );

    const stats = await request(http).get('/v1/me/stats').query({ tz: 'Asia/Taipei' }).set(auth);
    expect(stats.body.xp.total).toBe(10 + 50 + 2 * 10 + 10);

    const bad = await sync(auth, { practice: [{ ...read, kind: 'sing' }] });
    expect(bad.status).toBe(400);
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

describe('reset progress', () => {
  it('deletes cards and reviews, and the next sync brings nothing back', async () => {
    const { token } = await signIn(account);
    const auth = { authorization: `Bearer ${token}` };
    const pushed = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({
        since: 0,
        cards: [{ wordId: 'w1', updatedAt: Date.now(), card: card(new Date().toISOString()) }],
        reviews: [review('w1')],
      });
    expect(pushed.status).toBe(200);
    await request(http).delete('/v1/me/progress').set(auth).expect(204);
    const after = await request(http)
      .post('/v1/sync')
      .set(auth)
      .send({ since: 0, cards: [], reviews: [] });
    expect(after.body.cards).toEqual([]);
    expect((await request(http).get('/v1/me/reviews').set(auth)).body).toEqual([]);
  });
});

describe('personal access tokens', () => {
  it('reads data but cannot manage tokens', async () => {
    const { token } = await signIn(account);
    const created = await request(http)
      .post('/v1/me/tokens')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'test' });
    expect(created.status).toBe(201);
    expect(created.body.token).toMatch(/^tm_/);
    const pat = { authorization: `Bearer ${created.body.token}` };
    expect((await request(http).get('/v1/me/stats').set(pat)).status).toBe(200);
    expect((await request(http).get('/v1/me/tokens').set(pat)).status).toBe(403);
    // Tokens only reach the read routes and adding to the deck.
    for (const res of [
      await request(http).post('/v1/sync').set(pat).send({ since: 0, cards: [], reviews: [] }),
      await request(http).post('/v1/ai/explain').set(pat).send({ text: '你好' }),
      await request(http).post('/v1/speech/check').set(pat).send({}),
      await request(http).post('/v1/me/fsrs/optimize').set(pat).send({}),
      await request(http).get('/v1/auth/me').set(pat),
      await request(http).delete('/v1/auth/me').set(pat),
    ])
      expect(res.status).toBe(403);
    expect((await request(http).get('/v1/me/cards').set(pat)).status).toBe(200);
    expect(
      (await request(http).get('/v1/auth/me').set('authorization', `Bearer ${token}`)).status,
    ).toBe(200);
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

  it('finds nothing for words that are Object.prototype members', async () => {
    for (const q of ['constructor', 'toString', '__proto__']) {
      const res = await request(http).get(`/v1/dict/${q}`);
      expect(res.status).toBe(200);
      expect(res.body.entries).toEqual([]);
    }
  });

  it('answers a malformed id with 400, not 500', async () => {
    const { token } = await signIn(account);
    const auth = { authorization: `Bearer ${token}` };
    expect((await request(http).get('/v1/ai/talk/not-a-uuid').set(auth)).status).toBe(400);
    expect((await request(http).delete('/v1/me/tokens/not-a-uuid').set(auth)).status).toBe(400);
  });

  it('segments text', async () => {
    const res = await request(http).post('/v1/segment').send({ text: '我想坐捷運' });
    expect(res.status).toBe(201);
    expect(res.body.tokens.map((t: { text: string }) => t.text).join('')).toBe('我想坐捷運');
  });
});
