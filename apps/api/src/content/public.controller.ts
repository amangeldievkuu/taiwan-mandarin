// Public, read-only content API: the TOCFL path, the dictionary, segmentation and readers.
// No account needed; rate-limited.

import { Controller, Get, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { LEVELS, type Level } from '@taiwan-mandarin/shared';
import { LevelSchema } from '@taiwan-mandarin/shared/api';
import { z } from 'zod';
import { ApiZodBody, ZodBody, ZodPipe } from '../common/zod.js';
import { ContentService } from './content.service.js';

const SegmentSchema = z.object({ text: z.string().min(1).max(2000) });
const PageSchema = z.coerce.number().int().min(0);

@ApiTags('content (public)')
@Controller('v1')
export class PublicController {
  constructor(@Inject(ContentService) private readonly content: ContentService) {}

  @Get('levels')
  @ApiOperation({ summary: 'TOCFL levels with CEFR equivalents and word counts' })
  levels() {
    return LEVELS.map((l) => ({ ...l, ...this.content.levels().find((m) => m.id === l.id) }));
  }

  @Get('words')
  @ApiOperation({ summary: 'Study-path words, by level and/or search query' })
  @ApiQuery({ name: 'level', required: false, enum: LEVELS.map((l) => l.id) })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Characters, toneless pinyin ("jieyun") or English',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  words(
    @Query('level', new ZodPipe(LevelSchema.optional())) level?: string,
    @Query('q') q?: string,
    @Query('limit', new ZodPipe(PageSchema.max(500).default(50))) limit = 50,
    @Query('offset', new ZodPipe(PageSchema.default(0))) offset = 0,
  ) {
    return this.content.searchWords({ level: level as Level | undefined, q, limit, offset });
  }

  @Get('words/:id')
  @ApiOperation({ summary: 'One word with readings, gloss, examples and notes' })
  word(@Param('id') id: string) {
    const word = this.content.word(id);
    if (!word) throw new NotFoundException('No such word');
    return word;
  }

  @Get('dict/:query')
  @ApiOperation({ summary: 'Dictionary entries (CC-CEDICT, Taiwan readings) for a headword' })
  dict(@Param('query') query: string) {
    return { query, entries: this.content.lookup(query) };
  }

  @Post('segment')
  @ApiOperation({
    summary: 'Split Chinese text into words, with readings, glosses and TOCFL levels',
  })
  @ApiZodBody(SegmentSchema)
  segment(@ZodBody(SegmentSchema) body: z.infer<typeof SegmentSchema>) {
    return {
      tokens: this.content.segment(body.text).map((t) => ({
        text: t.text,
        han: t.han,
        pinyin: t.word?.pinyin ?? t.entry?.p,
        gloss: t.word?.en ?? t.entry?.d.slice(0, 3).join('; '),
        wordId: t.word?.id,
        level: t.word?.level,
      })),
    };
  }

  @Get('readers')
  @ApiOperation({ summary: 'Graded readers (summaries)' })
  readers() {
    return this.content.allReaders().map((r) => ({
      id: r.id,
      level: r.level,
      topic: r.topic,
      title: r.title,
      titleEn: r.titleEn,
      summary: r.summary,
      wordCount: r.wordCount,
      charCount: r.charCount,
      draft: r.draft ?? false,
    }));
  }

  @Get('readers/:id')
  @ApiOperation({ summary: 'A graded reader with tokens, readings and translation' })
  reader(@Param('id') id: string) {
    const reader = this.content.reader(id);
    if (!reader) throw new NotFoundException('No such reader');
    return reader;
  }
}
