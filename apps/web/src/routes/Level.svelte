<script lang="ts">
  import { tick, untrack } from 'svelte';
  import Loading from '../ui/Loading.svelte';
  import {
    foldLatin,
    LEVEL_IDS,
    LEVELS,
    looksVietnamese,
    pinyinWord,
    plainPinyin,
    TOPICS,
    type Level,
    type TopicId,
    type Word,
  } from '@taiwan-mandarin/shared';
  import BackButton from '../ui/BackButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Seal from '../ui/Seal.svelte';
  import Localized from '../ui/Localized.svelte';
  import WordDetail from '../ui/WordDetail.svelte';
  import { content } from '../lib/content.svelte';
  import { glossOf } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { LEVEL_SEAL } from './Path.svelte';

  interface Props {
    level: string;
  }

  let { level: raw }: Props = $props();
  const level = $derived<Level>(LEVEL_IDS.includes(raw as Level) ? (raw as Level) : 'N1');
  const info = $derived(LEVELS[LEVEL_IDS.indexOf(level)] ?? { id: level, zh: '', cefr: '' });

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

  /** Characters, toneless pinyin, or the meaning (accents optional: "hoc" finds "học"). */
  function matches(w: Word, q: string, plain: string): boolean {
    if (!q) return true;
    if (w.hanzi.includes(q) || w.variants?.some((v) => v.includes(q))) return true;
    if (plain && plainPinyin(w.pinyin).startsWith(plain)) return true;
    return foldLatin(glossOf(w).text).includes(foldLatin(q));
  }

  const filtered = $derived.by(() => {
    const q = query.trim();
    // Vietnamese ("bạn") is never pinyin, though without its marks it would read as some.
    const plain = /[a-z]/i.test(q) && !looksVietnamese(q) ? plainPinyin(q) : '';
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

  /** The word just looked at, when we came back from its page: marked in the list. */
  const seen = untrack(() =>
    router.from?.name === 'word' ? (router.from.params['id'] ?? null) : null,
  );

  // Back from a word: make sure its row is rendered and on screen (once the browser has put the
  // scroll back where it was, so a row already in view doesn't move).
  let seenShown = false;
  $effect(() => {
    if (!seen || seenShown || loading || wide) return;
    seenShown = true;
    const at = untrack(() => filtered.findIndex((w) => w.id === seen));
    if (at < 0) return;
    if (at >= untrack(() => limit)) limit = at + 50;
    void tick().then(() =>
      requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(`.row[data-id="${CSS.escape(seen)}"]`);
        if (!row) return;
        const box = row.getBoundingClientRect();
        const tabbar = parseFloat(getComputedStyle(row).getPropertyValue('--tabbar-h')) || 0;
        if (box.top < 0 || box.bottom > innerHeight - tabbar)
          row.scrollIntoView({ block: 'center' });
      }),
    );
  });

  const pinyinLine = (w: Word) => pinyinWord(w.pinyin);

  // Moving between levels replaces this page in history, so back still returns to where the
  // learner came from (Today, the path, a word) rather than through every level they looked at.
  const index = $derived(LEVEL_IDS.indexOf(level));
  const prevLevel = $derived(index > 0 ? LEVELS[index - 1] : undefined);
  const nextLevel = $derived(index < LEVELS.length - 1 ? LEVELS[index + 1] : undefined);

  function switchTo(event: MouseEvent, id: Level) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    if (id === level) return;
    router.go(`/path/${id}`, { replace: true, animate: true, scrollTop: true });
  }

  // The current level in view: centred in the strip, but only when it would be cut off.
  let strip = $state<HTMLElement>();
  $effect(() => {
    const el = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !el) return;
    const box = strip.getBoundingClientRect();
    const chip = el.getBoundingClientRect();
    if (chip.left >= box.left && chip.right <= box.right) return;
    strip.scrollLeft += chip.left - box.left - (box.width - chip.width) / 2;
  });
</script>

