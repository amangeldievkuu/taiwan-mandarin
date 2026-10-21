// Environment, validated once at startup. Anything missing or malformed stops the server with a
// clear message instead of failing later.

import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  /** Comma-separated origins allowed to call the API with cookies. */
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32).optional(),
  /** Directory with the generated app content (manifest.json, words-*.json, readers.json). */
  CONTENT_DIR: z.string().optional(),
  /** Directory with the dictionary shards. */
  DICT_DIR: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
  OPENAI_API_KEY: z.string().optional(),
  /** AI requests (explain, chat turns) per user per day. */
  AI_DAILY_LIMIT: z.coerce.number().int().default(200),
  /** Pronunciation checks per user per day. */
  SPEECH_DAILY_LIMIT: z.coerce.number().int().default(300),
});

export type Env = z.infer<typeof Env> & { JWT_SECRET: string };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = Env.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  if (!env.JWT_SECRET) {
    if (env.NODE_ENV === 'production')
      throw new Error('JWT_SECRET (32+ characters) is required in production');
    return { ...env, JWT_SECRET: 'development-only-secret-change-me-0123456789' };
  }
  return env as Env;
}

export const ENV = Symbol('ENV');
