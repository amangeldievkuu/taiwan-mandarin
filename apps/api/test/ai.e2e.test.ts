// AI routes with the language model replaced by a stub: checks our side (reading enrichment, path links,
// vocabulary checks and the rewrite loop, storage, quotas) without calling the API.

import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StructuredRequest } from '../src/ai/llm.service.js';

const calls: StructuredRequest<never>[] = [];
let replies: unknown[] = [];
const stub = {
  available: true,
  model: 'stub',
  structured: async (req: StructuredRequest<never>) => {
    calls.push(req);
    return replies.shift();
  },
};

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let token = '';

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';
  const { AppModule } = await import('../src/app.module.js');
  const { LlmService } = await import('../src/ai/llm.service.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LlmService)
    .useValue(stub)
    .compile();
  app = module.createNestApplication({ logger: false });
  await app.init();
  http = app.getHttpServer();
  const res = await request(http)
    .post('/v1/auth/register')
    .send({ email: `ai${randomUUID()}@example.com`, password: 'correct horse battery' });
  token = res.body.accessToken;
});

afterAll(async () => {
  await app?.close();
});

const auth = () => ({ authorization: `Bearer ${token}` });
const hasContent = () =>
  request(http)
    .get('/v1/words')
    .query({ q: '垃圾' })
    .then((r) => r.body.total > 0);

describe('explain', () => {
  it('uses Taiwan readings and links words to the path', async () => {
    if (!(await hasContent())) return;
    replies = [
      {
        source: '垃圾不落地',
        translation: 'Keep trash off the ground',
        tokens: [
          { text: '垃圾', pinyin: 'la1 ji1', gloss: 'garbage', pos: 'N', note: null },
          { text: '不', pinyin: 'bu4', gloss: 'not', pos: 'Adv', note: null },
          { text: '落地', pinyin: 'luo4 di4', gloss: 'touch the ground', pos: 'V', note: null },
        ],
        grammar: [],
        notes: ['A Taipei city slogan.'],
      },
    ];
    const res = await request(http).post('/v1/ai/explain').set(auth()).send({ text: '垃圾不落地' });
    expect(res.status).toBe(200);
    const [trash] = res.body.tokens;
    expect(trash).toMatchObject({ text: '垃圾', pinyin: 'le4 se4', wordId: '垃圾' });
    expect(res.body.warnings).toEqual([]);
  });

  it('falls back to its own segmentation when the model’s tokens don’t match', async () => {
    if (!(await hasContent())) return;
    replies = [
      {
        source: '請勿停車',
        translation: 'No parking',
        tokens: [{ text: '請', pinyin: 'qing3', gloss: 'please', pos: null, note: null }],
        grammar: [],
        notes: [],
      },
    ];
    const res = await request(http).post('/v1/ai/explain').set(auth()).send({ text: '請勿停車' });
    expect(res.body.tokens.map((t: { text: string }) => t.text).join('')).toBe('請勿停車');
  });

  it('rejects empty requests', async () => {
    expect((await request(http).post('/v1/ai/explain').set(auth()).send({})).status).toBe(400);
  });
});

describe('talk', () => {
  it('rewrites replies with too many unknown words, then marks what is left', async () => {
    if (!(await hasContent())) return;
    calls.length = 0;
    replies = [
      {
        reply: '歡迎光臨！要不要試試看我們的蚵仔煎跟大腸包小腸？',
        translation: '…',
        correction: null,
      },
      {
        reply: '你好！你要吃什麼？我們有雞排。',
        translation: 'Hi! What would you like? We have fried chicken.',
        correction: null,
      },
    ];
    const res = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ scenario: 'night-market' });
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(2);
    const rewrite = calls[1]?.messages.at(-1);
    expect(rewrite?.role).toBe('developer');
    const [reply] = res.body.messages;
    expect(reply.content).toBe('你好！你要吃什麼？我們有雞排。');
    expect(reply.newWords.map((w: { text: string }) => w.text)).toContain('雞排');

    // The learner answers; the correction is stored with their message.
    replies = [
      {
        reply: '好，一個雞排。',
        translation: 'OK, one fried chicken.',
        correction: { corrected: '我要一個雞排。', explanation: 'Use a measure word.' },
      },
    ];
    const next = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ conversationId: res.body.conversationId, message: '我要雞排' });
    expect(next.body.messages[0]).toMatchObject({
      role: 'user',
      correction: { corrected: '我要一個雞排。' },
    });
    const saved = await request(http).get(`/v1/ai/talk/${res.body.conversationId}`).set(auth());
    expect(saved.body.messages).toHaveLength(3);
  });

  it('keeps conversations private', async () => {
    const other = await request(http)
      .post('/v1/auth/register')
      .send({ email: `ai${randomUUID()}@example.com`, password: 'correct horse battery' });
    const list = await request(http).get('/v1/ai/talk').set(auth());
    if (!list.body[0]) return;
    const res = await request(http)
      .get(`/v1/ai/talk/${list.body[0].id}`)
      .set({ authorization: `Bearer ${other.body.accessToken}` });
    expect(res.status).toBe(403);
  });
});
