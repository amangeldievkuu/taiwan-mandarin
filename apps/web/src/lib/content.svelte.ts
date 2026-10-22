// Study-path words, dictionary and readers, loaded on demand from /content and /dict (built by
// packages/content). The service worker caches every file after first use, so all of it works
// offline once seen.

import {
  dictShardOf,
  LEVEL_IDS,
  longestMatchAt,
  type ContentManifest,
  type DictEntry,
  type DictShard,
  type Level,
  plainPinyin,
  type Reader,
  type SearchRow,
  type Word,
} from '@taiwan-mandarin/shared';

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
  private searchPromise: Promise<SearchRow[]> | undefined;

  async init(): Promise<ContentManifest> {
    // Network-first in the service worker; every other file is versioned by a content hash.
    this.manifest ??= await getJson<ContentManifest>('content/manifest.json');
    return this.manifest;
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
      promise = (async () => {
        const manifest = await this.init();
        const info = manifest.levels.find((l) => l.id === level);
        if (!info) return;
        const list = await getJson<Word[]>(`content/${info.file}`, manifest);
        for (const w of list) this.words.set(w.id, w);
        this.byLevel.set(level, list);
        this.loaded = [...this.loaded, level];
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
      promise = this.init().then((m) => getJson<DictShard>(`dict/${index}.json`, m));
      promise.catch(() => this.shards.delete(index));
      this.shards.set(index, promise);
    }
    return promise;
  }

  /** Dictionary entries for an exact headword. */
  async lookup(headword: string): Promise<DictEntry[]> {
    if (!headword) return [];
    const shard = await this.shard(dictShardOf(headword));
    return shard[headword] ?? [];
  }

  /**
   * The longest dictionary word starting at `index` in `text` (e.g. where the learner tapped),
   * with its entries. Loads only the shard of the tapped character.
   */
  async lookupAt(text: string, index: number): Promise<{ word: string; entries: DictEntry[] }> {
    const manifest = await this.init();
    const shard = await this.shard(dictShardOf(text.slice(index)));
    const word = longestMatchAt(text, index, {
      has: (w) => w in shard,
      maxLength: manifest.dictMaxLength,
    });
    return { word, entries: shard[word] ?? [] };
  }

  /**
   * Study-path words matching a query: characters (prefix first, then anywhere), toneless pinyin
   * ("jieyun", "jie yun"), or English.
   */
  async search(query: string, limit = 40): Promise<SearchRow[]> {
    const q = query.trim();
    if (!q) return [];
    this.searchPromise ??= this.init().then((m) => getJson<SearchRow[]>('content/search.json', m));
    this.searchPromise.catch(() => (this.searchPromise = undefined));
    const rows = await this.searchPromise;
    const scored: [number, SearchRow][] = [];
    if (/\p{Script=Han}/u.test(q)) {
      for (const row of rows) {
        const at = row[1].indexOf(q);
        if (at >= 0)
          scored.push([(row[1] === q ? 0 : at === 0 ? 1 : 2) * 100 + row[1].length, row]);
      }
    } else {
      const plain = plainPinyin(q);
      const english = q.toLowerCase();
      const wordRe = new RegExp(
        `(^|[^a-z])${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`,
      );
      for (const row of rows) {
        if (plain && row[2] === plain) scored.push([0, row]);
        else if (plain && row[2].startsWith(plain)) scored.push([1 + row[2].length / 100, row]);
        else if (wordRe.test(row[3].toLowerCase()))
          scored.push([2 + row[3].indexOf(english) / 1000, row]);
      }
    }
    // Stable: ties keep path order (easier levels first).
    return scored
      .sort((a, b) => a[0] - b[0])
      .slice(0, limit)
      .map(([, row]) => row);
  }

  readers(): Promise<Reader[]> {
    this.readersPromise ??= this.init().then((m) => getJson<Reader[]>('content/readers.json', m));
    this.readersPromise.catch(() => (this.readersPromise = undefined));
    return this.readersPromise;
  }
}

export const content = new Content();
