// Conversation practice: a Taiwanese conversation partner who speaks only with words the learner
// knows (their studied cards plus Novice 1), corrects the learner's messages, and sounds like
// Taiwan. Each reply is checked: words outside the learner's vocabulary or Mainland wording
// trigger one rewrite; anything still unknown is returned as "new words" for the UI to highlight.

import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { LEVELS, levelIndex, sameWordForms, type Level, type Word } from '@taiwan-mandarin/shared';
import {
  SCENARIOS,
  SettingsSchema,
  type ScenarioId,
  type TalkConversation,
  type TalkEndResponse,
  type TalkListItem,
  type TalkMessage,
  type TalkResponse,
  type TalkSummary,
} from '@taiwan-mandarin/shared/api';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import { z } from 'zod';
import { ContentService } from '../content/content.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LlmService, type LlmMessage } from './llm.service.js';
import { formalTai, TAIWAN_STYLE } from './taiwan-style.js';

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
type Reply = z.infer<typeof ReplySchema>;

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

// The same for every learner and turn, so it heads the prompt (the cacheable part).
const RULES = `You are a conversation partner for someone learning Taiwan Mandarin.

${TAIWAN_STYLE}

How to talk:
- Stay in the scenario given at the end and keep it going: reply in one to three short sentences, and usually end with a question or a natural prompt for the learner.
- Use only words from the learner's vocabulary below, plus numbers, names and punctuation. If an idea needs a word outside it, say it more simply; bring in at most one or two new words, and only when the scenario needs them. Grammar words (的, 了, 嗎, 呢, 吧, 很, 也, 都, 不, 沒) are fine.
- If the learner writes English or pinyin, answer in Chinese and gently show how to say it.
- correction: if the learner's last message has a mistake, sounds unnatural, or uses Mainland wording, give the corrected Taiwan Mandarin version and a short explanation. Otherwise null.
- If there is no learner message yet, open the conversation as your character would.`;

// Sent after the learner's "（我要走了。）" when they end the conversation.
const CLOSING = `The learner is ending the conversation now. Say goodbye as your character would, in one short, warm sentence with known words, and do not ask anything. correction: null.`;

const NUMBERS = /^[一二三四五六七八九十百千萬億〇零兩幾]+$/;
const MAX_HISTORY = 30;
/** Words listed in the prompt; the learner knows more, and the check after the reply uses all. */
const LISTED_LEVEL_WORDS = 1200;
const LISTED_STUDIED_WORDS = 800;

interface Vocabulary {
  /** Every written form the learner knows, for checking replies. */
  known: Set<string>;
  /** The prompt section describing it. */
  prompt: string;
  level: Level;
}

@Injectable()
export class TalkService {
  private readonly logger = new Logger(TalkService.name);
  /** Each level's words in study order (most common first), and all their written forms. */
  private readonly levelWords = new Map<Level, { words: Word[]; forms: string[] }>();

  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(LlmService) private readonly llm: LlmService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  private wordsOf(level: Level): { words: Word[]; forms: string[] } {
    let entry = this.levelWords.get(level);
    if (!entry) {
      const words = this.content.searchWords({ level, limit: 100_000, offset: 0 }).items;
      entry = { words, forms: words.flatMap((w) => sameWordForms(w)) };
      this.levelWords.set(level, entry);
    }
    return entry;
  }