<div class="page wide">
  <BackButton parent="/path" />
  <header class="page-head">
    <div class="head">
      <Seal text={LEVEL_SEAL[level]} size={48} />
      <div>
        <p class="eyebrow">{info.cefr} · <span lang="zh-Hant-TW">{info.zh}</span></p>
        <h1 class="title">{t().levels[level]}</h1>
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
      {store.settings.levels.includes(level) ? t().word.studying : t().level.study}
    </button>
  </header>

  <nav class="levels" aria-label={t().level.levels} bind:this={strip}>
    <a class="lv all" href={router.href('/path')} onclick={router.link}>
      <Icon name="path" size={18} />
      <span>{t().today.allLevels}</span>
    </a>
    {#each LEVELS as l (l.id)}
      {@const studying = store.settings.levels.includes(l.id)}
      <a
        class="lv"
        class:current={l.id === level}
        aria-current={l.id === level ? 'page' : undefined}
        href={router.href(`/path/${l.id}`)}
        onclick={(e) => switchTo(e, l.id)}
      >
        <Seal text={LEVEL_SEAL[l.id]} size={26} outline={!studying} />
        <span>{t().levels[l.id]}</span>
      </a>
    {/each}
  </nav>

  <div class="tools">
    <label class="search">
      <Icon name="search" />
      <span class="visually-hidden">{t().level.search}</span>
      <input
        type="search"
        placeholder={t().level.placeholder}
        bind:value={query}
        oninput={() => (limit = 150)}
      />
    </label>
    <div class="chips" role="group" aria-label={t().level.show}>
      {#each [['all', t().level.all], ['new', t().level.notStarted], ['studying', t().word.studying], ['deck', t().level.deck]] as [value, label] (value)}
        <button
          type="button"
          class="chip"
          aria-pressed={status === value}
          onclick={() => (status = value as Status)}>{label}</button
        >
      {/each}
    </div>
    {#if topicsHere.length > 1}
      <div class="chips topics" role="group" aria-label={t().level.topic}>
        <button
          type="button"
          class="chip"
          aria-pressed={topic === 'all'}
          onclick={() => (topic = 'all')}>{t().level.allTopics}</button
        >
        {#each topicsHere as each (each.id)}
          <button
            type="button"
            class="chip"
            aria-pressed={topic === each.id}
            onclick={() => (topic = each.id)}
          >
            <span lang="zh-Hant-TW" class="hanzi">{each.zh.split('、')[0]}</span>
            {t().topics[each.id]}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="split" class:with-detail={wide}>
    <div class="list-col">
      <div class="count">
        <span class="tabular">{t().level.count(filtered.length)}</span>
        {#if status === 'new' && filtered.length}
          <button type="button" class="link" onclick={addAllShown}>{t().level.addFirst}</button>
        {/if}
      </div>
      {#if loading && words.length === 0}
        <Loading />
      {:else if failed && words.length === 0}
        <p class="empty" role="alert">{t().level.loadFailed}</p>
      {:else if filtered.length === 0}
        <p class="empty"><span class="hanzi" lang="zh-Hant-TW">無</span>{t().level.noMatch}</p>
      {:else}
        <ul class="list words">
          {#each shown as w (w.id)}
            {@const card = store.cards[w.id]}
            <li>
              <a
                class="row"
                class:selected={wide && selectedWord?.id === w.id}
                class:seen={!wide && w.id === seen}
                data-id={w.id}
                href={router.href(`/word/${encodeURIComponent(w.id)}`)}
                onclick={(e) => open(w, e)}
              >
                <span class="w-hanzi hanzi" lang="zh-Hant-TW">{w.hanzi}</span>
                <span class="row-main">
                  <span class="w-pinyin">{pinyinLine(w)}</span>
                  <span class="row-sub"><Localized value={glossOf(w)} /></span>
                </span>
                {#if card}
                  <span
                    class="dot"
                    class:mature={card.card.stability >= 21}
                    title={card.card.stability >= 21 ? t().level.wellRemembered : t().word.studying}
                  ></span>
                {:else if store.inDeck(w.id)}
                  <span class="dot deck" title={t().word.inDeck}></span>
                {/if}
                {#if w.src === 'tbcl'}<span class="src" title={t().level.fromNaer}>NAER</span>{/if}
              </a>
            </li>
          {/each}
        </ul>
        {#if shown.length < filtered.length}<div bind:this={sentinel} class="sentinel"></div>{/if}
      {/if}
      {#if shown.length >= filtered.length}
        <nav class="pager" aria-label={t().level.neighbours}>
          {#if prevLevel}
            <a
              class="pager-link sheet pressable"
              href={router.href(`/path/${prevLevel.id}`)}
              onclick={(e) => switchTo(e, prevLevel.id)}
            >
              <Icon name="back" />
              <span
                ><small>{t().level.previous}</small><strong>{t().levels[prevLevel.id]}</strong
                ></span
              >
            </a>
          {/if}
          {#if nextLevel}
            <a
              class="pager-link next sheet pressable"
              href={router.href(`/path/${nextLevel.id}`)}
              onclick={(e) => switchTo(e, nextLevel.id)}
            >
              <span><small>{t().level.next}</small><strong>{t().levels[nextLevel.id]}</strong></span
              >
              <Icon name="forward" />
            </a>
          {/if}
        </nav>
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

  /* Every level, one tap away; the current one is filled in. */
  .levels {
    display: flex;
    gap: 8px;
    margin: -8px calc(-1 * var(--gutter)) 18px;
    padding: 4px var(--gutter) 8px;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scrollbar-width: none;
  }

  .levels::-webkit-scrollbar {
    display: none;
  }

  /* Wide screens have room for every level: they wrap instead of scrolling. */
  @media (min-width: 900px) {
    .levels {
      flex-wrap: wrap;
      margin: -8px 0 18px;
      padding: 4px 0 8px;
      overflow: visible;
    }
  }

  .lv {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px 0 8px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-pill);
    background: var(--paper-raised);
    color: var(--ink-2);
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    text-decoration: none;
    scroll-snap-align: center;
    transition:
      background-color var(--dur) var(--ease),
      border-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }

  .lv.all {
    padding-left: 12px;
    color: var(--jade-text);
  }

  .lv.current {
    border-color: var(--jade);
    background: var(--jade-wash);
    color: var(--jade-text);
  }

  @media (hover: hover) {
    .lv:not(.current):hover {
      border-color: var(--ink-3);
      color: var(--ink);
    }
  }

  .lv:active {
    transform: scale(0.97);
  }

  /* After the last word: on to the next level, or back to the previous one. */
  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 16px;
  }

  .pager-link {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 64px;
    padding: 10px 14px;
    text-decoration: none;
    color: var(--ink);
  }

  .pager-link.next {
    grid-column: 2;
    justify-content: flex-end;
    text-align: right;
  }

  .pager-link span {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .pager-link small {
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-3);
  }

  .pager-link strong {
    font-size: 16px;
  }

  .pager-link :global(.icon) {
    color: var(--jade-text);
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

  /* The word just looked at, on coming back: a wash and a jade bar, pulsing once. */
  .row.seen {
    background: color-mix(in srgb, var(--jade) 12%, transparent);
    box-shadow: inset 3px 0 0 var(--jade);
    animation: seen 1.2s var(--ease-out);
  }

  @keyframes seen {
    from {
      background: color-mix(in srgb, var(--jade) 32%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .row.seen {
      animation: none;
    }
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
