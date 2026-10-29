// The study path, dictionary and readers, from the generated content files (the same ones the web
// app serves). Words and readers are loaded at startup; dictionary shards on first use. Each other
// language's files give the AI features their glosses in it.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  dictShardOf,
  LEVEL_IDS,
  longestMatchAt,
  plainPinyin,
  segment,
  splitSyllables,
  type ContentManifest,
  type DictEntry,
  type DictShard,
  type ForeignLang,
  type Lang,
  type Level,
  type Reader,
  type Token,
  type Word,
} from '@taiwan-mandarin/shared';
import { ENV, type Env } from '../config/env.js';

const WEB_PUBLIC = resolve(import.meta.dirname, '../../../web/public');

@Injectable()
export class ContentService implements OnModuleInit {
  private readonly logger = new Logger(ContentService.name);
  private readonly contentDir: string;
  private readonly dictDir: string;
  manifest: ContentManifest | null = null;
  private words = new Map<string, Word>();
  private byLevel = new Map<Level, Word[]>();
  /** Every written form (headword and same-length variants) → words, lowest level first. */
  private byForm = new Map<string, Word[]>();
  private readers: Reader[] = [];
  /** Shards by language and number ("vi:3"). */
  private shards = new Map<string, DictShard>();
  /** Each other language's meanings by word id, when the content has them. */
  private glosses = new Map<ForeignLang, Map<string, string>>();

  constructor(@Inject(ENV) env: Env) {
    this.contentDir = env.CONTENT_DIR ?? join(WEB_PUBLIC, 'content');
    this.dictDir = env.DICT_DIR ?? join(WEB_PUBLIC, 'dict');
  }

  onModuleInit(): void {
    const manifestPath = join(this.contentDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      this.logger.warn(
        `No content at ${this.contentDir}: run "npm run content". Word endpoints return nothing.`,
      );
      return;
    }
    const json = <T>(file: string) =>
      JSON.parse(readFileSync(join(this.contentDir, file), 'utf8')) as T;
    this.manifest = json<ContentManifest>('manifest.json');
    for (const level of this.manifest.levels) {
      const list = json<Word[]>(level.file);
      this.byLevel.set(level.id, list);
      for (const w of list) {
        this.words.set(w.id, w);
        const forms = [
          w.hanzi,
          ...(w.variants ?? []).filter((v) => [...v].length === [...w.hanzi].length),
        ];
        // 台 is the everyday way to write 臺 (台北), so it finds the word too.
        for (const form of new Set([...forms, ...forms.map((f) => f.replaceAll('臺', '台'))])) {
          const listed = this.byForm.get(form) ?? [];
          if (!listed.includes(w)) this.byForm.set(form, [...listed, w]);
        }
      }
    }
    this.readers = json<Reader[]>('readers.json');
    for (const lang of this.manifest.languages ?? []) {
      if (lang === 'en') continue;
      const meanings = new Map<string, string>();
      for (const level of this.manifest.levels)
        for (const w of json<Word[]>(join(lang, level.file))) {
          const meaning = w[lang];
          if (meaning) meanings.set(w.id, meaning);
        }
      this.glosses.set(lang, meanings);
    }
    this.logger.log(
      `Content ${this.manifest.version}: ${this.words.size} words, ${this.readers.length} readers`,
    );
  }

  word(id: string): Word | undefined {
    return this.words.get(id);
  }

  /** Lowest-level path word written this way; with `pinyin`, the one read that way. */
  wordByForm(form: string, pinyin?: string): Word | undefined {
    const words = this.byForm.get(form) ?? [];
    return pinyin ? words.find((w) => w.pinyin === pinyin) : words[0];
  }

  levels() {
    return this.manifest?.levels ?? [];
  }

  /** Path words, optionally by level and matching a query (characters, toneless pinyin or English). */
  searchWords(options: { level?: Level; q?: string; limit: number; offset: number }): {
    total: number;
    items: Word[];
  } {
    const pool = options.level
      ? (this.byLevel.get(options.level) ?? [])
      : LEVEL_IDS.flatMap((l) => this.byLevel.get(l) ?? []);
    const q = options.q?.trim();
    let items = pool;
    if (q) {
      const han = /\p{Script=Han}/u.test(q);
      const plain = plainPinyin(q);
      const english = q.toLowerCase();
      items = pool.filter((w) =>
        han
          ? w.hanzi.includes(q) || w.variants?.some((v) => v.includes(q))
          : (plain && plainPinyin(w.pinyin).startsWith(plain)) ||
            w.en.toLowerCase().includes(english),
      );
    }
    return {
      total: items.length,
      items: items.slice(options.offset, options.offset + options.limit),
    };
  }

