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
});
