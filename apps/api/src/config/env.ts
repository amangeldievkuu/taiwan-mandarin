// Environment, validated once at startup. Anything missing or malformed stops the server with a
// clear message instead of failing later.

import { existsSync } from 'node:fs';
import { z } from 'zod';

/** Reasoning effort as the OpenAI API names it; not every model accepts every value. */
export const EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];

const SERVICE_TIERS = [
  'auto',
  'default',
  'flex',
  'scale',
  'priority',
  'fast',
  'ultrafast',
] as const;

/** `KEY=` in .env and `${KEY:-}` in docker compose arrive as '': treat them as unset. */
const blank = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const lowercase = (value: unknown) => {
  const v = blank(value);
  return typeof v === 'string' ? v.trim().toLowerCase() : v;
};
const text = () => z.preprocess(blank, z.string().trim().optional());
const int = (fallback: number, min: number, max: number) =>
  z.preprocess(blank, z.coerce.number().int().min(min).max(max).default(fallback));

const Env = z.object({
  NODE_ENV: z.preprocess(
    blank,
    z.enum(['development', 'production', 'test']).default('development'),
  ),
  PORT: int(3000, 1, 65_535),
  /**
   * Proxies in front of the API whose X-Forwarded-For to trust: 1 for the bundled nginx, 2 with
   * a TLS proxy or tunnel in front of that. Client IPs (rate limits) come from it.
   */
  TRUST_PROXY: int(1, 0, 10),
  /** Comma-separated origins allowed to call the API with cookies. */
  WEB_ORIGIN: z.preprocess(blank, z.string().default('http://localhost:5173')),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.preprocess(blank, z.string().min(32).optional()),
  /** Directory with the generated app content (manifest.json, words-*.json, readers.json). */
  CONTENT_DIR: text(),
  /** Directory with the dictionary shards. */
  DICT_DIR: text(),
  /** Speech-to-text (pronunciation) and the language model (explain, conversation). */
  OPENAI_API_KEY: text(),
  /** Model for explain and conversation unless a feature sets its own; needs structured outputs. */
  OPENAI_MODEL: z.preprocess(blank, z.string().trim().default('gpt-6-luna')),
  OPENAI_REASONING_EFFORT: z.preprocess(lowercase, z.enum(EFFORTS).default('low')),
  OPENAI_EXPLAIN_MODEL: text(),
  /** Unset: OPENAI_REASONING_EFFORT. */
  OPENAI_EXPLAIN_EFFORT: z.preprocess(lowercase, z.enum(EFFORTS).optional()),
  OPENAI_TALK_MODEL: text(),
  /** Conversation replies are short, so by default the model answers without reasoning first. */
  OPENAI_TALK_EFFORT: z.preprocess(lowercase, z.enum(EFFORTS).default('none')),
  /** whisper-1 gives word timestamps (tone spans); other models are timed from the audio only. */
  OPENAI_TRANSCRIBE_MODEL: z.preprocess(blank, z.string().trim().default('whisper-1')),
  /** "auto" sends nothing; "priority" (or "fast") answers faster at a higher price, "flex" slower. */
  OPENAI_SERVICE_TIER: z.preprocess(lowercase, z.enum(SERVICE_TIERS).default('auto')),
  OPENAI_VERBOSITY: z.preprocess(lowercase, z.enum(['low', 'medium', 'high']).optional()),
  /** Per request; with one retry the worst case stays under the 120 s proxy timeout. */
  OPENAI_TIMEOUT_MS: int(45_000, 5_000, 600_000),
  OPENAI_MAX_RETRIES: int(1, 0, 5),
  /** AI requests (explain, chat turns) per user per day. */
  AI_DAILY_LIMIT: int(200, 0, 1_000_000),
  /** Pronunciation checks per user per day. */
  SPEECH_DAILY_LIMIT: int(300, 0, 1_000_000),
  /** Web Push keys for the daily reminders (npx web-push generate-vapid-keys); unset: no reminders. */
  VAPID_PUBLIC_KEY: text(),
  VAPID_PRIVATE_KEY: text(),
  /** Who push services can contact: a mailto: or https: URL. Unset: WEB_ORIGIN when it's https. */
  VAPID_SUBJECT: text(),
});

export type Env = z.infer<typeof Env> & { JWT_SECRET: string };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Local development reads apps/api/.env (the working directory under npm -w); variables already
  // set win, and the Docker image has no .env, so production is configured by its environment.
  if (source === process.env && existsSync('.env')) process.loadEnvFile('.env');
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

export type AiFeature = 'explain' | 'talk';

export interface AiSettings {
  model: string;
  effort: Effort;
  /** The variables these came from, for messages that tell you what to change. */
  modelVar: string;
  effortVar: string;
}

/** The model and reasoning effort for one AI feature: its own settings, else the global ones. */
export function aiSettings(env: Env, feature: AiFeature): AiSettings {
  const [model, effort] =
    feature === 'explain'
      ? [env.OPENAI_EXPLAIN_MODEL, env.OPENAI_EXPLAIN_EFFORT]
      : [env.OPENAI_TALK_MODEL, env.OPENAI_TALK_EFFORT];
  const prefix = `OPENAI_${feature.toUpperCase()}`;
  return {
    model: model ?? env.OPENAI_MODEL,
    modelVar: model ? `${prefix}_MODEL` : 'OPENAI_MODEL',
    effort: effort ?? env.OPENAI_REASONING_EFFORT,
    effortVar: effort ? `${prefix}_EFFORT` : 'OPENAI_REASONING_EFFORT',
  };
}
