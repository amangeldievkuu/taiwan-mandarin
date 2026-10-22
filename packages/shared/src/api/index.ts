// The HTTP API contract: zod schemas validate requests in the API, and their inferred types are
// what the web app (and other clients) send and receive. Kept out of the main entry point so the
// web bundle only takes the types.

import { z } from 'zod';
import type { DayActivity } from '../activity.ts';
import type { Level } from '../content/types.ts';
import { canonicalTimeZone, isTimeZone } from '../days.ts';

/** An IANA time zone ("Asia/Taipei"): where the learner's calendar days begin and end. */
export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_+\-/]+$/)
  .refine(isTimeZone, 'Unknown time zone')
  .transform((zone) => canonicalTimeZone(zone) ?? zone);

export const LevelSchema = z.enum([
  'N1',
  'N2',
  'L1',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
] as const satisfies readonly Level[]);

export const SettingsSchema = z.object({
  phonetics: z.enum(['zhuyin', 'pinyin', 'both']),
  glyphStyle: z.enum(['kai', 'sans']),
  theme: z.enum(['auto', 'light', 'dark']),
  newPerDay: z.number().int().min(0).max(200),
  levels: z.array(LevelSchema).min(1),
  retention: z.number().min(0.7).max(0.99),
});

// ---- Auth ----

export const RegisterSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(1).max(60).optional(),
});
export type RegisterBody = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(8).max(200),
  })
  .refine((b) => b.newPassword !== b.currentPassword, {
    message: 'The new password is the same as the current one',
    path: ['newPassword'],
  });
export type ChangePasswordBody = z.infer<typeof ChangePasswordSchema>;

export interface UserDto {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  /** Short-lived JWT; send as `Authorization: Bearer …`. The refresh token is an httpOnly cookie. */
  accessToken: string;
  expiresIn: number;
}

// ---- Sync ----

/** Counts stored in 32-bit database columns. */
const Int32 = z.number().int().min(-2_147_483_648).max(2_147_483_647);
/** Epoch ms that make a valid Date. */
const EpochMs = z.number().int().min(0).max(8.64e15);

