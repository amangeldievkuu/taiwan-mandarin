// Conversation practice: a Taiwanese conversation partner who speaks only with words the learner
// knows (their studied cards plus Novice 1), corrects the learner's messages, and sounds like
// Taiwan. Each reply is checked: words outside the learner's vocabulary or Mainland wording
// trigger one rewrite; anything still unknown is returned as "new words" for the UI to highlight.

import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { levelIndex, type Level } from '@taiwan-mandarin/shared';
import {
  SCENARIOS,
  SettingsSchema,
  type ScenarioId,
  type TalkMessage,
  type TalkResponse,
} from '@taiwan-mandarin/shared/api';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ContentService } from '../content/content.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClaudeService } from './claude.service.js';
import { TAIWAN_STYLE } from './taiwan-style.js';

const ReplySchema = z.object({
  reply: z.string().describe('Your next line in the conversation, in Chinese'),
  translation: z.string().describe('English translation of your reply'),
  correction: z
    .object({
      corrected: z
        .string()
        .describe("The learner's message, corrected and in natural Taiwan Mandarin"),
      explanation: z
        .string()
        .describe('One or two short English sentences on what changed and why'),
    })
    .nullable()
    .describe("Null when the learner's last message was fine (or there was none)"),
});

const PARTNERS: Record<ScenarioId, string> = {
  'night-market':
    'You run a food stall at Raohe Night Market in Taipei (蚵仔煎, 雞排, 大腸包小腸). The learner is a customer.',
  'bubble-tea':
    'You work at a bubble tea shop. Ask about size, sugar and ice levels like a real clerk.',
  mrt: 'You are a friendly local at Taipei Main Station. The learner asks how to get somewhere by MRT.',
  'convenience-store':
    'You are a clerk at a 7-Eleven. Offer a bag, ask about the receipt carrier (載具), heating food, paying by EasyCard.',
  classmate:
    'You are a Taiwanese university student meeting the learner, a new classmate in a Mandarin class.',
  clinic:
    'You are a receptionist and then a doctor at a neighbourhood clinic. The learner has a cold.',
  renting:
    'You are a landlord showing a room near a university in Taipei. Talk about rent, utilities, the deposit.',
  free: 'You are a friendly Taiwanese friend chatting about everyday life.',
};

const NUMBERS = /^[一二三四五六七八九十百千萬億〇零兩幾]+$/;
const MAX_HISTORY = 30;