  private shard(index: number, lang: Lang = 'en'): DictShard {
    const own = lang !== 'en' && this.manifest?.languages?.includes(lang);
    const key = `${own ? lang : 'en'}:${index}`;
    let shard = this.shards.get(key);
    if (!shard) {
      const file = join(this.dictDir, own ? lang : '', `${index}.json`);
      shard = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as DictShard) : {};
      this.shards.set(key, shard);
    }
    return shard;
  }

  lookup(headword: string): DictEntry[] {
    return headword ? entriesIn(this.shard(dictShardOf(headword)), headword) : [];
  }

  /**
   * A short gloss in the learner's language: the study word's meaning, else the dictionary's first
   * definitions (for `pinyin` when given). English when there is none in the learner's language.
   */
  gloss(
    text: string,
    lang: Lang,
    found: { word?: Word; pinyin?: string } = {},
  ): string | undefined {
    if (lang !== 'en') {
      const meaning = found.word && this.glosses.get(lang)?.get(found.word.id);
      if (meaning) return meaning;
      const entries = entriesIn(this.shard(dictShardOf(text), lang), text).filter((e) => !e.en);
      const entry = entries.find((e) => e.p === found.pinyin) ?? entries[0];
      if (entry) return entry.d.slice(0, 2).join('; ');
    }
    if (found.word) return found.word.en;
    const entries = this.lookup(text);
    const entry = entries.find((e) => e.p === found.pinyin) ?? entries[0];
    return entry?.d.slice(0, 2).join('; ');
  }

  /** Splits Chinese text into dictionary words. */
  segment(text: string): (Token & { entry?: DictEntry; word?: Word })[] {
    const maxLength = this.manifest?.dictMaxLength ?? 8;
    return segment(text, {
      has: (w) => this.byForm.has(w) || this.lookup(w).length > 0,
      maxLength,
      weight: (w) => (this.byForm.has(w) ? 2 : 1),
    }).map((token) =>
      token.han
        ? { ...token, entry: this.lookup(token.text)[0], word: this.wordByForm(token.text) }
        : token,
    );
  }

  /**
   * Numbered pinyin for the Chinese characters of `text`, one syllable each, with each word's
   * length so the app can space the reading by word. Study-path readings first, then the
   * dictionary, then character by character; undefined when a character has no reading at all.
   */
  reading(text: string): { pinyin: string; wordLengths: number[] } | undefined {
    const syllables: string[] = [];
    const wordLengths: number[] = [];
    for (const token of this.segment(text)) {
      if (!token.han) continue;
      const chars = [...token.text];
      const whole = splitSyllables(token.word?.pinyin ?? token.entry?.p ?? '');
      if (whole.length === chars.length) syllables.push(...whole);
      else
        for (const char of chars) {
          const one = splitSyllables(
            this.wordByForm(char)?.pinyin ?? this.lookup(char)[0]?.p ?? '',
          );
          const [syllable] = one;
          if (one.length !== 1 || !syllable) return undefined;
          syllables.push(syllable);
        }
      wordLengths.push(chars.length);
    }
    return syllables.length ? { pinyin: syllables.join(' '), wordLengths } : undefined;
  }

  /** Longest dictionary word starting at `index`. */
  lookupAt(text: string, index: number): { word: string; entries: DictEntry[] } {
    const shard = this.shard(dictShardOf(text.slice(index)));
    const word = longestMatchAt(text, index, {
      has: (w) => Object.hasOwn(shard, w),
      maxLength: this.manifest?.dictMaxLength ?? 8,
    });
    return { word, entries: entriesIn(shard, word) };
  }

  allReaders(): Reader[] {
    return this.readers;
  }

  reader(id: string): Reader | undefined {
    return this.readers.find((r) => r.id === id);
  }
}

/** A shard's entries for `word`; never Object.prototype members ("constructor", "toString"). */
const entriesIn = (shard: DictShard, word: string): DictEntry[] =>
  Object.hasOwn(shard, word) ? (shard[word] ?? []) : [];
