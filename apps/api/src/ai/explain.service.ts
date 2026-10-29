// "Explain this sentence": a sign, menu or message (text or photo) → translation, a word-by-word
// breakdown, grammar and usage notes. The model does the reading and explaining; readings are then
// replaced by the study path's / dictionary's Taiwan readings where we have them, and tokens are
// linked to the path so the learner can add them with one tap. The streamed version sends the
// translation and each word as soon as they arrive. Translation, glosses and notes come in the
// learner's language (English or Vietnamese).

import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { splitSyllables, toZhuyin, type Lang } from '@taiwan-mandarin/shared';
import type {
  ExplainRequest,
  ExplainResult,
  ExplainStreamEvent,
  ExplainToken,
} from '@taiwan-mandarin/shared/api';
import { checkText, taiwanReading, type Issue } from '@taiwan-mandarin/shared/taiwan-standard';
import { z } from 'zod';
import { ContentService } from '../content/content.service.js';
import { LlmService, type LlmContent, type StructuredRequest } from './llm.service.js';
import { EXACT_TEXT, PINYIN_FORMAT, TAIWAN_STYLE } from './taiwan-style.js';

// Keys in the order the answer streams: what the learner wants first comes first.
const Token = z.object({
  text: z.string().describe('One Chinese word, exactly as written in the text'),
  pinyin: z.string().nullable(),
  gloss: z.string().nullable(),
  note: z.string().nullable(),
});
type ModelToken = z.infer<typeof Token>;

const Body = {
  translation: z.string().describe("Natural translation in the learner's language"),
  tokens: z
    .array(Token)
    .describe('The Chinese words of the text in order; no punctuation, spaces, Latin or digits'),
  grammar: z.array(z.object({ pattern: z.string(), explanation: z.string() })),
  notes: z.array(z.string()),
};
/** Typed text: we already have the source. */
const TextAnswer = z.object(Body);
/** A photo: the model transcribes it first. */
const PhotoAnswer = z.object({
  source: z.string().describe('All Chinese text in the photo, exactly as printed'),
  ...Body,
});
type Answer = z.infer<typeof TextAnswer> & { source?: string };

/** The learner's language as the instructions name it. */
const LANGUAGE: Record<Lang, string> = { en: 'English', vi: 'Vietnamese' };

const system = (
  language: string,
) => `You are a Taiwan Mandarin (臺灣華語) tutor. A learner whose first language is ${language} shows you real Chinese text from daily life in Taiwan: a sign, a menu, a notice, a LINE message, a receipt. Explain it so they understand it and learn from it. Write everything that is not Chinese in ${language}.

${EXACT_TEXT}

For the Chinese you write yourself (grammar patterns, notes): ${TAIWAN_STYLE}

What to return:
- source (photos only): every piece of Chinese text in the photo in reading order, exactly as printed, with a space between separate lines or signs. Ignore text that is not Chinese unless it is part of the meaning.
- translation: natural ${language}, as a Taiwanese friend would explain it.
- tokens: the Chinese words of the text in order, each exactly as written; leave out punctuation, spaces, Latin letters and digits. For each word give pinyin as ${PINYIN_FORMAT} for its reading in this context, a short ${language} gloss for this context, and a note in ${language} only when something is worth knowing (an abbreviation, a Taiwan-specific usage, a measure word).
- grammar: up to four patterns or constructions worth learning from this text, each with a one-sentence explanation in ${language}. Empty if there is nothing notable.
- notes: up to four short notes in ${language}: register and politeness, what kind of text it is, cultural context, and Taiwan-specific usage. If the text is in Simplified characters or uses Mainland wording, say so and give the Taiwan form.`;

/** Built once per language and kept identical, so the provider can cache the prompt. */
const SYSTEM: Record<Lang, string> = { en: system(LANGUAGE.en), vi: system(LANGUAGE.vi) };

/** The Taiwan-standard warnings, in the learner's language. */
const WARNINGS: Record<
  Lang,
  {
    yours: string;
    form: (expected: string) => string;
    term: (term: string, taiwan: string) => string;
    cut: string;
  }
> = {
  en: {
    yours: 'Your text',
    form: (expected) => `Taiwan writes it “${expected}”`,
    term: (term, taiwan) => `Mainland word ${term}; Taiwan uses ${taiwan}`,
    cut: 'The answer was cut short; the last words come from the dictionary.',
  },
  vi: {
    yours: 'Văn bản của bạn',
    form: (expected) => `Đài Loan viết là “${expected}”`,
    term: (term, taiwan) => `Từ của Đại lục: ${term}; Đài Loan dùng ${taiwan}`,
    cut: 'Câu trả lời bị cắt ngắn; những từ cuối lấy từ từ điển.',
  },
};

