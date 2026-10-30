import webpush from 'web-push';
import { describe, expect, it } from 'vitest';
import { aiSettings, loadEnv } from './env.js';

describe('loadEnv', () => {
  it('fills in the AI defaults', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://localhost/x' });
    expect(env).toMatchObject({
      OPENAI_MODEL: 'gpt-6-luna',
      OPENAI_REASONING_EFFORT: 'low',
      OPENAI_TALK_EFFORT: 'none',
      OPENAI_TRANSCRIBE_MODEL: 'whisper-1',
      OPENAI_SERVICE_TIER: 'auto',
      OPENAI_TIMEOUT_MS: 45_000,
      OPENAI_MAX_RETRIES: 1,
      AI_DAILY_LIMIT: 200,
    });
    expect(aiSettings(env, 'explain')).toEqual({
      model: 'gpt-6-luna',
      modelVar: 'OPENAI_MODEL',
      effort: 'low',
      effortVar: 'OPENAI_REASONING_EFFORT',
    });
    expect(aiSettings(env, 'talk')).toMatchObject({
      effort: 'none',
      effortVar: 'OPENAI_TALK_EFFORT',
    });
  });

  it('treats empty values as unset', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://localhost/x',
      OPENAI_MODEL: '',
      OPENAI_EXPLAIN_MODEL: '',
      OPENAI_EXPLAIN_EFFORT: ' ',
      OPENAI_TALK_EFFORT: '',
      AI_DAILY_LIMIT: '',
      JWT_SECRET: '',
    });
    expect(env.AI_DAILY_LIMIT).toBe(200);
    expect(aiSettings(env, 'explain')).toMatchObject({ model: 'gpt-6-luna', effort: 'low' });
    expect(env.OPENAI_TALK_EFFORT).toBe('none');
  });

  it('lets each feature pick its own model and effort', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgresql://localhost/x',
      OPENAI_MODEL: 'gpt-5.5',
      OPENAI_EXPLAIN_MODEL: 'gpt-6.1-sol',
      OPENAI_EXPLAIN_EFFORT: 'Medium',
    });
    expect(aiSettings(env, 'explain')).toEqual({
      model: 'gpt-6.1-sol',
      modelVar: 'OPENAI_EXPLAIN_MODEL',
      effort: 'medium',
      effortVar: 'OPENAI_EXPLAIN_EFFORT',
    });
    expect(aiSettings(env, 'talk').model).toBe('gpt-5.5');
  });

  it('names the variable when a value is invalid', () => {
    expect(() =>
      loadEnv({ DATABASE_URL: 'postgresql://localhost/x', OPENAI_TALK_EFFORT: 'hgih' }),
    ).toThrow(/OPENAI_TALK_EFFORT/);
  });

  describe('VAPID keys', () => {
    const db = { DATABASE_URL: 'postgresql://localhost/x' };
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();

    it('accepts a pair, or no keys at all', () => {
      expect(
        loadEnv({ ...db, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey }),
      ).toMatchObject({ VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey });
      expect(
        loadEnv({ ...db, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' }).VAPID_PUBLIC_KEY,
      ).toBeUndefined();
    });

    it('stops at startup on a key cut short or with stray characters', () => {
      expect(() =>
        loadEnv({ ...db, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey.slice(0, 40) }),
      ).toThrow(/43 base64url characters[\s\S]*VAPID_PRIVATE_KEY/);
      expect(() =>
        loadEnv({ ...db, VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: `"${privateKey}"` }),
      ).toThrow(/VAPID_PRIVATE_KEY/);
    });

    it('says when the two keys are swapped', () => {
      expect(() =>
        loadEnv({ ...db, VAPID_PUBLIC_KEY: privateKey, VAPID_PRIVATE_KEY: publicKey }),
      ).toThrow(/are the two swapped/);
    });

    it('wants both keys or neither', () => {
      expect(() => loadEnv({ ...db, VAPID_PUBLIC_KEY: publicKey })).toThrow(/VAPID_PRIVATE_KEY/);
    });
  });
});
