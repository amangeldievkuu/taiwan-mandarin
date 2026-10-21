// "Explain this sentence": a sign, menu or message (text or photo) → translation, a word-by-word
// breakdown, grammar and usage notes. The model does the reading and explaining; readings are then
// replaced by the study path's / dictionary's Taiwan readings where we have them, and tokens are
// linked to the path so the learner can add them with one tap.

import { Inject, Injectable } from '@nestjs/common';
import { splitSyllables, toZhuyin } from '@taiwan-mandarin/shared';
import type { ExplainRequest, ExplainResult, ExplainToken } from '@taiwan-mandarin/shared/api';
import { checkText } from '@taiwan-mandarin/shared/taiwan-standard';
import { z } from 'zod';
import { ContentService } from '../content/content.service.js';
import { LlmService, type LlmContent } from './llm.service.js';
import { PINYIN_FORMAT, TAIWAN_STYLE } from './taiwan-style.js';

const ExplainSchema = z.object({
  source: z.string().describe('The Chinese text being explained, exactly as written'),
  translation: z.string().describe('Natural English translation'),
  tokens: z
    .array(
      z.object({
        text: z.string(),
        pinyin: z.string().nullable(),
        gloss: z.string().nullable(),
        pos: z.string().nullable(),
        note: z.string().nullable(),
      }),
    )
    .describe('Words of the source in order; joined they reproduce the source exactly'),
  grammar: z.array(z.object({ pattern: z.string(), explanation: z.string() })),
  notes: z.array(z.string()),
});

const SYSTEM = `You are a Taiwan Mandarin (臺灣華語) tutor. A learner whose first language is English shows you real Chinese text from daily life in Taiwan: a sign, a menu, a notice, a LINE message, a receipt. Explain it so they understand it and learn from it.

${TAIWAN_STYLE}

What to return:
- source: the Chinese text exactly as written. For a photo, transcribe every piece of Chinese text in reading order, separated by spaces between separate lines or signs. Ignore text that is not Chinese unless it is part of the meaning.
- translation: natural English, as a Taiwanese friend would explain it.
- tokens: the source split into words, in order, covering all of it; concatenated they must equal the source exactly. Punctuation, spaces, Latin letters and digits are their own tokens with null pinyin and gloss. For each Chinese word give pinyin as ${PINYIN_FORMAT}, a short gloss for this context, the part of speech, and a note only when something is worth knowing (an abbreviation, a Taiwan-specific usage, a measure word).
- grammar: up to four patterns or constructions worth learning from this text, each with a one-sentence explanation. Empty if there is nothing notable.
- notes: up to four short notes: register and politeness, what kind of text it is, cultural context, and Taiwan-specific usage. If the text is in Simplified characters or uses Mainland wording, say so and give the Taiwan equivalent.`;

const HAN = /\p{Script=Han}/u;

@Injectable()
export class ExplainService {
  constructor(
    @Inject(LlmService) private readonly llm: LlmService,
    @Inject(ContentService) private readonly content: ContentService,
  ) {}

  async explain(request: ExplainRequest): Promise<ExplainResult> {
    const content: LlmContent[] = [];
    if (request.image) {
      content.push({ type: 'image', mediaType: request.image.mediaType, data: request.image.data });
    }
    content.push({
      type: 'text',
      text: request.text
        ? `Explain this text:\n\n${request.text}`
        : 'Explain the Chinese text in this photo.',
    });

    const answer = await this.llm.structured({
      schema: ExplainSchema,
      name: 'explanation',
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      effort: 'medium',
    });
    return this.enrich(answer);
  }

  /** Taiwan readings and path links from our own data; falls back to our segmentation if needed. */
  enrich(answer: z.infer<typeof ExplainSchema>): ExplainResult {
    const source = answer.source.trim();
    const joined = answer.tokens.map((t) => t.text).join('');
    const strip = (s: string) => s.replace(/\s+/g, '');
    const fromModel = new Map(answer.tokens.map((t) => [t.text, t]));
    const raw =
      strip(joined) === strip(source)
        ? answer.tokens
        : // The model's split doesn't match its own source: use ours, keeping its glosses where words agree.
          this.content.segment(source).map((t) => ({
            text: t.text,
            pinyin: fromModel.get(t.text)?.pinyin ?? null,
            gloss: fromModel.get(t.text)?.gloss ?? null,
            pos: fromModel.get(t.text)?.pos ?? null,
            note: fromModel.get(t.text)?.note ?? null,
          }));

    const tokens: ExplainToken[] = raw.map((t) => {
      if (!HAN.test(t.text)) return { text: t.text };
      const entries = this.content.lookup(t.text);
      const modelReading = validPinyin(t.text, t.pinyin) ? t.pinyin : undefined;
      // Our Taiwan reading with the same syllables as the model's in-context reading (行 háng in
      // 銀行); else our first reading; the model's only for words we don't have.
      const ours = [this.content.wordByForm(t.text)?.pinyin, ...entries.map((e) => e.p)].filter(
        (p): p is string => !!p,
      );
      // A model reading none of ours matches is usually the Mainland one (垃圾 lājī): ours wins.
      const pinyin =
        ours.find((p) => modelReading && toneless(p) === toneless(modelReading)) ??
        ours[0] ??
        modelReading ??
        charByChar(t.text, (c) => this.content.lookup(c)[0]?.p);
      const word = this.content.wordByForm(t.text, pinyin);
      const entry = entries.find((e) => e.p === pinyin) ?? entries[0];
      return {
        text: t.text,
        ...(pinyin ? { pinyin } : {}),
        gloss: t.gloss ?? word?.en ?? entry?.d.slice(0, 2).join('; '),
        ...(t.pos ? { pos: t.pos } : {}),
        ...(t.note ? { note: t.note } : {}),
        ...(word ? { wordId: word.id, level: word.level } : {}),
      };
    });

    const warnings = [
      ...answer.notes,
      ...answer.grammar.flatMap((g) => [g.pattern, g.explanation]),
      ...tokens.flatMap((t) => [t.gloss ?? '', t.note ?? '']),
    ].flatMap((text) =>
      checkText({ text, where: 'explain' }).map((i) => `${i.text}: ${i.problem}`),
    );

    return {
      source,
      translation: answer.translation,
      tokens,
      grammar: answer.grammar.slice(0, 4),
      notes: answer.notes.slice(0, 4),
      warnings,
    };
  }
}

const toneless = (pinyin: string) => pinyin.replace(/[1-5]/g, '');

function validPinyin(text: string, pinyin: string | null): pinyin is string {
  if (!pinyin) return false;
  try {
    toZhuyin(pinyin);
    return splitSyllables(pinyin).length === [...text].length;
  } catch {
    return false;
  }
}

function charByChar(text: string, reading: (c: string) => string | undefined): string | undefined {
  const syllables = [...text].map(reading);
  return syllables.every(Boolean) ? syllables.join(' ') : undefined;
}
