<script lang="ts">
  // The inkstone (硯): the ink earned so far pooling in its well, filling towards the next thing
  // it unlocks, then every look by slot, to choose from once its ink is there. Ink is never spent.
  import {
    isUnlocked,
    LOOK_ZH,
    nextUnlock,
    SLOT_IDS,
    SLOTS,
    unlockFor,
    UNLOCKS,
    type Bowl,
    type LookOf,
    type Slot,
  } from '@taiwan-mandarin/shared';
  import InkDrop from '../ui/InkDrop.svelte';
  import Seal from '../ui/Seal.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import SubpageHead from '../ui/SubpageHead.svelte';
  import InkBlob from '../ui/landing/InkBlob.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { store } from '../lib/store.svelte';

  const ink = $derived(store.xp.total);
  const next = $derived(nextUnlock(ink));
  /** The ink from the last unlock to the next, as a share filled. */
  const fill = $derived.by(() => {
    if (!next) return 1;
    const from = [...UNLOCKS].reverse().find((u) => u.at <= ink)?.at ?? 0;
    return (ink - from) / (next.at - from);
  });
  const name = (slot: Slot, value: string) => t().inkstone.names[`${slot}-${value}`] ?? value;

  /** The well of the inkstone, and how high the ink stands in it. */
  const WELL = { x: 44, y: 18, width: 112, height: 30 };
  const level = $derived(WELL.y + WELL.height * (1 - Math.max(0.06, fill)));

  /** A small tree for the glaze swatches. */
  const SAMPLE: Bowl = { start: '2026-03-01', end: '2026-03-12', days: 12, seams: [] };
  const ZH: Record<Slot, string> = { pot: '釉', paste: '印泥', paper: '紙', brush: '筆', mo: '墨' };
</script>

