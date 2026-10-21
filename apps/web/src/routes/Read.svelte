<script lang="ts">
  import { LEVELS, TOPIC_BY_ID, type Reader } from '@taiwan-mandarin/shared';
  import Seal from '../ui/Seal.svelte';
  import { content } from '../lib/content.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { LEVEL_SEAL } from './Path.svelte';

  let readers = $state<Reader[] | null>(null);
  let failed = $state(false);
  $effect(() => {
    content.readers().then(
      (r) => (readers = r),
      () => (failed = true),
    );
  });

  /** Share of the reader's study-path words the learner has started. */
  function known(reader: Reader): number {
    const ids = new Set(reader.paragraphs.flat().flatMap((t) => (t.w ? [t.w] : [])));
    if (ids.size === 0) return 0;
    return [...ids].filter((id) => store.cards[id]).length / ids.size;
  }

  const groups = $derived(
    LEVELS.map((level) => ({
      level,
      items: (readers ?? []).filter((r) => r.level === level.id),
    })).filter((g) => g.items.length),
  );
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Graded reading · 分級閱讀</p>
      <h1 class="title"><span class="zh">閱讀</span>Read</h1>
    </div>
  </header>
  <p class="intro">
    Short texts about everyday life in Taiwan, written for each TOCFL level. Tap any word to see it
    in the dictionary and add it to your deck.
  </p>

  {#if failed}
    <p class="empty">Couldn't load the readers.</p>
  {:else if readers === null}
    <p class="empty">Loading…</p>
  {:else if readers.length === 0}
    <p class="empty"><span class="hanzi" lang="zh-Hant-TW">書</span>No readers yet.</p>
  {:else}
    {#each groups as { level, items } (level.id)}
      <h2 class="section-title">
        {level.en} · {level.cefr} <span class="zh" lang="zh-Hant-TW">{level.zh}</span>
      </h2>
      <div class="grid">
        {#each items as reader (reader.id)}
          {@const share = known(reader)}
          <a class="story sheet" href={router.href(`/read/${reader.id}`)} onclick={router.link}>
            <div class="story-top">
              <Seal text={LEVEL_SEAL[reader.level]} size={34} outline />
              <span class="topic">{TOPIC_BY_ID.get(reader.topic)?.en}</span>
            </div>
            <h3 class="story-zh hanzi" lang="zh-Hant-TW">{reader.title}</h3>
            <p class="story-en">{reader.titleEn}</p>
            <p class="summary">{reader.summary}</p>
            <div class="story-foot">
              <span class="tabular"
                >{reader.charCount} 字 · ~{Math.max(1, Math.round(reader.charCount / 150))} min</span
              >
              <span class="known tabular" title="Words you've started studying">
                <span class="meter"><span style:width="{share * 100}%"></span></span>
                {Math.round(share * 100)}% known
              </span>
            </div>
          </a>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<style>
  .intro {
    margin: -8px 0 8px;
    max-width: 60ch;
    color: var(--ink-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .story {
    display: flex;
    flex-direction: column;
    padding: 18px;
    text-decoration: none;
    transition:
      transform var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .story:hover {
      transform: translateY(-2px);
      border-color: var(--rule-strong);
    }
  }

  .story-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topic {
    font-size: 12px;
    color: var(--ink-3);
    letter-spacing: 0.04em;
  }

  .story-zh {
    margin: 14px 0 0;
    font-size: 30px;
    font-weight: 400;
    line-height: 1.2;
  }

  .story-en {
    margin: 2px 0 0;
    font-family: var(--font-serif);
    font-size: 17px;
  }

  .summary {
    flex: 1;
    margin: 8px 0 14px;
    font-size: 14px;
    color: var(--ink-2);
  }

  .story-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--ink-2);
  }

  .known {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .meter {
    width: 48px;
    height: 4px;
    border-radius: 2px;
    background: var(--fill);
    overflow: hidden;
  }

  .meter span {
    display: block;
    height: 100%;
    background: var(--jade);
  }
</style>
