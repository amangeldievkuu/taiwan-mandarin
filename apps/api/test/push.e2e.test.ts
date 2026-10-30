// Daily reminders with the push services replaced by a stub: subscribing, the test push, gone
// devices, and the 15-minute job (the reminder time, once a day, not after practice).

import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PushPayload } from '@taiwan-mandarin/shared/api';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import type { ReminderService } from '../src/push/reminder.service.js';
import type { PushTarget } from '../src/push/web-push.sender.js';

const sent: { endpoint: string; payload: PushPayload }[] = [];
/** Endpoints the stub answers 410 Gone for. */
const gone = new Set<string>();
const stub = {
  publicKey: 'BTestPublicKey',
  send: async (target: PushTarget, payload: string) => {
    if (gone.has(target.endpoint)) throw Object.assign(new Error('Gone'), { statusCode: 410 });
    sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload) as PushPayload });
  },
};

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let db: PrismaService;
let reminders: ReminderService;
let token = '';
let userId = '';
const endpoint = `https://push.example.com/${randomUUID()}`;
const subscription = { endpoint, keys: { p256dh: 'BKey', auth: 'secret' } };

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';
  const { AppModule } = await import('../src/app.module.js');
  const { WebPushSender } = await import('../src/push/web-push.sender.js');
  const { PrismaService } = await import('../src/prisma/prisma.service.js');
  const { ReminderService } = await import('../src/push/reminder.service.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WebPushSender)
    .useValue(stub)
    .compile();
  app = module.createNestApplication({ logger: false });
  await app.init();
  http = app.getHttpServer();
  db = app.get(PrismaService);
  reminders = app.get(ReminderService);
  const res = await request(http)
    .post('/v1/auth/register')
    .send({ email: `push${randomUUID()}@example.com`, password: 'correct horse battery' });
  token = res.body.accessToken;
  userId = res.body.user.id;
});

afterAll(async () => {
  await db?.pushSubscription.deleteMany({ where: { userId } });
  await app?.close();
});

beforeEach(() => {
  sent.length = 0;
  gone.clear();
});

const auth = () => ({ authorization: `Bearer ${token}` });
const mine = () => sent.filter((s) => s.endpoint === endpoint);

describe('push subscriptions', () => {
  it('gives the VAPID key', async () => {
    const res = await request(http).get('/v1/push/config').set(auth()).expect(200);
    expect(res.body).toEqual({ publicKey: 'BTestPublicKey' });
  });

  it('needs a signed-in learner and a real subscription', async () => {
    await request(http).post('/v1/push/subscribe').send(subscription).expect(401);
    await request(http)
      .post('/v1/push/subscribe')
      .set(auth())
      .send({ ...subscription, endpoint: 'http://insecure.example.com/x' })
      .expect(400);
  });

  it('subscribes, sends a test, and unsubscribes', async () => {
    await request(http).post('/v1/push/subscribe').set(auth()).send(subscription).expect(204);
    // The same device again: still one.
    await request(http).post('/v1/push/subscribe').set(auth()).send(subscription).expect(204);
    expect(await db.pushSubscription.count({ where: { userId } })).toBe(1);

    const res = await request(http).post('/v1/push/test').set(auth()).expect(200);
    expect(res.body).toEqual({ sent: 1 });
    expect(mine()).toHaveLength(1);
    expect(mine()[0]?.payload).toMatchObject({
      title: expect.stringContaining('墨'),
      due: 0,
      url: '/',
    });

    await request(http).post('/v1/push/unsubscribe').set(auth()).send({ endpoint }).expect(204);
    expect(await db.pushSubscription.count({ where: { userId } })).toBe(0);
  });

  it('forgets a device its push service says is gone', async () => {
    await request(http).post('/v1/push/subscribe').set(auth()).send(subscription).expect(204);
    gone.add(endpoint);
    const res = await request(http).post('/v1/push/test').set(auth()).expect(200);
    expect(res.body).toEqual({ sent: 0 });
    expect(await db.pushSubscription.count({ where: { userId } })).toBe(0);
  });
});

describe('the daily reminder', () => {
  // 20:00 in Taipei on 2030-03-04 is 12:00 UTC.
  const at = (day: number, h: number, m: number) => Date.UTC(2030, 2, day, h, m);

  beforeAll(async () => {
    await request(http).post('/v1/push/subscribe').set(auth()).send(subscription).expect(204);
    await db.user.update({
      where: { id: userId },
      data: {
        timeZone: 'Asia/Taipei',
        settings: { reminderTime: '20:00', language: 'ru' },
        reminderDay: null,
      },
    });
  });

  it('comes at the learner’s time, once a day', async () => {
    await reminders.tick(at(4, 11, 45));
    expect(mine()).toHaveLength(0);
    await reminders.tick(at(4, 12, 0));
    expect(mine()).toHaveLength(1);
    expect(mine()[0]?.payload.body).toMatch(/墨/);
    await reminders.tick(at(4, 12, 0));
    expect(mine()).toHaveLength(1);
  });

  it('counts the cards due', async () => {
    await db.card.create({
      data: {
        userId,
        wordId: 'w-push',
        due: new Date(at(5, 0, 0)),
        stability: 1,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 1,
        reps: 1,
        lapses: 0,
        state: 2,
        updatedAt: BigInt(at(4, 0, 0)),
      },
    });
    await reminders.tick(at(5, 12, 0));
    expect(mine()[0]?.payload).toMatchObject({ due: 1, body: expect.stringContaining('1 слово') });
  });

  it('stays quiet after practice that day', async () => {
    await db.practiceLog.create({
      data: { id: randomUUID(), userId, kind: 'read', ref: 'story', at: new Date(at(6, 1, 0)) },
    });
    await reminders.tick(at(6, 12, 0));
    expect(mine()).toHaveLength(0);
  });
});