const HAN = /\p{Script=Han}/u;
/** How far ahead a model word may be found before it counts as misplaced (characters). */
const MAX_SKIP = 8;

@Injectable()
export class ExplainService {
  constructor(
    @Inject(LlmService) private readonly llm: LlmService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  private request(
    request: ExplainRequest,
  ): StructuredRequest<typeof TextAnswer | typeof PhotoAnswer> {
    const content: LlmContent[] = [];
    if (request.image) {
      content.push({ type: 'image', mediaType: request.image.mediaType, data: request.image.data });
    }
    const text = request.text?.trim();
    content.push({
      type: 'text',
      text: text
        ? `${request.image ? 'Explain this text (the photo shows where it appears)' : 'Explain this text'}:\n\n${text}`
        : 'Explain the Chinese text in this photo.',
    });
    return {
      feature: 'explain',
      schema: text ? TextAnswer : PhotoAnswer,
      name: 'explanation',
      system: SYSTEM[request.lang],
      messages: [{ role: 'user', content }],
      cacheKey: `explain:${request.lang}`,
    };
  }

  async explain(request: ExplainRequest): Promise<ExplainResult> {
    const answer = (await this.llm.structured(this.request(request))) as Answer;
    return this.enrich(answer, request.text?.trim(), { lang: request.lang });
  }

  /** Source, translation and words as they arrive, then the finished result. */
  async *explainStream(
    request: ExplainRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<ExplainStreamEvent> {
    const typed = request.text?.trim();
    const lang = request.lang;
    let source = typed;
    if (typed) yield { type: 'source', text: typed };
    let translation = '';
    let sent = 0;
    for await (const event of this.llm.stream(this.request(request), signal)) {
      if (event.type === 'done') {
        yield { type: 'done', result: this.enrich(event.value as Answer, typed, { lang }) };
        return;
      }
      const partial = (event.value ?? {}) as Partial<Record<keyof Answer, unknown>>;
      if (event.type === 'incomplete') {
        // Cut off: keep what is complete, and let our dictionary cover the rest.
        const tokens = Array.isArray(partial.tokens) ? partial.tokens.slice(0, -1) : [];
        const answer: Answer = {
          source: typeof partial.source === 'string' ? partial.source : undefined,
          translation: typeof partial.translation === 'string' ? partial.translation : '',
          tokens: tokens.flatMap((t) => {
            const parsed = Token.safeParse(t);
            return parsed.success ? [parsed.data] : [];
          }),
          grammar: [],
          notes: [],
        };
        if (!answer.translation && !answer.tokens.length) {
          throw new BadGatewayException('The AI answer was cut off. Try again.');
        }
        yield { type: 'done', result: this.enrich(answer, typed, { cut: true, lang }) };
        return;
      }

      // A photo's source is complete once the model has moved on to the translation.
      if (!source && typeof partial.source === 'string' && partial.translation !== undefined) {
        source = partial.source.trim();
        yield { type: 'source', text: source };
      }
      if (typeof partial.translation === 'string' && partial.translation !== translation) {
        translation = partial.translation;
        yield { type: 'translation', text: translation };
      }
      // Every word but the last is complete, and the last one too once grammar has begun.
      const tokens = Array.isArray(partial.tokens) ? partial.tokens : [];
      const complete = partial.grammar !== undefined ? tokens.length : tokens.length - 1;
      for (; sent < complete; sent++) {
        const token = Token.safeParse(tokens[sent]);
        if (token.success && HAN.test(token.data.text)) {
          yield { type: 'token', index: sent, token: this.enrichToken(token.data, lang) };
        }
      }
    }
  }

  /** Taiwan readings and path links from our own data, over the whole source. */
  enrich(
    answer: Answer,
    typed?: string,
    options: { cut?: boolean; lang?: Lang } = {},
  ): ExplainResult {
    const lang = options.lang ?? 'en';
    const source = (typed ?? answer.source ?? answer.tokens.map((t) => t.text).join('')).trim();
    const tokens = this.align(source, answer.tokens).map((t) =>
      HAN.test(t.text) ? this.enrichToken(t, lang) : { text: t.text },
    );
    const grammar = answer.grammar.slice(0, 4);
    const notes = answer.notes.slice(0, 4);

    const say = WARNINGS[lang];
    const hint = (i: Issue) =>
      i.kind === 'form' && i.expected
        ? say.form(i.expected)
        : i.kind === 'term' && i.term && i.taiwan
          ? say.term(i.term, i.taiwan)
          : i.problem;
    const warnings = [
      // The learner's text: worth knowing when a sign or message isn't in Taiwan forms.
      ...checkText({ text: source, where: 'explain:source' }).map(
        (i) => `${say.yours}: ${hint(i)}`,
      ),
      // What the model wrote. Notes may quote Mainland words on purpose, so only their characters.
      ...[
        ...grammar.flatMap((g) => checkText({ text: g.pattern, where: 'explain:grammar' })),
        ...[...notes, ...tokens.map((t) => t.note ?? '')].flatMap((text) =>
          checkText({ text, where: 'explain:notes', mainland: true }),
        ),
      ].map((i) => `${i.text}: ${hint(i)}`),
    ];
    if (options.cut) warnings.push(say.cut);

    return {
      source,
      translation: answer.translation,
      tokens,
      grammar,
      notes,
      warnings: [...new Set(warnings)],
    };
  }

  /**
   * The model's words placed on the source in order. Whatever lies between them (punctuation,
   * words it skipped or changed) comes from our own segmentation, so the tokens always cover the
   * source exactly.
   */
  private align(source: string, model: readonly ModelToken[]): ModelToken[] {
    const byText = new Map(model.map((t) => [t.text, t]));
    const out: ModelToken[] = [];
    const fill = (gap: string) => {
      for (const t of this.content.segment(gap)) {
        out.push(byText.get(t.text) ?? { text: t.text, pinyin: null, gloss: null, note: null });
      }
    };
    let at = 0;
    for (const token of model) {
      if (!token.text) continue;
      const found = source.indexOf(token.text, at);
      if (found < 0) continue;
      const gap = source.slice(at, found);
      if ([...gap].filter((c) => HAN.test(c)).length > MAX_SKIP) continue;
      fill(gap);
      out.push(token);
      at = found + token.text.length;
    }
    fill(source.slice(at));
    return out;
  }

  private enrichToken(t: ModelToken, lang: Lang): ExplainToken {
    const entries = this.content.lookup(t.text);
    const modelReading = normalized(t.text, t.pinyin);
    const ours = [this.content.wordByForm(t.text)?.pinyin, ...entries.map((e) => e.p)].filter(
      (p): p is string => !!p,
    );
    // Our Taiwan reading the model used in context (行 háng in 銀行), else ours with the model's
    // syllables but other tones, else our first; the model's own only for words we don't have,
    // and then with Mainland character readings fixed (垃圾 lājī → lèsè).
    const pinyin =
      ours.find((p) => p === modelReading) ??
      ours.find((p) => modelReading && toneless(p) === toneless(modelReading)) ??
      ours[0] ??
      (modelReading && taiwanReading(t.text, modelReading)) ??
      charByChar(t.text, (c) => this.content.lookup(c)[0]?.p);
    const word = this.content.wordByForm(t.text, pinyin);
    const entry = entries.find((e) => e.p === pinyin) ?? entries[0];
    return {
      text: t.text,
      ...(pinyin ? { pinyin } : {}),
      gloss: t.gloss ?? this.content.gloss(t.text, lang, { word, pinyin: entry?.p }),
      ...(word?.pos ? { pos: word.pos } : {}),
      ...(t.note ? { note: t.note } : {}),
      ...(word ? { wordId: word.id, level: word.level } : {}),
    };
  }
}

const toneless = (pinyin: string) => pinyin.replace(/[1-5]/g, '');

/** The model's reading in our format, if it is valid pinyin with one syllable per character. */
function normalized(text: string, pinyin: string | null): string | undefined {
  if (!pinyin) return undefined;
  const reading = splitSyllables(pinyin.toLowerCase().replace(/v|u:/g, 'ü')).join(' ');
  try {
    toZhuyin(reading);
    return splitSyllables(reading).length === [...text].length ? reading : undefined;
  } catch {
    return undefined;
  }
}

function charByChar(text: string, reading: (c: string) => string | undefined): string | undefined {
  const syllables = [...text].map(reading);
  return syllables.every(Boolean) ? syllables.join(' ') : undefined;
}
