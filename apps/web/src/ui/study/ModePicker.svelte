<script lang="ts">
  // How the cards ask: a chip that opens a menu on phones (away from the card's tap target), the
  // whole choice inline on tablets and desktops, and what the chosen mode asks of the learner.
  import Icon from '../Icon.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { MODES, MODE_ZH, type Mode } from '../../lib/study-modes';
  import { rise } from '../../lib/transitions';

  interface Props {
    mode: Mode;
    /** The phone's menu is open. */
    open?: boolean;
  }

  let { mode = $bindable(), open = $bindable(false) }: Props = $props();
  const info = $derived(t().study.modes);

  function pick(m: Mode) {
    mode = m;
    open = false;
  }
</script>

<div class="modes">
  <div class="mode-pick">
    <button
      type="button"
      class="chip mode-chip"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label={t().study.modeIs(info[mode].name)}
      onclick={() => (open = !open)}
    >
      <span class="hanzi" lang="zh-Hant-TW">{MODE_ZH[mode]}</span>
      <span class="mode-name">{info[mode].name}</span>
      <svg class="chevron down" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 5l3 3 3-3" /></svg
      >
    </button>
    {#if open}
      <button
        type="button"
        class="mode-scrim"
        aria-label={t().common.close}
        onclick={() => (open = false)}
      ></button>
      <div class="mode-menu sheet" role="menu" aria-label={t().study.mode} in:rise={{ y: -6 }}>
        {#each MODES as m (m)}
          <button
            type="button"
            class="mode-item"
            role="menuitemradio"
            aria-checked={mode === m}
            onclick={() => pick(m)}
          >
            <span class="mode-zh hanzi" lang="zh-Hant-TW">{MODE_ZH[m]}</span>
            <span class="mode-en">{info[m].name}<small>{info[m].hint}</small></span>
            {#if mode === m}<Icon name="check" size={18} />{/if}
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <div class="mode-inline">
    <Segmented
      label={t().study.mode}
      value={mode}
      onchange={pick}
      options={MODES.map((m) => ({
        value: m,
        label: MODE_ZH[m],
        sub: info[m].name,
        lang: 'zh-Hant-TW',
      }))}
    />
  </div>
  <span class="mode-hint">{info[mode].hint}</span>
</div>

<style>
  .modes {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-width: 0;
  }

  .mode-inline {
    display: none;
  }

  /* Phones: the hint takes the column's width without widening it, so only the mode button
     decides whether the counters still fit beside it. */
  @media (max-width: 699px) {
    .mode-hint {
      width: 0;
      min-width: 100%;
    }
  }

  /* Five modes, each wide enough for its longest name (Вспоминание). */
  .modes :global(.segmented) {
    width: 430px;
    max-width: 100%;
  }

  .mode-hint {
    font-size: var(--fs-sm);
    line-height: 1.3;
    color: var(--ink-3);
  }

  @media (min-width: 700px) {
    .mode-pick {
      display: none;
    }

    .mode-inline {
      display: block;
      max-width: 100%;
    }
  }

  /* The phone's menu. On the narrowest phones a long name gives way to the counters. */
  .mode-pick {
    position: relative;
    max-width: 100%;
  }

  .mode-chip {
    gap: 6px;
    max-width: 100%;
    font-weight: var(--fw-strong);
  }

  .mode-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mode-chip .hanzi {
    font-size: var(--fs-base);
  }

  .mode-chip .chevron {
    width: 8px;
    height: 14px;
    margin-left: 2px;
    transition: transform var(--dur-2) var(--ease-out);
  }

  .mode-chip[aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }

  .mode-scrim {
    position: fixed;
    inset: 0;
    z-index: 29;
    cursor: default;
  }

  .mode-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: min(300px, calc(100vw - 2 * var(--gutter)));
    padding: 6px;
    box-shadow: var(--shadow-3);
  }

  .mode-item {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    width: 100%;
    min-height: 54px;
    padding: var(--sp-2) 10px;
    border-radius: 12px;
    text-align: left;
    color: var(--ink);
  }

  .mode-item[aria-checked='true'] {
    background: var(--jade-wash);
    color: var(--jade-text);
  }

  .mode-item:active {
    background: var(--fill);
  }

  .mode-zh {
    font-size: var(--fs-xl);
    flex: none;
  }

  .mode-en {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: var(--fs-base);
    font-weight: var(--fw-strong);
    line-height: 1.2;
  }

  .mode-en small {
    font-size: var(--fs-xs);
    font-weight: var(--fw-text);
    color: var(--ink-3);
  }
</style>