  /** What the partner may use: studied cards, Novice 1, and every level below the learner's. */
  async vocabulary(userId: string): Promise<Vocabulary> {
    const [user, cards] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { settings: true } }),
      this.db.card.findMany({ where: { userId }, select: { wordId: true } }),
    ]);
    const settings = SettingsSchema.safeParse(user.settings);
    const selected = settings.success ? settings.data.levels : ['N1' as const];
    const level = [...selected].sort((a, b) => levelIndex(a) - levelIndex(b))[0] ?? 'N1';

    const known = new Set<string>();
    const base = this.content
      .levels()
      .filter((info) => info.id === 'N1' || levelIndex(info.id) < levelIndex(level))
      .map((info) => info.id);
    const levelList: string[] = [];
    for (const id of base) {
      const { words, forms } = this.wordsOf(id);
      for (const form of forms) known.add(form);
      levelList.push(...words.map((w) => w.hanzi));
    }
    // Studied words in path order, so the prompt stays the same from turn to turn (and cached).
    const studied = cards
      .flatMap((c) => this.content.word(c.wordId) ?? [])
      .sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.rank - b.rank);
    for (const word of studied) for (const form of sameWordForms(word)) known.add(form);

    const listed = levelList.slice(0, LISTED_LEVEL_WORDS);
    const listedSet = new Set(listed);
    const extra = studied
      .map((w) => w.hanzi)
      .filter((h) => !listedSet.has(h))
      .slice(0, LISTED_STUDIED_WORDS);
    const lastBase = LEVELS.find((l) => l.id === base.at(-1));
    const scope = lastBase
      ? `TOCFL Novice 1 through ${lastBase.en} (${lastBase.cefr})`
      : 'TOCFL Novice 1';
    const prompt = [
      levelList.length > listed.length
        ? `The learner's vocabulary: every word of ${scope}. The most common of them:`
        : `The learner's vocabulary: the words of ${scope}:`,
      listed.join(' '),
      ...(extra.length ? ['Words they have studied beyond that:', extra.join(' ')] : []),
    ].join('\n');
    return { known, prompt, level };
  }

  async talk(
    userId: string,
    request: { conversationId?: string; scenario: ScenarioId; message: string },
  ): Promise<TalkResponse> {
    const [conversation, vocabulary] = await Promise.all([
      request.conversationId
        ? this.db.conversation.findUnique({
            where: { id: request.conversationId },
            include: { messages: { orderBy: { createdAt: 'desc' }, take: MAX_HISTORY } },
          })
        : null,
      this.vocabulary(userId),
    ]);
    if (request.conversationId && !conversation)
      throw new NotFoundException('No such conversation');
    if (conversation && conversation.userId !== userId) throw new ForbiddenException();
    if (conversation?.endedAt) throw new ConflictException('This conversation has ended.');
    const scenario = (conversation?.scenario as ScenarioId | undefined) ?? request.scenario;

    const messages = this.turns(
      [...(conversation?.messages ?? [])].reverse(),
      request.message || '（請開始對話。）',
    );
    const system = this.system(scenario, vocabulary);
    const call = (turns: LlmMessage[]) => this.reply(userId, system, turns);

    let answer = await call(messages);
    let check = this.check(answer, vocabulary.known);
    if (check.unknown.length > 2 || check.mainland.length) {
      // One rewrite: the model sees its first attempt and what to change about it.
      const note = [
        check.unknown.length > 2 &&
          `Your reply used words outside the learner's vocabulary: ${check.unknown.map((u) => u.text).join('、')}. Say it with known words.`,
        check.mainland.length && `Use Taiwan wording: ${check.mainland.join('; ')}.`,
      ]
        .filter(Boolean)
        .join(' ');
      // A rewrite doubles the wait, so say why it happened.
      this.logger.log(`talk rewrite: ${note}`);
      answer = await call([
        ...messages,
        { role: 'assistant', content: JSON.stringify(answer) },
        { role: 'developer', content: `Write your reply again. ${note}` },
      ]);
      check = this.check(answer, vocabulary.known);
    }

    // Both messages in one write; the learner's comes first.
    const now = Date.now();
    const userRow = request.message
      ? {
          id: randomUUID(),
          role: 'user',
          content: request.message,
          meta: { correction: answer.correction },
          createdAt: new Date(now),
        }
      : null;
    const replyRow = {
      id: randomUUID(),
      role: 'assistant',
      content: answer.reply,
      meta: { translation: answer.translation, newWords: check.unknown },
      createdAt: new Date(now + 1),
    };
    const rows = userRow ? [userRow, replyRow] : [replyRow];
    const saved = conversation
      ? await this.db.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date(now), messages: { create: rows } },
        })
      : await this.db.conversation.create({
          data: { userId, scenario, level: vocabulary.level, messages: { create: rows } },
        });

    const out: TalkMessage[] = [
      ...(userRow
        ? [
            {
              id: userRow.id,
              role: 'user' as const,
              content: userRow.content,
              correction: answer.correction,
            },
          ]
        : []),
      {
        id: replyRow.id,
        role: 'assistant',
        content: answer.reply,
        translation: answer.translation,
        newWords: check.unknown,
      },
    ];
    return { conversationId: saved.id, messages: out.map((m) => this.withReadings(m)) };
  }

  /**
   * Ends a conversation: the partner says goodbye (when `mayClose` allows another AI call), and it
   * becomes read-only with a summary. Ending one that already ended just returns its summary.
   */
  async end(
    userId: string,
    id: string,
    mayClose: () => Promise<boolean>,
  ): Promise<TalkEndResponse> {
    const conversation = await this.owned(userId, id);
    if (conversation.endedAt) {
      return {
        message: null,
        endedAt: conversation.endedAt.toISOString(),
        summary: this.summarize(conversation.messages),
      };
    }

    let closing: TalkMessage | null = null;
    if (conversation.messages.length && this.llm.available && (await mayClose())) {
      try {
        const vocabulary = await this.vocabulary(userId);
        const answer = await this.reply(
          userId,
          this.system(conversation.scenario as ScenarioId, vocabulary),
          [
            ...this.turns(conversation.messages.slice(-MAX_HISTORY), '（我要走了。）'),
            { role: 'developer', content: CLOSING },
          ],
        );
        const check = this.check({ ...answer, correction: null }, vocabulary.known);
        closing = {
          id: randomUUID(),
          role: 'assistant',
          content: answer.reply,
          translation: answer.translation,
          newWords: check.unknown,
        };
      } catch (error) {
        // The goodbye is a nicety: the conversation still ends without it.
        this.logger.warn(`talk closing line failed: ${String(error)}`);
      }
    }

    const endedAt = new Date();
    const closingRow = closing && {
      id: closing.id,
      role: 'assistant',
      content: closing.content,
      meta: { translation: closing.translation, newWords: closing.newWords, closing: true },
      createdAt: endedAt,
    };
    await this.db.conversation.update({
      where: { id },
      data: { endedAt, ...(closingRow ? { messages: { create: closingRow } } : {}) },
    });
    return {
      message: closing && this.withReadings(closing),
      endedAt: endedAt.toISOString(),
      summary: this.summarize([...conversation.messages, ...(closingRow ? [closingRow] : [])]),
    };
  }

  /** Deletes a conversation and its messages. */
  async remove(userId: string, id: string): Promise<void> {
    await this.owned(userId, id);
    await this.db.conversation.delete({ where: { id } });
  }

  /** The learner's conversation with its messages, oldest first. */
  private async owned(userId: string, id: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('No such conversation');
    if (conversation.userId !== userId) throw new ForbiddenException();
    return conversation;
  }

  /** The partner's instructions: the rules, this learner's vocabulary, and the scenario. */
  private system(scenario: ScenarioId, vocabulary: Vocabulary): string {
    const info = SCENARIOS.find((s) => s.id === scenario);
    return `${RULES}\n\n${vocabulary.prompt}\n\nScenario: ${info?.en} (${info?.zh}). ${PARTNERS[scenario]}`;
  }

  /** Stored messages (oldest first) as model turns, ending with the learner's `prompt`. */
  private turns(history: { role: string; content: string }[], prompt: string): LlmMessage[] {
    const turns = history.map((m): LlmMessage => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
    // The API needs a user turn first and last.
    return [
      ...(turns[0]?.role === 'assistant' ? [{ role: 'user' as const, content: '（開始）' }] : []),
      ...turns,
      { role: 'user', content: prompt },
    ];
  }

  private reply(userId: string, system: string, turns: LlmMessage[]) {
    return this.llm.structured({
      feature: 'talk',
      schema: ReplySchema,
      name: 'reply',
      system,
      messages: turns,
      maxTokens: 4000,
      cacheKey: `talk:${userId}`,
    });
  }

  /** How the conversation went, from its stored messages. */
  private summarize(rows: { role: string; meta: unknown }[]): TalkSummary {
    let sent = 0;
    let corrected = 0;
    const newWords = new Map<string, TalkSummary['newWords'][number]>();
    for (const row of rows) {
      const meta = (row.meta ?? {}) as Partial<TalkMessage>;
      if (row.role === 'user') {
        sent++;
        if (meta.correction) corrected++;
      } else
        for (const w of meta.newWords ?? []) if (!newWords.has(w.text)) newWords.set(w.text, w);
    }
    return { sent, corrected, newWords: [...newWords.values()] };
  }

  /**
   * The message with the Taiwan reading of its Chinese: the partner's reply, or the corrected
   * version of the learner's message. Worked out when sent rather than stored, so older
   * conversations have readings too.
   */
  private withReadings(message: TalkMessage): TalkMessage {
    if (message.role === 'assistant') {
      const reading = this.content.reading(message.content);
      return reading ? { ...message, reading } : message;
    }
    const reading = message.correction && this.content.reading(message.correction.corrected);
    return reading && message.correction
      ? { ...message, correction: { ...message.correction, reading } }
      : message;
  }

  /** Words in the reply outside the learner's vocabulary, and Mainland wording in the answer. */
  check(answer: Reply, known: Set<string>) {
    const unknown = new Map<string, NonNullable<TalkMessage['newWords']>[number]>();
    const isKnown = (text: string) => known.has(text) || known.has(formalTai(text));
    for (const token of this.content.segment(answer.reply)) {
      if (!token.han || isKnown(token.text) || NUMBERS.test(token.text)) continue;
      // A compound of known words (每天, 這個) is fine.
      if ([...token.text].every((c) => isKnown(c))) continue;
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
    const mainland = [
      ...checkText({ text: answer.reply, where: 'talk' }),
      ...(answer.correction
        ? checkText({ text: answer.correction.corrected, where: 'talk:correction' })
        : []),
    ].map((i) => i.problem);
    return { unknown: [...unknown.values()], mainland };
  }

  async list(userId: string): Promise<TalkListItem[]> {
    const rows = await this.db.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return rows.map((c) => ({
      id: c.id,
      scenario: c.scenario as ScenarioId,
      updatedAt: c.updatedAt.toISOString(),
      endedAt: c.endedAt?.toISOString() ?? null,
      last: c.messages[0]?.content ?? '',
    }));
  }

  async messages(userId: string, id: string): Promise<TalkConversation> {
    const conversation = await this.owned(userId, id);
    return {
      scenario: conversation.scenario as ScenarioId,
      endedAt: conversation.endedAt?.toISOString() ?? null,
      summary: conversation.endedAt ? this.summarize(conversation.messages) : null,
      messages: conversation.messages.map((m) => {
        const meta = (m.meta ?? {}) as Partial<TalkMessage>;
        return this.withReadings({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          ...(meta.translation ? { translation: meta.translation } : {}),
          ...(meta.newWords ? { newWords: meta.newWords } : {}),
          ...(meta.correction !== undefined ? { correction: meta.correction } : {}),
        });
      }),
    };
  }
}
