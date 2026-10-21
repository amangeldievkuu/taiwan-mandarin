<script lang="ts">
  import { LEVELS, type DictEntry, type SearchRow } from '@taiwan-mandarin/shared';
  import Explain from '../ui/Explain.svelte';
  import HanziText from '../ui/HanziText.svelte';
  import Icon from '../ui/Icon.svelte';
  import Reading from '../ui/Reading.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { content } from '../lib/content.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { router } from '../lib/router.svelte';

  let tab = $state<'lookup' | 'explain'>(router.route.query.get('explain') ? 'explain' : 'lookup');
  let query = $state(router.route.query.get('q') ?? '');
  let results = $state<SearchRow[]>([]);
  let exact = $state<DictEntry[]>([]);
  let searching = $state(false);
  let input = $state<HTMLInputElement>();

  const isHan = $derived(/\p{Script=Han}/u.test(query));
  const long = $derived(isHan && [...query.trim()].length > 4);

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const q = query.trim();
    clearTimeout(timer);
    if (!q) {
      results = [];
      exact = [];
      return;
    }
    searching = true;
    timer = setTimeout(async () => {
      const [rows, entries] = await Promise.all([
        content.search(q),
        /\p{Script=Han}/u.test(q) && [...q].length <= 8 ? content.lookup(q) : Promise.resolve([]),
      ]);
      if (q !== query.trim()) return;
      results = rows;
      exact = entries.filter((e) => !e.w);
      searching = false;
      router.go(`/dict?q=${encodeURIComponent(q)}`, { replace: true });
    }, 160);
  });

  $effect(() => {
    if (tab === 'lookup' && matchMedia('(pointer: fine)').matches) input?.focus();
  });

  const levelLabel = (id: string | undefined) => LEVELS.find((l) => l.id === id)?.en;
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">CC-CEDICT · Taiwan readings</p>
      <h1 class="title"><span class="zh">字典</span>Dictionary</h1>
    </div>
  </header>

  <div class="tabs">
    <Segmented
      label="Mode"
      value={tab}
      onchange={(t) => (tab = t)}
      options={[
        { value: 'lookup', label: 'Look up' },
        { value: 'explain', label: 'Explain a sentence' },
      ]}
    />
  </div>

  {#if tab === 'lookup'}
    <label class="search">
      <Icon name="search" />
      <span class="visually-hidden">Search</span>
      <input
        bind:this={input}
        type="search"
        bind:value={query}
        placeholder="漢字, pinyin (jieyun) or English"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        lang="zh-Hant-TW"
      />
    </label>

    {#if long}
      <section class="pasted sheet">
        <p class="hint">Tap any character to look up the word that starts there.</p>
        <HanziText text={query.trim()} class="pasted-text" />
      </section>
    {/if}

    {#if !query.trim()}
      <div class="empty">
        <span class="hanzi" lang="zh-Hant-TW">查</span>
        Search 125,000 entries with Taiwan readings.<br />Type characters, pinyin without tones, or
        English.
      </div>
    {:else if long}
      <!-- A pasted sentence: tap through it above. -->
    {:else if !searching && results.length === 0 && exact.length === 0}
      <p class="empty"><span class="hanzi" lang="zh-Hant-TW">無</span>Nothing found.</p>
    {:else}
      {#if exact.length}
        <h2 class="section-title">Dictionary</h2>
        <ul class="list">
          {#each exact.slice(0, 5) as entry, i (i)}
            <li>
              <button type="button" class="row" onclick={() => void lookup.openWord(entry.t)}>
                <span class="w-hanzi hanzi" lang="zh-Hant-TW">{entry.t}</span>
                <span class="row-main">
                  <Reading pinyin={entry.p} />
                  <span class="row-sub">{entry.d.slice(0, 3).join('; ')}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if results.length}
        <h2 class="section-title">In the study path</h2>
        <ul class="list">
          {#each results as [id, hanzi, , en] (id)}
            {@const level = content.word(id)?.level}
            <li>
              <a
                class="row"
                href={router.href(`/word/${encodeURIComponent(id)}`)}
                onclick={router.link}
              >
                <span class="w-hanzi hanzi" lang="zh-Hant-TW">{hanzi}</span>
                <span class="row-main">
                  <span class="row-sub en">{en}</span>
                </span>
                {#if level}<span class="level-tag">{levelLabel(level)}</span>{/if}
                <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"
                  ><path d="M1 1l6 6-6 6" /></svg
                >
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  {:else}
    <Explain />
  {/if}
</div>

<style>
  .tabs {
    max-width: 360px;
    margin-bottom: 16px;
  }

  .pasted {
    margin-top: 16px;
    padding: 16px 18px;
  }

  .hint {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--ink-2);
  }

  .pasted :global(.pasted-text) {
    font-size: 26px;
    line-height: 1.7;
  }

  .w-hanzi {
    min-width: 2.6em;
    font-size: 24px;
  }

  .en {
    color: var(--ink) !important;
    white-space: normal !important;
  }

  .row-main :global(.reading) {
    font-size: 14px;
  }
</style>
