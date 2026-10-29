<script lang="ts">
  // Words started per TOCFL level; each row opens that level on the path.
  import { LEVEL_IDS, LEVELS, type Level } from '@taiwan-mandarin/shared';
  import SubpageHead from '../ui/SubpageHead.svelte';
  import { content } from '../lib/content.svelte';
  import { formatNumber, t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  const perLevel = $derived.by(() => {
    const result = Object.fromEntries(LEVEL_IDS.map((l) => [l, 0])) as Record<Level, number>;
    for (const r of Object.values(store.cards)) if (r.level) result[r.level]++;
    return result;
  });
</script>

<div class="page">
  <SubpageHead title={t().titles['me-levels']} zh="等級" />

  <ul class="list">
    {#each LEVELS as level (level.id)}
      {@const total = content.manifest?.levels.find((l) => l.id === level.id)?.count ?? 0}
      {@const started = perLevel[level.id]}
      <li>
        <a class="row level-row" href={router.href(`/path/${level.id}`)} onclick={router.link}>
          <span class="lv">
            <strong>{t().levels[level.id]}</strong>
            <small>{level.cefr} · <span lang="zh-Hant-TW">{level.zh}</span></small>
          </span>
          <span class="lv-bar" aria-hidden="true"
            ><span style:transform="translateX({(total ? started / total : 0) * 100 - 100}%)"
            ></span></span
          >
          <span class="row-value">{started} / {formatNumber(total)}</span>
          <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
        </a>
      </li>
    {/each}
  </ul>
  <p class="footnote">{t().path.levelsFootnote}</p>
</div>

<style>
  .level-row {
    gap: 14px;
    min-height: 60px;
  }

  .lv {
    display: flex;
    flex-direction: column;
    width: 92px;
    flex: none;
    line-height: 1.2;
  }

  .lv strong {
    font-size: 15px;
    font-weight: 700;
  }

  .lv small {
    font-size: 12px;
    color: var(--ink-3);
  }

  .lv-bar {
    flex: 1;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .lv-bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--jade);
    transition: transform 900ms var(--ease-spring-soft);
  }

  .row-value {
    min-width: 84px;
    text-align: right;
    font-size: 14px;
  }

  @media (max-width: 480px) {
    .level-row {
      flex-wrap: wrap;
      row-gap: 6px;
    }

    .lv {
      width: auto;
      flex: 1;
    }

    .lv-bar {
      flex-basis: 100%;
      order: 3;
    }
  }
</style>
