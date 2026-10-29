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
  import BackButton from '../ui/BackButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Seal from '../ui/Seal.svelte';
  import { content } from '../lib/content.svelte';
  import { formatNumber, t } from '../lib/i18n/index.svelte';
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

  /** The bands, named in the catalog in this order. */
  const BANDS = [
    { zh: '準備級', levels: ['N1', 'N2'] },
    { zh: '入門基礎', levels: ['L1', 'L2'] },
    { zh: '進階高階', levels: ['L3', 'L4'] },
    { zh: '流利精通', levels: ['L5', 'L6'] },
  ] as const;
</script>

<div class="page">
  <header class="page-head">
    <div>
      <BackButton parent="/" optional />
      <p class="eyebrow">TOCFL · 華語文能力測驗</p>
      <h1 class="title"><span class="zh">路徑</span>{t().today.yourPath}</h1>
    </div>
  </header>
  <p class="intro">{t().path.intro}</p>

  {#each BANDS as band, b (band.zh)}
    <h2 class="section-title">
      {t().path.bands[b]} <span class="zh" lang="zh-Hant-TW">{band.zh}</span>
    </h2>
    <ol class="stations">
      {#each band.levels as id, i (id)}
        {@const info = LEVELS.find((l) => l.id === id) ?? { zh: '', cefr: '' }}
        {@const meta = manifest?.levels.find((l) => l.id === id)}
        {@const s = started[id]}
        {@const active = store.settings.levels.includes(id)}
        {@const share = meta?.count ? s.started / meta.count : 0}
        <li class="station sheet enter" class:active style:--i={i}>
          <a class="station-main" href={router.href(`/path/${id}`)} onclick={router.link}>
            {#key active}
              <span class="seal" class:stamped={active}>
                <Seal text={LEVEL_SEAL[id]} size={58} outline={!active && s.started === 0} />
              </span>
            {/key}
            <div class="station-body">
              <div class="station-name">
                <strong>{t().levels[id]}</strong>
                <span class="level-tag">{info.cefr}</span>
              </div>
              <span class="station-zh" lang="zh-Hant-TW">{info.zh}</span>
              <div class="bar" aria-hidden="true">
                <span
                  class="mature"
                  style:transform="translateX({(meta?.count ? s.mature / meta.count : 0) * 100 -
                    100}%)"
                ></span>
                <span class="started" style:transform="translateX({share * 100 - 100}%)"></span>
              </div>
              <small class="tabular">
                {t().path.words(s.started, meta?.count ?? 0)}
                {#if meta && meta.tbcl > 0 && meta.tocfl > 0}· {t().path.tocfl(
                    formatNumber(meta.tocfl),
                  )}{/if}
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
            title={active ? t().path.activeTitle : t().path.inactiveTitle}
            onclick={() => toggle(id)}
          >
            {#if active}<Icon name="check" size={16} /> {t().word.studying}{:else}<Icon
                name="plus"
                size={16}
              />
              {t().path.study}{/if}
          </button>
        </li>
      {/each}
    </ol>
  {/each}

  <p class="footnote">{t().path.footnote}</p>
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
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* The trail joining the stations, behind their seals. */
  .stations::before {
    content: '';
    position: absolute;
    top: 30px;
    bottom: 30px;
    left: 46px;
    border-left: 3px dotted color-mix(in oklab, var(--jade) 45%, var(--rule-strong));
  }

  .station {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-right: 14px;
    transition:
      border-color var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease);
  }

  .station.active {
    border-color: color-mix(in oklab, var(--jade) 50%, var(--rule));
    box-shadow:
      0 0 0 3px color-mix(in oklab, var(--jade) 14%, transparent),
      var(--shadow);
  }

  .seal {
    display: grid;
  }

  .seal.stamped {
    animation: stamp 520ms var(--ease-spring);
  }

  @keyframes stamp {
    from {
      transform: scale(1.5) rotate(-10deg);
      opacity: 0.3;
    }
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
    height: 10px;
    margin: 8px 0 6px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .bar span {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    transition: transform 900ms var(--ease-spring-soft);
  }

  .started {
    background: color-mix(in oklab, var(--jade) 40%, transparent);
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
    min-height: 38px;
    padding: 0 14px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--rule-strong);
    background: var(--paper-raised);
    box-shadow: var(--shadow-1);
    font-size: 14px;
    font-weight: 700;
    color: var(--ink-2);
    transition:
      transform 160ms var(--ease-out),
      box-shadow 160ms var(--ease-out),
      background-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .toggle:hover:not(.on) {
      background: color-mix(in oklab, var(--paper-raised) 94%, var(--ink));
    }
  }

  .toggle:active {
    transform: scale(0.97);
    box-shadow: none;
    transition-duration: 80ms;
  }

  .toggle.on {
    border-color: var(--jade-edge);
    background: var(--jade);
    color: var(--jade-ink);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.16),
      0 1px 2px color-mix(in oklab, var(--jade-edge) 35%, transparent);
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
