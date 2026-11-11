<script lang="ts">
  // The seal album (印譜): every milestone as a seal, stamped in red once earned, outlined with a
  // little progress bar while on the way.
  import type { SealAward } from '@taiwan-mandarin/shared';
  import Seal from './Seal.svelte';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    seals: SealAward[];
  }

  let { seals }: Props = $props();
  const earned = $derived(seals.filter((s) => s.progress >= 1).length);
</script>

<p class="count">{t().seals.count(earned, seals.length)}</p>
<ul class="album">
  {#each seals as seal, i (seal.id)}
    {@const done = seal.progress >= 1}
    {@const name = t().seals.names[seal.id] ?? seal.en}
    <li class="item enter" class:done style:--i={i}>
      <Seal text={seal.zh} size={52} outline={!done} label={name} />
      <span class="name">{name}</span>
      {#if !done}
        <span class="progress" aria-label={t().seals.progress(Math.round(seal.progress * 100))}
          ><span style:transform="translateX({seal.progress * 100 - 100}%)"></span></span
        >
      {/if}
    </li>
  {/each}
</ul>

<style>
  .count {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-md);
    font-weight: var(--fw-strong);
    color: var(--ink-2);
  }

  .album {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: var(--sp-3) 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }

  .item:not(.done) :global(.seal) {
    opacity: 0.45;
  }

  .name {
    font-size: var(--fs-xs);
    font-weight: var(--fw-label);
    line-height: 1.3;
    color: var(--ink-2);
  }

  .done .name {
    color: var(--ink);
  }

  .progress {
    width: 56px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .progress span {
    display: block;
    height: 100%;
    background: var(--jade);
  }
</style>
