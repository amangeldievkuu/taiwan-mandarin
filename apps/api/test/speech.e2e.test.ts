// Pronunciation checks with Whisper replaced by a stub and synthetic recordings with known pitch.

import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { align } from '../src/speech/speech.service.js';
import type { Transcript } from '../src/speech/whisper.service.js';

const RATE = 16000;
let transcript: Transcript = { text: '', words: [] };
let transcribed = 0;
const stub = {
  available: true,
  transcribe: async () => {
    transcribed++;
    return transcript;
  },
};

/** 16-bit mono WAV of voiced syllables with the given pitch contours, 0.3 s each + 0.08 s gaps. */
function wav(contours: ((t: number) => number)[]): string {
  const syllable = Math.round(0.3 * RATE);
  const gap = Math.round(0.08 * RATE);
  const samples = new Int16Array(contours.length * (syllable + gap) + gap);
  let at = gap;
  for (const hz of contours) {
    let phase = 0;
    for (let i = 0; i < syllable; i++) {
      phase += (2 * Math.PI * hz(i / syllable)) / RATE;
      const v = 0.5 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase);
      samples[at + i] = Math.round(v * 0.8 * 32767);
    }
    at += syllable + gap;
  }
  const data = Buffer.from(samples.buffer);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]).toString('base64');
}

const rising = (t: number) => 170 + 90 * t;
const low = (t: number) => 160 - 20 * Math.sin(Math.PI * Math.min(t, 0.8));
const falling = (t: number) => 270 - 120 * t;
const high = () => 255;

let app: INestApplication;
let http: ReturnType<INestApplication['getHttpServer']>;
let auth = {};

beforeAll(async () => {
  process.env['DATABASE_URL'] = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  process.env['NODE_ENV'] = 'test';
  const { AppModule } = await import('../src/app.module.js');
  const { WhisperService } = await import('../src/speech/whisper.service.js');
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(WhisperService)
    .useValue(stub)
    .compile();
  app = module.createNestApplication({ logger: false });
  await app.init();
  http = app.getHttpServer();
  const res = await request(http)
    .post('/v1/auth/register')
    .send({ email: `sp${randomUUID()}@example.com`, password: 'correct horse battery' });
  auth = { authorization: `Bearer ${res.body.accessToken}` };
});

afterAll(async () => {
  await app?.close();
});

const check = (audio: string, target: string, pinyin?: string) =>
  request(http)
    .post('/v1/speech/check')
    .set(auth)
    .send({ audio, target, ...(pinyin ? { pinyin } : {}) });

describe('align', () => {
  it('lines up substitutions and gaps', () => {
    expect(align([...'你好嗎'], [...'你好嗎'])).toEqual([0, 1, 2]);
    expect(align([...'你好嗎'], [...'你嗎'])).toEqual([0, null, 1]);
    expect(align([...'謝謝'], [...'姐姐'])).toEqual([0, 1]);
  });
});

describe('POST /v1/speech/check', () => {
  it('accepts 你好 said with third-tone sandhi (ní hǎo)', async () => {
    transcript = { text: '你好', words: [{ word: '你好', start: 0.08, end: 0.76 }] };
    const res = await check(wav([rising, low]), '你好', 'ni3 hao3');
    expect(res.status).toBe(200);
    expect(res.body.syllables.map((s: { expectedTone: number }) => s.expectedTone)).toEqual([2, 3]);
    expect(res.body.syllables.map((s: { tone: string }) => s.tone)).toEqual(['ok', 'ok']);
    expect(res.body.score).toBe(100);
  });

  it('flags a wrong tone', async () => {
    transcript = { text: '謝謝', words: [{ word: '謝謝', start: 0.08, end: 0.76 }] };
    // 謝謝 is xiè xie: falling then neutral. Said rising instead.
    const res = await check(wav([rising, high]), '謝謝', 'xie4 xie5');
    expect(res.body.syllables[0]).toMatchObject({ sound: 'ok', tone: 'wrong', heardTone: 2 });
    expect(res.body.syllables[1].tone).toBe('neutral');
  });

  it('accepts homophones Whisper picks and converts Simplified output', async () => {
    // Whisper heard 再见 (Simplified) for 再見; and 在 for 再 is the same sound.
    transcript = { text: '在见', words: [{ word: '在见', start: 0.08, end: 0.76 }] };
    const res = await check(wav([falling, falling]), '再見', 'zai4 jian4');
    expect(res.body.transcript).toBe('在見');
    expect(res.body.syllables.map((s: { sound: string }) => s.sound)).toEqual(['ok', 'ok']);
  });

  it('marks missing syllables', async () => {
    transcript = { text: '你', words: [] };
    const res = await check(wav([low]), '你好', 'ni3 hao3');
    expect(res.body.syllables[1].sound).toBe('missing');
  });

  it('turns silence away before speech-to-text', async () => {
    transcribed = 0;
    const res = await check(wav([]), '你好', 'ni3 hao3');
    expect(res.status).toBe(400);
    expect(transcribed).toBe(0);
  });

  it('turns a reading that does not fit the characters away before speech-to-text', async () => {
    transcribed = 0;
    const res = await check(wav([rising]), '你好', 'ni3');
    expect(res.status).toBe(400);
    expect(transcribed).toBe(0);
  });

  it('rejects audio that is not WAV', async () => {
    const res = await check(Buffer.from('x'.repeat(200)).toString('base64'), '你好', 'ni3 hao3');
    expect(res.status).toBe(400);
  });

  it('rejects WAV in any format the app does not send', async () => {
    const patched = (offset: number, value: number, bytes: 2 | 4) => {
      const buffer = Buffer.from(wav([rising, low]), 'base64');
      if (bytes === 2) buffer.writeUInt16LE(value, offset);
      else buffer.writeUInt32LE(value, offset);
      return buffer.toString('base64');
    };
    transcribed = 0;
    // A rate this low once made the pitch tracker loop forever.
    for (const audio of [patched(24, 40, 4), patched(24, 1_000_000, 4), patched(22, 2, 2)]) {
      const res = await check(audio, '你好', 'ni3 hao3');
      expect(res.status).toBe(400);
    }
    expect(transcribed).toBe(0);
  });
});