@Injectable()
export class TalkService {
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(ClaudeService) private readonly claude: ClaudeService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  /** Headwords the partner may use: studied cards, Novice 1, and every level below the learner's. */
  async vocabulary(userId: string): Promise<{ words: Set<string>; level: Level }> {
    const [user, cards] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } }),
      this.db.card.findMany({ where: { userId }, select: { wordId: true } }),
    ]);
    const settings = SettingsSchema.safeParse(user.settings);
    const levels = settings.success ? settings.data.levels : ['N1'];
    const level = [...levels].sort(
      (a, b) => levelIndex(a as Level) - levelIndex(b as Level),
    )[0] as Level;
    const words = new Set<string>();
    for (const card of cards) {
      const word = this.content.word(card.wordId);
      if (word) words.add(word.hanzi);
    }
    for (const info of this.content.levels()) {
      if (info.id === 'N1' || levelIndex(info.id) < levelIndex(level)) {
        for (const w of this.content.searchWords({ level: info.id, limit: 100_000, offset: 0 })
          .items)
          words.add(w.hanzi);
      }
    }
    return { words, level };
  }

  private system(scenario: ScenarioId, vocabulary: Set<string>): string {
    const info = SCENARIOS.find((s) => s.id === scenario);
    return `You are a conversation partner for someone learning Taiwan Mandarin. Scenario: ${info?.en} (${info?.zh}). ${PARTNERS[scenario]}

${TAIWAN_STYLE}

How to talk:
- Stay in the scenario and keep it going: reply in one to three short sentences, and usually end with a question or a natural prompt for the learner.
- Use only words from the learner's vocabulary below, plus numbers, names and punctuation. If an idea needs a word outside it, say it more simply. Grammar words (的, 了, 嗎, 呢, 吧, 很, 也, 都, 不, 沒) are fine.
- If the learner writes English or pinyin, answer in Chinese and gently show how to say it.
- correction: if the learner's last message has a mistake, sounds unnatural, or uses Mainland wording, give the corrected Taiwan Mandarin version and a short explanation. Otherwise null.
- If there is no learner message yet, open the conversation as your character would.

The learner's vocabulary:
${[...vocabulary].join(' ')}`;
  }

  async talk(
    userId: string,
    request: { conversationId?: string; scenario: ScenarioId; message: string },
  ): Promise<TalkResponse> {
    const conversation = request.conversationId
      ? await this.db.conversation.findUnique({
          where: { id: request.conversationId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        })
      : null;
    if (request.conversationId && !conversation)
      throw new NotFoundException('No such conversation');
    if (conversation && conversation.userId !== userId) throw new ForbiddenException();
    const scenario = (conversation?.scenario as ScenarioId | undefined) ?? request.scenario;

    const { words, level } = await this.vocabulary(userId);
    const history: Anthropic.Beta.BetaMessageParam[] = (conversation?.messages ?? [])
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));
    // The API needs a user turn first and last.
    const prompt = request.message || '（請開始對話。）';
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...(history[0]?.role === 'assistant' ? [{ role: 'user' as const, content: '（開始）' }] : []),
      ...history,
      { role: 'user', content: prompt },
    ];
    const system = this.system(scenario, words);

    let answer = await this.claude.structured({
      schema: ReplySchema,
      system,
      messages,
      effort: 'low',
      maxTokens: 4000,
    });
    let check = this.check(answer.reply, words);
    if (check.unknown.length > 2 || check.mainland.length) {
      // One rewrite, as a mid-conversation system note (keeps the cached prefix intact).
      const note = [
        check.unknown.length > 2 &&
          `Your reply used words outside the learner's vocabulary: ${check.unknown.map((u) => u.text).join('、')}. Say it with known words.`,
        check.mainland.length && `Use Taiwan wording: ${check.mainland.join('; ')}.`,
      ]
        .filter(Boolean)
        .join(' ');
      answer = await this.claude.structured({
        schema: ReplySchema,
        system,
        messages: [...messages, { role: 'system', content: `Write your reply again. ${note}` }],
        effort: 'low',
        maxTokens: 4000,
      });
      check = this.check(answer.reply, words);
    }

    const saved =
      conversation ?? (await this.db.conversation.create({ data: { userId, scenario, level } }));
    const created: TalkMessage[] = [];
    if (request.message) {
      const row = await this.db.message.create({
        data: {
          conversationId: saved.id,
          role: 'user',
          content: request.message,
          meta: { correction: answer.correction },
        },
      });
      created.push({
        id: row.id,
        role: 'user',
        content: row.content,
        correction: answer.correction,
      });
    }
    const reply = await this.db.message.create({
      data: {
        conversationId: saved.id,
        role: 'assistant',
        content: answer.reply,
        meta: { translation: answer.translation, newWords: check.unknown },
      },
    });
    await this.db.conversation.update({ where: { id: saved.id }, data: { updatedAt: new Date() } });
    created.push({
      id: reply.id,
      role: 'assistant',
      content: answer.reply,
      translation: answer.translation,
      newWords: check.unknown,
    });
    return { conversationId: saved.id, messages: created };
  }

  /** Words in the reply outside the learner's vocabulary, and Mainland wording. */
  check(reply: string, known: Set<string>) {
    const unknown = new Map<string, NonNullable<TalkMessage['newWords']>[number]>();
    for (const token of this.content.segment(reply)) {
      if (!token.han || known.has(token.text) || NUMBERS.test(token.text)) continue;
      // A compound of known words (每天, 這個) is fine.
      if ([...token.text].every((c) => known.has(c))) continue;
      unknown.set(token.text, {
        text: token.text,
        ...(token.word
          ? { pinyin: token.word.pinyin, gloss: token.word.en, wordId: token.word.id }
          : {}),
        ...(!token.word && token.entry
          ? { pinyin: token.entry.p, gloss: token.entry.d.slice(0, 2).join('; ') }
          : {}),
      });
    }
    const mainland = checkText({ text: reply, where: 'talk' }).map((i) => i.problem);
    return { unknown: [...unknown.values()], mainland };
  }

  async list(userId: string) {
    const rows = await this.db.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return rows.map((c) => ({
      id: c.id,
      scenario: c.scenario,
      updatedAt: c.updatedAt.toISOString(),
      last: c.messages[0]?.content ?? '',
    }));
  }

  async messages(
    userId: string,
    id: string,
  ): Promise<{ scenario: string; messages: TalkMessage[] }> {
    const conversation = await this.db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('No such conversation');
    if (conversation.userId !== userId) throw new ForbiddenException();
    return {
      scenario: conversation.scenario,
      messages: conversation.messages.map((m) => {
        const meta = (m.meta ?? {}) as Partial<TalkMessage>;
        return {
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          ...(meta.translation ? { translation: meta.translation } : {}),
          ...(meta.newWords ? { newWords: meta.newWords } : {}),
          ...(meta.correction !== undefined ? { correction: meta.correction } : {}),
        };
      }),
    };
  }
}
