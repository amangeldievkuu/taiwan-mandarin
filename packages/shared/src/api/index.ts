// The HTTP API contract: zod schemas validate requests in the API, and their inferred types are
// what the web app (and other clients) send and receive. Kept out of the main entry point so the
// web bundle only takes the types.

import { z } from 'zod';
import type { Level } from '../content/types.ts';

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

/** An FSRS card as JSON (ts-fsrs `Card` with ISO dates). */
export const CardSchema = z.object({
  due: z.iso.datetime(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number().int(),
  scheduled_days: z.number().int(),
  learning_steps: z.number().int().default(0),
  reps: z.number().int(),
  lapses: z.number().int(),
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
  review: z.number().int(),
  due: z.number().int(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int(),
  scheduledDays: z.number().int(),
  durationMs: z.number().int().min(0),
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
  streak: { current: number; longest: number };
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

export interface TalkMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** Assistant: English translation. */
  translation?: string;
  /** Assistant: words in the reply the learner hasn't studied. */
  newWords?: { text: string; pinyin?: string; gloss?: string; wordId?: string }[];
  /** User: a corrected version and why, when the message had mistakes or un-Taiwanese wording. */
  correction?: { corrected: string; explanation: string } | null;
}

export interface TalkResponse {
  conversationId: string;
  /** The learner's message with its correction (if one was sent) and the partner's reply. */
  messages: TalkMessage[];
}