/** An FSRS card as JSON (ts-fsrs `Card` with ISO dates). */
export const CardSchema = z.object({
  due: z.iso.datetime(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: Int32,
  scheduled_days: Int32,
  learning_steps: Int32.default(0),
  reps: Int32,
  lapses: Int32,
  state: z.number().int().min(0).max(3),
  last_review: z.iso.datetime().nullish(),
});

export const CardRecordSchema = z.object({
  wordId: z.string().min(1).max(64),
  card: CardSchema,
  /** Client epoch ms of the last change; the newer side wins. */
  updatedAt: z.number().int(),
  level: LevelSchema.optional(),
  suspended: z.boolean().optional(),
});
export type CardRecordDto = z.infer<typeof CardRecordSchema>;

export const ReviewSchema = z.object({
  /** Client-generated UUID; duplicates are ignored. */
  id: z.uuid(),
  wordId: z.string().min(1).max(64),
  rating: z.number().int().min(1).max(4),
  state: z.number().int().min(0).max(3),
  review: EpochMs,
  due: EpochMs,
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: Int32,
  scheduledDays: Int32,
  durationMs: Int32.min(0),
});
export type ReviewDto = z.infer<typeof ReviewSchema>;

export const DeckEntrySchema = z.object({
  id: z.string().min(1).max(64),
  level: LevelSchema.optional(),
  addedAt: z.number().int(),
});

export const SyncRequestSchema = z.object({
  /** Server cursor from the previous sync (epoch ms); 0 for a full download. */
  since: z.number().int().min(0),
  cards: z.array(CardRecordSchema).max(20000),
  reviews: z.array(ReviewSchema).max(20000),
  deck: z
    .object({ entries: z.array(DeckEntrySchema).max(5000), updatedAt: z.number().int() })
    .optional(),
  settings: z.object({ value: SettingsSchema, updatedAt: z.number().int() }).optional(),
  /**
   * Practice totals per day in this time zone, for the streak, XP and charts: every day when
   * `since` is 0, otherwise the days with reviews stored after `since` (epoch ms).
   */
  activity: z.object({ timeZone: TimeZoneSchema, since: z.number().int().min(0) }).optional(),
});
export type SyncRequest = z.infer<typeof SyncRequestSchema>;

export interface SyncResponse {
  /** Pass back as `since` next time. */
  cursor: number;
  /** Cards changed on the server since `since` (including ones this request just won). */
  cards: CardRecordDto[];
  deck?: { entries: z.infer<typeof DeckEntrySchema>[]; updatedAt: number };
  settings?: { value: z.infer<typeof SettingsSchema>; updatedAt: number };
  /** Personal FSRS weights, once trained on this learner's reviews. */
  fsrs?: { w: number[]; trainedAt: string; reviewCount: number };
  /** Review ids the server stored (or already had). */
  acceptedReviews: string[];
  /**
   * Totals per day across all the learner's devices (when asked for). `full`: every day, which
   * replaces what the client had; otherwise only days that changed.
   */
  activity?: { timeZone: string; full: boolean; days: DayActivity[] };
}

// ---- Personal access tokens (public API) ----

export const TokenCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

export interface TokenDto {
  id: string;
  name: string;
  /** First characters, to recognize the token: "tm_abc123…". */
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface TokenCreatedDto extends TokenDto {
  /** Shown once. */
  token: string;
}

// ---- Stats ----

export interface StatsDto {
  cards: { learned: number; mature: number; suspended: number; byLevel: Record<string, number> };
  reviews: { total: number; last30Days: number; retention: number | null };
  /**
   * The kintsugi streak: days practiced in the current bowl (a gap of up to three days is mended
   * with gold), the most in any bowl, days missed that can still be mended, and gold seams.
   */
  streak: { current: number; longest: number; crack: number; seams: number };
  xp: { total: number; today: number };
  days: { date: string; total: number; again: number; hard: number; good: number; easy: number }[];
}

// ---- AI: explain a sentence ----

export const ExplainRequestSchema = z
  .object({
    text: z.string().trim().max(1500).optional(),
    /** A photo of a sign, menu or message: base64 without the data: prefix. */
    image: z
      .object({
        mediaType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
        data: z.string().max(7_000_000),
      })
      .optional(),
  })
  .refine((r) => r.text || r.image, { message: 'Send text or an image' });
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

export interface ExplainToken {
  text: string;
  /** Numbered pinyin (Taiwan reading) for Chinese tokens. */
  pinyin?: string;
  gloss?: string;
  /** Part of speech from the word lists (N, Vs, …), for study-path words. */
  pos?: string;
  note?: string;
  /** Study-path word, when the token is one. */
  wordId?: string;
  level?: string;
}

export interface ExplainResult {
  /** The Chinese text explained (transcribed, for an image). */
  source: string;
  translation: string;
  tokens: ExplainToken[];
  grammar: { pattern: string; explanation: string }[];
  /** Register, politeness, Taiwan-specific usage, what kind of sign or message it is. */
  notes: string[];
  /** Taiwan-standard guard findings in the generated text, if any. */
  warnings: string[];
}

/**
 * POST /v1/ai/explain/stream sends one of these per line (application/x-ndjson): the source text,
 * the translation as it grows, each word once it is complete, and finally the whole result
 * (authoritative: it replaces what came before). `ping` keeps idle connections open.
 */
export type ExplainStreamEvent =
  | { type: 'source'; text: string }
  | { type: 'translation'; text: string }
  | { type: 'token'; index: number; token: ExplainToken }
  | { type: 'ping' }
  | { type: 'done'; result: ExplainResult }
  | { type: 'error'; status: number; message: string };

// ---- AI: conversation practice ----

export const SCENARIOS = [
  { id: 'night-market', zh: '夜市點餐', en: 'Ordering at a night-market stall' },
  { id: 'bubble-tea', zh: '買飲料', en: 'Buying bubble tea' },
  { id: 'mrt', zh: '問路', en: 'Asking the way at an MRT station' },
  { id: 'convenience-store', zh: '便利商店', en: 'At the convenience store' },
  { id: 'classmate', zh: '認識同學', en: 'Meeting a new classmate' },
  { id: 'clinic', zh: '看醫生', en: 'At the clinic' },
  { id: 'renting', zh: '租房子', en: 'Viewing a room to rent' },
  { id: 'free', zh: '自由聊天', en: 'Free conversation' },
] as const;
export type ScenarioId = (typeof SCENARIOS)[number]['id'];

export const TalkRequestSchema = z.object({
  conversationId: z.uuid().optional(),
  scenario: z.enum(SCENARIOS.map((s) => s.id) as [ScenarioId, ...ScenarioId[]]).default('free'),
  /** The learner's message; empty to let the partner open the conversation. */
  message: z.string().trim().max(500).default(''),
});
export type TalkRequest = z.input<typeof TalkRequestSchema>;

/** A sentence's reading: numbered pinyin, one syllable per Chinese character, and word lengths. */
export interface TextReading {
  pinyin: string;
  wordLengths: number[];
}

export interface TalkMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Assistant: the reply's Taiwan reading, when every character has one. */
  reading?: TextReading;
  /** Assistant: English translation. */
  translation?: string;
  /** Assistant: words in the reply the learner hasn't studied. */
  newWords?: { text: string; pinyin?: string; gloss?: string; wordId?: string }[];
  /** User: a corrected version and why, when the message had mistakes or un-Taiwanese wording. */
  correction?: { corrected: string; explanation: string; reading?: TextReading } | null;
}

export interface TalkResponse {
  conversationId: string;
  /** The learner's message with its correction (if one was sent) and the partner's reply. */
  messages: TalkMessage[];
}

/** How a finished conversation went. */
export interface TalkSummary {
  /** Messages the learner sent. */
  sent: number;
  /** Of those, how many came back with a correction. */
  corrected: number;
  /** New words the partner used, once each, in the order they came up. */
  newWords: NonNullable<TalkMessage['newWords']>;
}

/** A row of GET /v1/ai/talk. */
export interface TalkListItem {
  id: string;
  scenario: ScenarioId;
  updatedAt: string;
  /** Set once the learner ended it. */
  endedAt: string | null;
  last: string;
}

/** GET /v1/ai/talk/:id */
export interface TalkConversation {
  scenario: ScenarioId;
  messages: TalkMessage[];
  endedAt: string | null;
  /** Once ended. */
  summary: TalkSummary | null;
}

/** POST /v1/ai/talk/:id/end */
export interface TalkEndResponse {
  /** The partner's goodbye; null when there wasn't one (already ended, or no AI left today). */
  message: TalkMessage | null;
  endedAt: string;
  summary: TalkSummary;
}

// ---- Pronunciation check ----

export const PronounceRequestSchema = z.object({
  /** 16 kHz mono 16-bit PCM WAV, base64; at most about 15 seconds. */
  audio: z.string().min(100).max(700_000),
  /** What the learner tried to say, in characters. */
  target: z.string().trim().min(1).max(60),
  /** Its numbered pinyin, one syllable per character; looked up when omitted. */
  pinyin: z.string().max(400).optional(),
});
export type PronounceRequest = z.infer<typeof PronounceRequestSchema>;

export interface SyllableResult {
  char: string;
  /** Target reading, numbered pinyin (citation tone). */
  pinyin: string;
  /** Tone expected in speech, after sandhi (5 = neutral). */
  expectedTone: number;
  /** What speech-to-text heard at this position, if anything. */
  heard?: string;
  sound: 'ok' | 'wrong' | 'missing';
  tone: 'ok' | 'wrong' | 'unclear' | 'neutral';
  heardTone?: number;
  /** Normalized pitch contour (0–1, five points) for drawing. */
  contour: number[];
}

export interface PronounceResult {
  /** What was heard, in Taiwan characters. */
  transcript: string;
  syllables: SyllableResult[];
  /** 0–100. */
  score: number;
}
