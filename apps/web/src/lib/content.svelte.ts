// Study-path words, dictionary and readers, loaded on demand from /content and /dict (built by
// packages/content), or in Vietnamese from /content/vi and /dict/vi, which are the same files with
// the Vietnamese added. The service worker caches every file after first use, so all of it works
// offline once seen.

import {
  dictShardOf,
  LEVEL_IDS,
  longestMatchAt,
  type ContentManifest,
  type DictEntry,
  type DictShard,
  type Lang,
  type Level,
  type Reader,
  type SearchRow,
  type Word,
} from '@taiwan-mandarin/shared';
import { indexRows, searchRows, type SearchIndex } from './search';

const base = import.meta.env.BASE_URL;

/**
 * Fetches a content file, versioned by its own hash when the manifest lists one, so a content
 * release leaves unchanged files in the offline cache. Older manifests version everything at once.
 */
async function getJson<T>(path: string, manifest?: ContentManifest): Promise<T> {
  const version = manifest && (manifest.files?.[path] ?? manifest.version);
  const response = await fetch(`${base}${path}${version ? `?v=${version}` : ''}`);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
}

/**
 * A content file in a language ("content/vi/words-N1.json"), when the build lists it; otherwise the
 * English one (content built before that language, or English itself), marked untranslated.
 */
export function localizedPath(
  path: string,
  lang: Lang,
  files: Record<string, string> | undefined,
): { path: string; translated: boolean } {
  if (lang === 'en') return { path, translated: true };
  const slash = path.indexOf('/');
  const own = `${path.slice(0, slash)}/${lang}${path.slice(slash)}`;
  return files?.[own] ? { path: own, translated: true } : { path, translated: false };
}

class Content {
  manifest = $state<ContentManifest | null>(null);
  /** Levels whose word file is loaded. */
  loaded = $state<Level[]>([]);
  /** Bumped whenever words are added, so derived lists recompute. */
  revision = $state(0);

  private words = new Map<string, Word>();
  private byLevel = new Map<Level, Word[]>();
  private pending = new Map<Level, Promise<void>>();
  private shards = new Map<number, Promise<DictShard>>();
  private readersPromise: Promise<Reader[]> | undefined;
  private readerList = $state.raw<Reader[] | null>(null);
  private searchPromise: Promise<SearchIndex> | undefined;
  private lang: Lang = 'en';
  /** Bumped by a language switch, so files still on their way in the old language are dropped. */
  private generation = 0;

  async init(): Promise<ContentManifest> {
    // Network-first in the service worker; every other file is versioned by a content hash.
    this.manifest ??= await getJson<ContentManifest>('content/manifest.json');
    return this.manifest;
  }

  private localized(path: string): { path: string; translated: boolean } {
    return localizedPath(path, this.lang, this.manifest?.files);
  }

  /**
   * Shows content in another language: the word lists already loaded are fetched again in it and
   * replace the old ones as they arrive (nothing goes blank meanwhile); readers, search and the
   * dictionary load afresh when next used.
   */
  setLanguage(lang: Lang): void {
    if (lang === this.lang) return;
    this.lang = lang;
    this.generation++;
    const levels = [...new Set([...this.loaded, ...this.pending.keys()])];
    this.pending.clear();
    this.shards.clear();
    this.readersPromise = undefined;
    this.readerList = null;
    this.searchPromise = undefined;
    void this.ensureLevels(levels);
  }

  word(id: string): Word | undefined {
    void this.revision;
    return this.words.get(id);
  }

  level(level: Level): Word[] {
    void this.revision;
    return this.byLevel.get(level) ?? [];
  }

  isLoaded(level: Level): boolean {
    return this.loaded.includes(level);
  }

  /**
   * Loads the levels' word files. One that fails (offline and never cached) is left out rather
   * than failing the rest; it is tried again next time.
   */
  async ensureLevels(levels: Iterable<Level>): Promise<void> {
    await Promise.allSettled([...new Set(levels)].map((l) => this.loadLevel(l)));
  }

  private loadLevel(level: Level): Promise<void> {
    let promise = this.pending.get(level);
    if (!promise) {
      const generation = this.generation;
      promise = (async () => {
        const manifest = await this.init();
        const info = manifest.levels.find((l) => l.id === level);
        if (!info) return;
        const list = await getJson<Word[]>(this.localized(`content/${info.file}`).path, manifest);
        if (generation !== this.generation) return; // the language changed meanwhile
        for (const w of list) this.words.set(w.id, w);
        this.byLevel.set(level, list);
        if (!this.loaded.includes(level)) this.loaded = [...this.loaded, level];
        this.revision++;
      })();
      promise.catch(() => this.pending.delete(level));
      this.pending.set(level, promise);
    }
    return promise;
  }

  /** Finds a word whose level is unknown, loading levels in path order until it turns up. */
  async findWord(id: string): Promise<Word | undefined> {
    for (const level of LEVEL_IDS) {
      const found = this.words.get(id);
      if (found) return found;
      await this.loadLevel(level);
    }
    return this.words.get(id);
  }

  private shard(index: number): Promise<DictShard> {
    let promise = this.shards.get(index);
    if (!promise) {
      promise = this.init().then(async (m) => {
        const { path, translated } = this.localized(`dict/${index}.json`);
        const shard = await getJson<DictShard>(path, m);
        // Another language without its own dictionary yet: these definitions are the English.
        if (!translated) for (const list of Object.values(shard)) for (const e of list) e.en = 1;
        return shard;
      });
      promise.catch(() => this.shards.delete(index));
      this.shards.set(index, promise);
    }
    return promise;
  }

  /** Dictionary entries for an exact headword. */
  async lookup(headword: string): Promise<DictEntry[]> {
    if (!headword) return [];
    const shard = await this.shard(dictShardOf(headword));
    return Object.hasOwn(shard, headword) ? (shard[headword] ?? []) : [];
  }

  /**
   * The longest dictionary word starting at `index` in `text` (e.g. where the learner tapped),
   * with its entries. Loads only the shard of the tapped character.
   */
  async lookupAt(text: string, index: number): Promise<{ word: string; entries: DictEntry[] }> {
    const manifest = await this.init();
    const shard = await this.shard(dictShardOf(text.slice(index)));
    const word = longestMatchAt(text, index, {
      has: (w) => Object.hasOwn(shard, w),
      maxLength: manifest.dictMaxLength,
    });
    return { word, entries: Object.hasOwn(shard, word) ? (shard[word] ?? []) : [] };
  }

  /**
   * Study-path words matching a query: characters (prefix first, then anywhere), toneless pinyin
   * ("jieyun", "jie yun"), or the meaning (see search.ts).
   */
  async search(query: string, limit = 40): Promise<SearchRow[]> {
    if (!query.trim()) return [];
    this.searchPromise ??= this.init().then(async (m) =>
      indexRows(await getJson<SearchRow[]>(this.localized('content/search.json').path, m)),
    );
    this.searchPromise.catch(() => (this.searchPromise = undefined));
    return searchRows(await this.searchPromise, query, limit);
  }

  readers(): Promise<Reader[]> {
    this.readersPromise ??= this.init().then((m) =>
      getJson<Reader[]>(this.localized('content/readers.json').path, m),
    );
    this.readersPromise.then(
      (list) => (this.readerList = list),
      () => (this.readersPromise = undefined),
    );
    return this.readersPromise;
  }

  /** A reader's title, once the readers have loaded (for back buttons). */
  readerTitle(id: string): string | undefined {
    return this.readerList?.find((r) => r.id === id)?.title;
  }
}

export const content = new Content();
