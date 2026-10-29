// AI routes with the language model replaced by a stub: checks our side (reading enrichment, path links,
// vocabulary checks and the rewrite loop, storage, quotas) without calling the API.

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { BadGatewayException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ExplainStreamEvent } from '@taiwan-mandarin/shared/api';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StructuredRequest } from '../src/ai/llm.service.js';

const calls: StructuredRequest<never>[] = [];
let replies: unknown[] = [];
const next = () => {
  const reply = replies.shift();
  if (reply instanceof Error) throw reply;
  return reply;
};
const stub = {
  available: true,
  structured: async (req: StructuredRequest<never>) => {
    calls.push(req);
    return next();
  },
  // Streams like the real thing: a partial answer (two words in), then the whole of it.
  stream: async function* (req: StructuredRequest<never>) {
    calls.push(req);
    const reply = next() as { translation?: string; tokens?: unknown[] };
    yield {
      type: 'partial',
      value: { translation: reply.translation, tokens: (reply.tokens ?? []).slice(0, 2) },
    };
    yield { type: 'done', value: reply };
  },
};

/** Reads an NDJSON response into its events. */
const ndjson = (res: IncomingMessage, done: (error: Error | null, body: unknown) => void) => {
  let text = '';
  res.setEncoding('utf8');
  res.on('data', (chunk: string) => (text += chunk));
  res.on('end', () =>
    done(
      null,
      text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ExplainStreamEvent),
    ),
  );
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

  it('explains in Vietnamese when asked, with Vietnamese glosses from the content', async () => {
    if (!(await hasContent())) return;
    calls.length = 0;
    replies = [
      {
        source: '垃圾不落地',
        translation: 'Không để rác rơi xuống đất',
        tokens: [{ text: '垃圾', pinyin: 'le4 se4', gloss: null, note: null }],
        grammar: [],
        notes: [],
      },
    ];
    const res = await request(http)
      .post('/v1/ai/explain')
      .set(auth())
      .send({ text: '垃圾不落地', lang: 'vi' });
    expect(res.status).toBe(200);
    expect(calls.at(-1)?.system).toContain('first language is Vietnamese');
    const [trash] = res.body.tokens;
    expect(trash.gloss).toBe('rác');
    // English stays the default.
    replies = [{ ...(replies[0] as object), translation: 'Keep trash off the ground' }];
    await request(http).post('/v1/ai/explain').set(auth()).send({ text: '垃圾不落地' });
    expect(calls.at(-1)?.system).toContain('first language is English');
  });

  it('explains in Russian when asked', async () => {
    if (!(await hasContent())) return;
    calls.length = 0;
    replies = [
      {
        source: '垃圾不落地',
        translation: 'Не бросай мусор на землю',
        tokens: [{ text: '垃圾', pinyin: 'le4 se4', gloss: null, note: null }],
        grammar: [],
        notes: [],
      },
    ];
    const res = await request(http)
      .post('/v1/ai/explain')
      .set(auth())
      .send({ text: '垃圾不落地', lang: 'ru' });
    expect(res.status).toBe(200);
    expect(calls.at(-1)?.system).toContain('first language is Russian');
    expect(res.body.tokens[0].gloss).toBeTruthy();
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

describe('explain, streamed', () => {
  const stream = (body: object) =>
    request(http)
      .post('/v1/ai/explain/stream')
      .set(auth())
      .send(body)
      .buffer(true)
      .parse(ndjson as never);

  it('sends the source, the translation, each word, then the whole result', async () => {
    if (!(await hasContent())) return;
    replies = [
      {
        translation: 'Keep trash off the ground',
        tokens: [
          { text: '垃圾', pinyin: 'la1 ji1', gloss: 'garbage', note: null },
          { text: '不', pinyin: 'bu4', gloss: 'not', note: null },
          { text: '落地', pinyin: 'luo4 di4', gloss: 'touch the ground', note: null },
        ],
        grammar: [],
        notes: [],
      },
    ];
    const res = await stream({ text: '垃圾不落地' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.headers['x-accel-buffering']).toBe('no');
    const events = res.body as ExplainStreamEvent[];
    expect(events.map((e) => e.type)).toEqual(['source', 'translation', 'token', 'done']);
    expect(events[2]).toMatchObject({
      type: 'token',
      index: 0,
      token: { text: '垃圾', pinyin: 'le4 se4', wordId: '垃圾' },
    });
    const done = events[3];
    if (done?.type !== 'done') throw new Error('expected the result last');
    expect(done.result.tokens.map((t) => t.text).join('')).toBe('垃圾不落地');
    expect(calls.at(-1)?.feature).toBe('explain');
  });

  it('ends with an error event when the answer fails midway', async () => {
    replies = [new BadGatewayException('The AI service failed. Try again.')];
    const res = await stream({ text: '請勿停車' });
    expect(res.status).toBe(200);
    expect((res.body as ExplainStreamEvent[]).at(-1)).toMatchObject({
      type: 'error',
      status: 502,
      message: 'The AI service failed. Try again.',
    });
  });

  it('rejects empty requests before streaming', async () => {
    const res = await request(http).post('/v1/ai/explain/stream').set(auth()).send({});
    expect(res.status).toBe(400);
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
    expect(calls[0]?.feature).toBe('talk');
    // The rewrite shows the model its first attempt, then what to change.
    expect(calls[1]?.messages.at(-2)?.role).toBe('assistant');
    const rewrite = calls[1]?.messages.at(-1);
    expect(rewrite?.role).toBe('developer');
    const [reply] = res.body.messages;
    expect(reply.content).toBe('你好！你要吃什麼？我們有雞排。');
    expect(reply.newWords.map((w: { text: string }) => w.text)).toContain('雞排');
    // Every character of the reply has its Taiwan reading, with word lengths to space it by word.
    expect(reply.reading.pinyin.split(' ')).toHaveLength(12);
    expect(reply.reading.wordLengths.reduce((a: number, b: number) => a + b, 0)).toBe(12);
    expect(reply.reading.pinyin).toMatch(/^ni3 hao3 /);

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
    expect(next.body.messages[0].correction.reading.pinyin.split(' ')).toHaveLength(6);
    const saved = await request(http).get(`/v1/ai/talk/${res.body.conversationId}`).set(auth());
    expect(saved.body.messages).toHaveLength(3);
    // Readings are worked out again for the saved history.
    expect(saved.body.messages[0].reading.pinyin).toBe(reply.reading.pinyin);
  });

  it('marks a word new only once, and never one the learner wrote', async () => {
    if (!(await hasContent())) return;
    calls.length = 0;
    // 要, 在 and 火車 are Novice 2: new to a Novice 1 learner, but no reason to rewrite.
    replies = [{ reply: '你好！你要去哪裡？', translation: '…', correction: null }];
    const opened = await request(http).post('/v1/ai/talk').set(auth()).send({ scenario: 'mrt' });
    const words = (m: { newWords?: { text: string }[] }) => m.newWords?.map((w) => w.text);
    expect(words(opened.body.messages[0])).toContain('要');

    replies = [{ reply: '花蓮很好！你要在台北坐火車。', translation: '…', correction: null }];
    const next = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ conversationId: opened.body.conversationId, message: '我想去花蓮' });
    expect(calls).toHaveLength(2);
    const fresh = words(next.body.messages[1]);
    expect(fresh).toEqual(expect.arrayContaining(['在', '火車']));
    expect(fresh).not.toContain('要');
    expect(fresh).not.toContain('花蓮');

    // A "correction" that only adds punctuation or changes 台 to 臺 is dropped.
    replies = [
      {
        reply: '好！',
        translation: 'OK!',
        correction: { corrected: '不是，我要去臺北。', explanation: 'Added a full stop.' },
      },
    ];
    const same = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ conversationId: opened.body.conversationId, message: '不是, 我要去台北' });
    expect(same.body.messages[0].correction).toBeNull();
  });

  it('accepts the everyday 台 but rewrites Mainland wording in corrections', async () => {
    if (!(await hasContent())) return;
    calls.length = 0;
    replies = [
      { reply: '你好！你在台北嗎？', translation: 'Hi! Are you in Taipei?', correction: null },
    ];
    await request(http).post('/v1/ai/talk').set(auth()).send({ scenario: 'mrt' });
    expect(calls).toHaveLength(1);

    calls.length = 0;
    replies = [
      {
        reply: '好啊！',
        translation: 'Sure!',
        correction: { corrected: '我想坐出租車。', explanation: 'Fine.' },
      },
      {
        reply: '好啊！',
        translation: 'Sure!',
        correction: { corrected: '我想坐計程車。', explanation: 'Taiwan says 計程車.' },
      },
    ];
    const res = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ scenario: 'mrt', message: '我想坐出租車' });
    expect(calls).toHaveLength(2);
    expect(res.body.messages[0].correction.corrected).toBe('我想坐計程車。');
  });

  it('ends a conversation with a goodbye and a summary, then takes no more messages', async () => {
    if (!(await hasContent())) return;
    replies = [
      { reply: '你好！你要喝什麼？', translation: 'Hi! What would you like?', correction: null },
    ];
    const opened = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ scenario: 'bubble-tea' });
    const id = opened.body.conversationId;
    replies = [
      {
        reply: '好，大杯珍珠奶茶。',
        translation: 'OK, a large bubble milk tea.',
        correction: { corrected: '我要一杯珍珠奶茶。', explanation: 'Add a measure word.' },
      },
    ];
    await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ conversationId: id, message: '我要珍珠奶茶' });

    calls.length = 0;
    replies = [{ reply: '謝謝，再見！', translation: 'Cảm ơn, tạm biệt!', correction: null }];
    const ended = await request(http).post(`/v1/ai/talk/${id}/end?lang=vi`).set(auth());
    expect(ended.status).toBe(200);
    // The goodbye comes from the partner, told the learner is leaving.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.messages.at(-1)?.role).toBe('developer');
    expect(calls[0]?.system).toContain('Their first language is Vietnamese.');
    expect(ended.body.message).toMatchObject({ role: 'assistant', content: '謝謝，再見！' });
    expect(ended.body.summary).toMatchObject({ sent: 1, corrected: 1 });
    expect(ended.body.endedAt).toEqual(expect.any(String));

    // Read-only from now on; the saved conversation carries its summary.
    const more = await request(http)
      .post('/v1/ai/talk')
      .set(auth())
      .send({ conversationId: id, message: '再見' });
    expect(more.status).toBe(409);
    const saved = await request(http).get(`/v1/ai/talk/${id}`).set(auth());
    expect(saved.body.endedAt).toBe(ended.body.endedAt);
    expect(saved.body.summary).toEqual(ended.body.summary);
    expect(saved.body.messages.at(-1).content).toBe('謝謝，再見！');
    const list = await request(http).get('/v1/ai/talk').set(auth());
    expect(list.body.find((c: { id: string }) => c.id === id).endedAt).toBe(ended.body.endedAt);

    // Ending again changes nothing and calls no model.
    calls.length = 0;
    const again = await request(http).post(`/v1/ai/talk/${id}/end`).set(auth());
    expect(again.body).toMatchObject({ message: null, endedAt: ended.body.endedAt });
    expect(calls).toHaveLength(0);
  });

  it('deletes conversations, only the owner’s', async () => {
    replies = [{ reply: '你好！', translation: 'Hi!', correction: null }];
    const opened = await request(http).post('/v1/ai/talk').set(auth()).send({ scenario: 'free' });
    const id = opened.body.conversationId;
    const other = await request(http)
      .post('/v1/auth/register')
      .send({ email: `ai${randomUUID()}@example.com`, password: 'correct horse battery' });
    const denied = await request(http)
      .delete(`/v1/ai/talk/${id}`)
      .set({ authorization: `Bearer ${other.body.accessToken}` });
    expect(denied.status).toBe(403);
    expect((await request(http).delete(`/v1/ai/talk/${id}`).set(auth())).status).toBe(204);
    expect((await request(http).get(`/v1/ai/talk/${id}`).set(auth())).status).toBe(404);
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

describe('quota', () => {
  const used = async () =>
    (await request(http).get('/v1/ai/status').set(auth())).body.used as number;

  it('counts answers, but not failed requests or a server without AI', async () => {
    const before = await used();
    replies = [new BadGatewayException('upstream down')];
    const failed = await request(http).post('/v1/ai/explain').set(auth()).send({ text: '你好' });
    expect(failed.status).toBe(502);
    expect(await used()).toBe(before);

    stub.available = false;
    try {
      const off = await request(http).post('/v1/ai/explain').set(auth()).send({ text: '你好' });
      expect(off.status).toBe(503);
    } finally {
      stub.available = true;
    }
    expect(await used()).toBe(before);

    replies = [{ reply: '你好！', translation: 'Hi!', correction: null }];
    await request(http).post('/v1/ai/talk').set(auth()).send({ scenario: 'mrt' }).expect(200);
    expect(await used()).toBe(before + 1);
  });
});
