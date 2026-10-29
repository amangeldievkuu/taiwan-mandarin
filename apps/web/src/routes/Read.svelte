<script lang="ts">
  import Loading from '../ui/Loading.svelte';
  import { LEVELS, type Reader } from '@taiwan-mandarin/shared';
  import Localized from '../ui/Localized.svelte';
  import Seal from '../ui/Seal.svelte';
  import { content } from '../lib/content.svelte';
  import { readerSummaryOf, readerTitleOf } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';
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
      <p class="eyebrow">{t().read.eyebrow} · 分級閱讀</p>
      <h1 class="title"><span class="zh">閱讀</span>{t().titles.read}</h1>
    </div>
  </header>
  <p class="intro">{t().read.intro}</p>

  {#if failed}
    <p class="empty">{t().read.loadFailed}</p>
  {:else if readers === null}
    <Loading />
  {:else if readers.length === 0}
    <p class="empty"><span class="hanzi" lang="zh-Hant-TW">書</span>{t().read.none}</p>
  {:else}
    {#each groups as { level, items } (level.id)}
      <h2 class="section-title">
        {t().levels[level.id]} · {level.cefr} <span class="zh" lang="zh-Hant-TW">{level.zh}</span>
      </h2>
      <div class="grid">
        {#each items as reader (reader.id)}
          {@const share = known(reader)}
          <a
            class="story sheet pressable"
            href={router.href(`/read/${reader.id}`)}
            onclick={router.link}
          >
            <div class="story-top">
              <Seal text={LEVEL_SEAL[reader.level]} size={34} outline />
              <span class="topic">
                {#if reader.draft}<span class="draft" title={t().read.draftTitle}
                    >{t().read.draft}</span
                  >{/if}
                {t().topics[reader.topic]}
              </span>
            </div>
            <h3 class="story-zh hanzi" lang="zh-Hant-TW">{reader.title}</h3>
            <p class="story-en"><Localized value={readerTitleOf(reader)} /></p>
            <p class="summary"><Localized value={readerSummaryOf(reader)} /></p>
            <div class="story-foot">
              <span class="tabular"
                >{t().read.length(
                  reader.charCount,
                  Math.max(1, Math.round(reader.charCount / 150)),
                )}</span
              >
              <span class="known tabular" title={t().read.knownTitle}>
                <span class="meter"><span style:width="{share * 100}%"></span></span>
                {t().read.known(Math.round(share * 100))}
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

  .draft {
    margin-right: 6px;
    padding: 1px 6px;
    border: 1px solid var(--ochre);
    border-radius: 4px;
    color: var(--ochre);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .story-zh {
    margin: 14px 0 0;
    font-size: 30px;
    font-weight: 400;
    line-height: 1.2;
  }

  .story-en {
    margin: 2px 0 0;
    font-family: var(--font-display);
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
