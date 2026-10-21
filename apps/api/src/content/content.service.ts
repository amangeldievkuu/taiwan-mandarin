// The study path, dictionary and readers, from the generated content files (the same ones the web
// app serves). Words and readers are loaded at startup; dictionary shards on first use.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  dictShardOf,
  LEVEL_IDS,
  longestMatchAt,
  plainPinyin,
  segment,
  type ContentManifest,
  type DictEntry,
  type DictShard,
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
  private shards = new Map<number, DictShard>();

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
        for (const form of [
          w.hanzi,
          ...(w.variants ?? []).filter((v) => [...v].length === [...w.hanzi].length),
        ]) {
          this.byForm.set(form, [...(this.byForm.get(form) ?? []), w]);
        }
      }
    }
    this.readers = json<Reader[]>('readers.json');
    this.logger.log(
      `Content ${this.manifest.version}: ${this.words.size} words, ${this.readers.length} readers`,
    );
  }

  word(id: string): Word | undefined {
    return this.words.get(id);
  }

  /** Lowest-level path word written this way. */
  wordByForm(form: string): Word | undefined {
    return this.byForm.get(form)?.[0];
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

  private shard(index: number): DictShard {
    let shard = this.shards.get(index);
    if (!shard) {
      const file = join(this.dictDir, `${index}.json`);
      shard = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as DictShard) : {};
      this.shards.set(index, shard);
    }
    return shard;
  }

  lookup(headword: string): DictEntry[] {
    return headword ? (this.shard(dictShardOf(headword))[headword] ?? []) : [];
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

  /** Longest dictionary word starting at `index`. */
  lookupAt(text: string, index: number): { word: string; entries: DictEntry[] } {
    const shard = this.shard(dictShardOf(text.slice(index)));
    const word = longestMatchAt(text, index, {
      has: (w) => w in shard,
      maxLength: this.manifest?.dictMaxLength ?? 8,
    });
    return { word, entries: shard[word] ?? [] };
  }

  allReaders(): Reader[] {
    return this.readers;
  }

  reader(id: string): Reader | undefined {
    return this.readers.find((r) => r.id === id);
  }
}
