<script lang="ts" module>
  import type { Level } from '@taiwan-mandarin/shared';

  /** Two-character seal names for the TOCFL bands. */
  export const LEVEL_SEAL: Record<Level, string> = {
    N1: '準一',
    N2: '準二',
    L1: '入門',
    L2: '基礎',
    L3: '進階',
    L4: '高階',
    L5: '流利',
    L6: '精通',
  };
</script>

<script lang="ts">
  import { LEVEL_IDS, LEVELS } from '@taiwan-mandarin/shared';
  import Icon from '../ui/Icon.svelte';
  import Seal from '../ui/Seal.svelte';
  import { content } from '../lib/content.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  const manifest = $derived(content.manifest);
  const started = $derived.by(() => {
    const counts = Object.fromEntries(
      LEVEL_IDS.map((l) => [l, { started: 0, mature: 0 }]),
    ) as Record<Level, { started: number; mature: number }>;
    for (const record of Object.values(store.cards)) {
      if (!record.level) continue;
      counts[record.level].started++;
      if (record.card.stability >= 21) counts[record.level].mature++;
    }
    return counts;
  });

  function toggle(level: Level) {
    const active = store.settings.levels;
    const next = active.includes(level) ? active.filter((l) => l !== level) : [...active, level];
    if (next.length === 0) return;
    void store.updateSettings({ levels: LEVEL_IDS.filter((l) => next.includes(l)) });
  }

  const BANDS = [
    { name: 'Novice', zh: '準備級', levels: ['N1', 'N2'] },
    { name: 'Band A', zh: '入門基礎', levels: ['L1', 'L2'] },
    { name: 'Band B', zh: '進階高階', levels: ['L3', 'L4'] },
    { name: 'Band C', zh: '流利精通', levels: ['L5', 'L6'] },
  ] as const;
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">TOCFL · 華語文能力測驗</p>
      <h1 class="title"><span class="zh">路徑</span>Your path</h1>
    </div>
  </header>
  <p class="intro">
    Taiwan's official exam path, Novice to Level 6. Words come from the TOCFL 8,000-word list and
    the NAER 《臺灣華語文能力基準》; switch on the levels you want new cards from.
  </p>

  {#each BANDS as band (band.name)}
    <h2 class="section-title">{band.name} <span class="zh" lang="zh-Hant-TW">{band.zh}</span></h2>
    <ol class="stations">
      {#each band.levels as id (id)}
        {@const info = LEVELS.find((l) => l.id === id) ?? { en: id, zh: '', cefr: '' }}
        {@const meta = manifest?.levels.find((l) => l.id === id)}
        {@const s = started[id]}
        {@const active = store.settings.levels.includes(id)}
        {@const share = meta?.count ? s.started / meta.count : 0}
        <li class="station sheet" class:active>
          <a class="station-main" href={router.href(`/path/${id}`)} onclick={router.link}>
            <Seal text={LEVEL_SEAL[id]} size={58} outline={!active && s.started === 0} />
            <div class="station-body">
              <div class="station-name">
                <strong>{info.en}</strong>
                <span class="level-tag">{info.cefr}</span>
              </div>
              <span class="station-zh" lang="zh-Hant-TW">{info.zh}</span>
              <div class="bar" aria-hidden="true">
                <span
                  class="mature"
                  style:width="{meta?.count ? (100 * s.mature) / meta.count : 0}%"
                ></span>
                <span class="started" style:width="{100 * share}%"></span>
              </div>
              <small class="tabular">
                {s.started.toLocaleString()} / {(meta?.count ?? 0).toLocaleString()} words
                {#if meta && meta.tbcl > 0 && meta.tocfl > 0}· {meta.tocfl.toLocaleString()} TOCFL{/if}
              </small>
            </div>
            <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"
              ><path d="M1 1l6 6-6 6" /></svg
            >
          </a>
          <button
            type="button"
            class="toggle"
            class:on={active}
            aria-pressed={active}
            title={active ? 'New cards come from this level' : 'Study new words from this level'}
            onclick={() => toggle(id)}
          >
            {#if active}<Icon name="check" size={16} /> Studying{:else}<Icon
                name="plus"
                size={16}
              /> Study{/if}
          </button>
        </li>
      {/each}
    </ol>
  {/each}

  <p class="footnote">
    Level 6 (精通, C2) has no TOCFL list; it uses level 7 of the NAER list. Words marked "NAER" fill
    gaps in lower levels and come after the TOCFL words.
  </p>
</div>

<style>
  .intro {
    margin: -8px 0 8px;
    max-width: 60ch;
    color: var(--ink-2);
  }

  .stations {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0 0 0 0;
    list-style: none;
  }

  .station {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 14px;
    transition: border-color var(--dur) var(--ease);
  }

  .station.active {
    border-color: color-mix(in srgb, var(--seal) 40%, var(--rule));
  }

  .station-main {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 0 16px 18px;
    text-decoration: none;
  }

  .station-body {
    flex: 1;
    min-width: 0;
  }

  .station-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .station-name strong {
    font-size: 18px;
  }

  .station-zh {
    font-family: var(--font-kai);
    color: var(--ink-3);
  }

  .bar {
    position: relative;
    height: 6px;
    margin: 8px 0 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }

  .bar span {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: 3px;
    transition: width 700ms var(--ease);
  }

  .started {
    background: color-mix(in srgb, var(--jade) 40%, transparent);
  }

  .mature {
    z-index: 1;
    background: var(--jade);
  }

  small {
    color: var(--ink-2);
    font-size: 13px;
  }

  .toggle {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 999px;
    border: 1px solid var(--rule-strong);
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-2);
  }

  .toggle.on {
    border-color: var(--seal);
    background: var(--seal);
    color: var(--seal-ink);
  }

  @media (max-width: 480px) {
    .station {
      flex-direction: column;
      align-items: stretch;
      padding: 0 14px 14px 0;
    }

    .toggle {
      align-self: flex-end;
    }

    .chevron {
      display: none;
    }
  }
</style>
