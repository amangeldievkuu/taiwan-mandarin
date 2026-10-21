<script lang="ts">
  import { plainPinyin, toToneMarked, zhuyinString } from '../lib/phonetics';
  import { store } from '../lib/store.svelte';
  import { TOPICS, VOCAB, type Word } from '../lib/vocab';
  import WordSheet from './WordSheet.svelte';

  interface Entry {
    word: Word;
    zhuyin: string;
    pinyin: string;
    haystack: string;
    pinyinKey: string;
  }

  const entries: Entry[] = VOCAB.map((word) => {
    const zhuyin = zhuyinString(word.pinyin);
    const pinyin = toToneMarked(word.pinyin);
    return {
      word,
      zhuyin,
      pinyin,
      haystack: [word.hanzi, zhuyin.replace(/\s/g, ''), pinyin, word.en, word.ky]
        .join('\n')
        .toLowerCase(),
      pinyinKey: plainPinyin(word.pinyin),
    };
  });

  let query = $state('');
  let selected = $state<Word | null>(null);

  const settings = $derived(store.settings);
  const sections = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const qPinyin = plainPinyin(q);
    // Plain text match (hanzi, zhuyin, meanings), or toneless pinyin: "xingqi", "xīng qí", "xing1"
    const matches = (e: Entry) =>
      !q ||
      e.haystack.includes(q) ||
      e.haystack.includes(q.replace(/\s/g, '')) ||
      (qPinyin !== '' && e.pinyinKey.includes(qPinyin));
    return TOPICS.map((topic) => ({
      topic,
      entries: entries.filter((e) => e.word.topic === topic.id && matches(e)),
    })).filter((s) => s.entries.length);
  });

  function phonetic(e: Entry): string {
    if (settings.phonetics === 'zhuyin') return e.zhuyin;
    if (settings.phonetics === 'pinyin') return e.pinyin;
    return `${e.zhuyin} · ${e.pinyin}`;
  }
</script>

<section class="screen">
  <h1 class="large-title"><span lang="zh-Hant-TW">詞彙</span><small>Words</small></h1>

  <div class="search">
    <label>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" />
      </svg>
      <span class="visually-hidden">Search words</span>
      <input
        type="search"
        placeholder="漢字, pinyin, meaning"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        bind:value={query}
      />
    </label>
  </div>

  {#each sections as { topic, entries } (topic.id)}
    <h2 class="group-header">
      <span lang="zh-Hant-TW">{topic.zh}</span> · {topic[settings.meaning]}
    </h2>
    <ul class="group">
      {#each entries as entry (entry.word.id)}
        <li class="row">
          <button type="button" class="word" onclick={() => (selected = entry.word)}>
            <span class="hanzi" lang="zh-Hant-TW">{entry.word.hanzi}</span>
            <span class="text">
              <span class="meaning">{entry.word[settings.meaning]}</span>
              <span class="phonetic" lang="zh-Hant-TW">{phonetic(entry)}</span>
            </span>
            {#if entry.word.tw}<span class="badge-tw">台灣</span>{/if}
            <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9.5 6l6 6-6 6" />
            </svg>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No words match “{query}”.</p>
  {/each}
</section>

<WordSheet word={selected} onclose={() => (selected = null)} />

<style>
  .search {
    position: sticky;
    top: 0;
    z-index: 5;
    margin: 0 -16px 20px;
    padding: 8px 16px;
    background: color-mix(in srgb, var(--grouped) 85%, transparent);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
  }

  .search label {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 10px;
    border-radius: 10px;
    background: var(--fill);
    color: var(--text-2);
  }

  .search svg {
    flex: none;
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    background: none;
    outline: none;
    font-size: 17px;
    color: var(--text);
  }

  input::placeholder {
    color: var(--text-2);
  }

  .row {
    padding: 0;
  }

  .word {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 60px;
    padding: 8px 12px 8px 16px;
    text-align: left;
    transition: background-color var(--dur) var(--ease);
  }

  .word:active {
    background: var(--fill);
  }

  .hanzi {
    flex: none;
    width: 4em;
    font-size: 24px;
    line-height: 1.2;
  }

  .text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .meaning,
  .phonetic {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .meaning {
    font-size: 16px;
  }

  .phonetic {
    font-size: 13px;
    color: var(--text-2);
  }

  .chevron {
    flex: none;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--text-3);
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .empty {
    padding: 40px 0;
    text-align: center;
    color: var(--text-2);
  }
</style>
