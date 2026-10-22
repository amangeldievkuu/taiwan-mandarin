<script lang="ts">
  import Loading from '../ui/Loading.svelte';
  import {
    LEVEL_IDS,
    LEVELS,
    pinyinWord,
    plainPinyin,
    TOPICS,
    type Level,
    type TopicId,
    type Word,
  } from '@taiwan-mandarin/shared';
  import Icon from '../ui/Icon.svelte';
  import Seal from '../ui/Seal.svelte';
  import WordDetail from '../ui/WordDetail.svelte';
  import { content } from '../lib/content.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { LEVEL_SEAL } from './Path.svelte';

  interface Props {
    level: string;
  }

  let { level: raw }: Props = $props();
  const level = $derived<Level>(LEVEL_IDS.includes(raw as Level) ? (raw as Level) : 'N1');
  const info = $derived(
    LEVELS[LEVEL_IDS.indexOf(level)] ?? { id: level, zh: '', en: level, cefr: '' },
  );

  let loading = $state(true);
  let failed = $state(false);
  $effect(() => {
    const id = level;
    loading = true;
    void content.ensureLevels([id]).then(() => {
      loading = false;
      failed = !content.isLoaded(id);
    });
  });

  type Status = 'all' | 'new' | 'studying' | 'deck';
  let query = $state('');
  let topic = $state<TopicId | 'all'>('all');
  let status = $state<Status>('all');
  let limit = $state(150);

  const words = $derived(content.level(level));
  const topicsHere = $derived(TOPICS.filter((t) => words.some((w) => w.topic === t.id)));

  function matches(w: Word, q: string, plain: string): boolean {
    if (!q) return true;
    if (w.hanzi.includes(q) || w.variants?.some((v) => v.includes(q))) return true;
    if (plain && plainPinyin(w.pinyin).startsWith(plain)) return true;
    return w.en.toLowerCase().includes(q.toLowerCase());
  }

  const filtered = $derived.by(() => {
    const q = query.trim();
    const plain = /[a-z]/i.test(q) ? plainPinyin(q) : '';
    return words.filter((w) => {
      if (topic !== 'all' && w.topic !== topic) return false;
      if (status === 'new' && (store.cards[w.id] || store.inDeck(w.id))) return false;
      if (status === 'studying' && !store.cards[w.id]) return false;
      if (status === 'deck' && !store.inDeck(w.id)) return false;
      return matches(w, q, plain);
    });
  });
  const shown = $derived(filtered.slice(0, limit));

  // Wide screens show the selected word beside the list.
  let wide = $state(false);
  $effect(() => {
    const media = matchMedia('(min-width: 900px)');
    const update = () => (wide = media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
  let selected = $state<string | null>(null);
  const selectedWord = $derived(selected ? content.word(selected) : shown[0]);

  function open(w: Word, e: MouseEvent) {
    if (wide) {
      e.preventDefault();
      selected = w.id;
    } else router.link(e);
  }

  function addAllShown() {
    for (const w of filtered.slice(0, 50)) if (!store.cards[w.id]) store.addToDeck(w);
  }

  let sentinel = $state<HTMLElement>();
  $effect(() => {
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) limit += 150;
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  const pinyinLine = (w: Word) => pinyinWord(w.pinyin);
</script>

<div class="page wide">
  <header class="page-head">
    <div class="head">
      <a class="back" href={router.href('/path')} onclick={router.link} aria-label="Back to path"
        ><Icon name="back" /></a
      >
      <Seal text={LEVEL_SEAL[level]} size={48} />
      <div>
        <p class="eyebrow">{info.cefr} · <span lang="zh-Hant-TW">{info.zh}</span></p>
        <h1 class="title">{info.en}</h1>
      </div>
    </div>
    <button
      type="button"
      class="btn small {store.settings.levels.includes(level) ? 'seal' : 'quiet'}"
      onclick={() => {
        const on = store.settings.levels.includes(level);
        const next = on
          ? store.settings.levels.filter((l) => l !== level)
          : [...store.settings.levels, level];
        if (next.length) void store.updateSettings({ levels: next });
      }}
    >
      {store.settings.levels.includes(level) ? 'Studying' : 'Study this level'}
    </button>
  </header>

  <div class="tools">
    <label class="search">
      <Icon name="search" />
      <span class="visually-hidden">Search this level</span>
      <input
        type="search"
        placeholder="字, pinyin or English"
        bind:value={query}
        oninput={() => (limit = 150)}
      />
    </label>
    <div class="chips" role="group" aria-label="Show">
      {#each [['all', 'All'], ['new', 'Not started'], ['studying', 'Studying'], ['deck', 'My deck']] as [value, label] (value)}
        <button
          type="button"
          class="chip"
          aria-pressed={status === value}
          onclick={() => (status = value as Status)}>{label}</button
        >
      {/each}
    </div>
    {#if topicsHere.length > 1}
      <div class="chips topics" role="group" aria-label="Topic">
        <button
          type="button"
          class="chip"
          aria-pressed={topic === 'all'}
          onclick={() => (topic = 'all')}>All topics</button
        >
        {#each topicsHere as t (t.id)}
          <button
            type="button"
            class="chip"
            aria-pressed={topic === t.id}
            onclick={() => (topic = t.id)}
          >
            <span lang="zh-Hant-TW" class="hanzi">{t.zh.split('、')[0]}</span>
            {t.en}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="split" class:with-detail={wide}>
    <div class="list-col">
      <div class="count">
        <span class="tabular">{filtered.length.toLocaleString()} words</span>
        {#if status === 'new' && filtered.length}
          <button type="button" class="link" onclick={addAllShown}>Add first 50 to my deck</button>
        {/if}
      </div>
      {#if loading && words.length === 0}
        <Loading />
      {:else if failed && words.length === 0}
        <p class="empty" role="alert">Couldn't load this. Check your connection and try again.</p>
      {:else if filtered.length === 0}
        <p class="empty"><span class="hanzi" lang="zh-Hant-TW">無</span>No words match.</p>
      {:else}
        <ul class="list words">
          {#each shown as w (w.id)}
            {@const card = store.cards[w.id]}
            <li>
              <a
                class="row"
                class:selected={wide && selectedWord?.id === w.id}
                href={router.href(`/word/${encodeURIComponent(w.id)}`)}
                onclick={(e) => open(w, e)}
              >
                <span class="w-hanzi hanzi" lang="zh-Hant-TW">{w.hanzi}</span>
                <span class="row-main">
                  <span class="w-pinyin">{pinyinLine(w)}</span>
                  <span class="row-sub">{w.en}</span>
                </span>
                {#if card}
                  <span
                    class="dot"
                    class:mature={card.card.stability >= 21}
                    title={card.card.stability >= 21 ? 'Well remembered' : 'Studying'}
                  ></span>
                {:else if store.inDeck(w.id)}
                  <span class="dot deck" title="In your deck"></span>
                {/if}
                {#if w.src === 'tbcl'}<span class="src" title="From the NAER list">NAER</span>{/if}
              </a>
            </li>
          {/each}
        </ul>
        {#if shown.length < filtered.length}<div bind:this={sentinel} class="sentinel"></div>{/if}
      {/if}
    </div>
    {#if wide && selectedWord}
      <aside class="detail-col sheet">
        {#key selectedWord.id}
          <WordDetail word={selectedWord} compact />
        {/key}
      </aside>
    {/if}
  </div>
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .back {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-left: -8px;
    border-radius: 50%;
    color: var(--ink-2);
  }

  .tools {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  .chips {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    scrollbar-width: none;
    padding-bottom: 2px;
  }

  .chips .hanzi {
    font-size: 15px;
  }

  .split {
    display: block;
  }

  .split.with-detail {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    gap: 20px;
    align-items: start;
  }

  .detail-col {
    position: sticky;
    top: 20px;
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    padding: 24px;
  }

  .count {
    display: flex;
    justify-content: space-between;
    margin: 0 4px 8px;
    font-size: 13px;
    color: var(--ink-2);
  }

  .link {
    color: var(--seal);
    font-weight: 600;
  }

  .words .row {
    min-height: 60px;
  }

  .row.selected {
    background: var(--seal-wash);
  }

  .w-hanzi {
    min-width: 2.6em;
    font-size: 24px;
    line-height: 1.2;
  }

  .w-pinyin {
    font-size: 14px;
    color: var(--ink-2);
  }

  .row-sub {
    color: var(--ink) !important;
    font-size: 15px !important;
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: 50%;
    background: color-mix(in srgb, var(--jade) 45%, transparent);
  }

  .dot.mature {
    background: var(--jade);
  }

  .dot.deck {
    background: transparent;
    box-shadow: inset 0 0 0 2px var(--seal);
  }

  .src {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--ink-3);
  }

  .sentinel {
    height: 40px;
  }
</style>