<div class="page">
  <SubpageHead title={t().titles['me-ink']} zh="硯" />

  <section class="hero sheet enter">
    <svg class="stone" viewBox="0 0 200 128" role="img" aria-label={t().inkstone.total(ink)}>
      <defs>
        <linearGradient id="ink-pool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffe9a3" />
          <stop offset="0.5" stop-color="#f2c14e" />
          <stop offset="1" stop-color="#b9831a" />
        </linearGradient>
        <clipPath id="ink-well">
          <rect x={WELL.x} y={WELL.y} width={WELL.width} height={WELL.height} rx="15" />
        </clipPath>
      </defs>
      <!-- The stone, its grinding face, the well at the top end -->
      <rect class="body" x="16" y="6" width="168" height="116" rx="26" />
      <rect class="face" x="30" y="58" width="140" height="52" rx="18" />
      <rect class="well" x={WELL.x} y={WELL.y} width={WELL.width} height={WELL.height} rx="15" />
      <g clip-path="url(#ink-well)">
        <rect
          class="pool"
          x={WELL.x}
          y={level}
          width={WELL.width}
          height={WELL.height}
          fill="url(#ink-pool)"
        />
        <ellipse class="glint" cx={WELL.x + 30} cy={level + 4} rx="16" ry="1.6" />
      </g>
      <!-- The ink stick resting across the face -->
      <g class="stick" transform="rotate(-14 120 84)">
        <rect x="76" y="78" width="78" height="13" rx="3" />
        <text x="115" y="88.5" text-anchor="middle" lang="zh-Hant-TW">墨</text>
      </g>
    </svg>

    <div class="total">
      <strong class="big"><InkDrop size={24} /> {t().inkstone.total(ink)}</strong>
      <span class="next">
        {#if next}
          {t().inkstone.next(name(next.slot, next.value), next.at, next.at - ink)}
        {:else}
          {t().inkstone.all}
        {/if}
      </span>
    </div>
    <p class="how">{t().inkstone.how}</p>
  </section>

  {#each SLOT_IDS as slot, i (slot)}
    <h2 class="section-title">
      {t().inkstone.slots[slot]} <span class="zh" lang="zh-Hant-TW">{ZH[slot]}</span>
    </h2>
    <div class="sheet looks enter" style:--i={i + 1}>
      {#each SLOTS[slot] as value (value)}
        {@const open = isUnlocked(slot, value, ink)}
        {@const using = store.looks[slot] === value}
        {@const at = unlockFor(slot, value)?.at ?? 0}
        <button
          type="button"
          class="look"
          class:using
          aria-pressed={using}
          disabled={!open}
          onclick={() => store.chooseLook(slot, value as LookOf<Slot>)}
        >
          <span class="swatch" aria-hidden="true">
            {#if slot === 'pot'}
              <StreakPlant bowl={SAMPLE} size={58} glaze={value as LookOf<'pot'>} />
            {:else if slot === 'paste'}
              <Seal text="墨" size={40} paste={value as LookOf<'paste'>} />
            {:else if slot === 'paper'}
              <svg class="paper paper-{value}" viewBox="0 0 48 48">
                <rect x="1" y="1" width="46" height="46" rx="6" />
                <path
                  d={value === 'nine'
                    ? 'M16.3 1v46M31.7 1v46M1 16.3h46M1 31.7h46'
                    : 'M24 1v46M1 24h46M1 1l46 46M47 1 1 47'}
                />
              </svg>
            {:else if slot === 'brush'}
              <svg class="brush" viewBox="0 0 48 48">
                <path
                  class="stroke-{value}"
                  d="M8 27c4-3.5 9-4 16-3s12 .4 16-2.5c1 1.6.6 3.4-1.4 4.6-5 3-10.6 2.5-16 2.1S12 28 8 27Z"
                />
              </svg>
            {:else}
              <span class="mo"><InkBlob look={value as LookOf<'mo'>} /></span>
            {/if}
          </span>
          <span class="look-name">
            <span class="hanzi" lang="zh-Hant-TW">{LOOK_ZH[`${slot}-${value}`]}</span>
            {name(slot, value)}
          </span>
          <small class="state">
            {#if using}{t().inkstone.inUse}{:else if !open}<InkDrop size={10} />
              {t().inkstone.at(at)}{/if}
          </small>
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px 18px 18px;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-3);
    text-align: center;
  }

  .stone {
    width: min(240px, 70%);
    height: auto;
  }

  .body {
    fill: #3b3f45;
  }

  .face {
    fill: #4a4f56;
  }

  .well {
    fill: #24272b;
  }

  .pool {
    transition: y var(--dur-4) var(--ease-out);
  }

  .glint {
    fill: rgb(255 255 255 / 0.55);
  }

  .stick rect {
    fill: #1d1f22;
    stroke: #6b6f75;
    stroke-width: 0.6;
  }

  .stick text {
    font-family: var(--font-kai);
    font-size: 9px;
    fill: var(--gold);
  }

  .total {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .big {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 24px;
    font-weight: 800;
    color: var(--gold-deep);
  }

  .next {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-2);
  }

  .how {
    max-width: 34em;
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-2);
  }

  .looks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
    padding: 10px;
  }

  .look {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 132px;
    padding: 10px 6px;
    border: 1.5px solid transparent;
    border-radius: var(--radius);
    text-align: center;
    transition:
      border-color var(--dur) var(--ease),
      background-color var(--dur) var(--ease);
  }

  .look:not(:disabled):hover {
    background: var(--fill);
  }

  .look.using {
    border-color: var(--gold);
    background: var(--gold-wash);
  }

  .look:disabled {
    cursor: default;
  }

  .look:disabled .swatch {
    opacity: 0.4;
    filter: grayscale(0.7);
  }

  .swatch {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
  }

  .look-name {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.3;
  }

  .look-name .hanzi {
    font-family: var(--font-kai);
    font-size: 16px;
    font-weight: 400;
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    min-height: 16px;
    font-size: 11px;
    font-weight: 700;
    color: var(--gold-deep);
  }

  .look:disabled .state {
    color: var(--ink-3);
  }

  .paper {
    width: 52px;
    height: 52px;
  }

  .paper rect {
    fill: var(--paper);
    stroke: var(--rule-strong);
  }

  .paper path {
    fill: none;
    stroke: var(--rule-strong);
    stroke-width: 0.8;
    stroke-dasharray: 2 2.5;
  }

  .paper-nine path {
    stroke: color-mix(in srgb, var(--seal) 40%, transparent);
    stroke-dasharray: none;
  }

  .paper-xuan rect {
    fill: color-mix(in srgb, #e9d6ad 45%, var(--paper));
  }

  .brush {
    width: 56px;
    height: 56px;
  }

  .stroke-vermilion {
    fill: var(--seal);
  }

  .stroke-gold {
    fill: var(--gold);
  }

  /* 墨 sits still here: no dripping in, no speech. */
  .mo {
    width: 44px;
    pointer-events: none;
  }

  .mo :global(.drop),
  .mo :global(.hair),
  .mo :global(.leg) {
    animation: none;
    stroke-dashoffset: 0;
  }
</style>
