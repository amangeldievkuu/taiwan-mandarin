<script lang="ts">
  // The seal album (印譜): every milestone as a seal, stamped in red once earned, outlined with a
  // little progress bar while on the way.
  import type { SealAward } from '@taiwan-mandarin/shared';
  import Seal from './Seal.svelte';

  interface Props {
    seals: SealAward[];
  }

  let { seals }: Props = $props();
  const earned = $derived(seals.filter((s) => s.progress >= 1).length);
</script>

<p class="count">{earned} of {seals.length} seals</p>
<ul class="album">
  {#each seals as seal, i (seal.id)}
    {@const done = seal.progress >= 1}
    <li class="item enter" class:done style:--i={i}>
      <Seal text={seal.zh} size={52} outline={!done} label={seal.en} />
      <span class="name">{seal.en}</span>
      {#if !done}
        <span class="progress" aria-label="{Math.round(seal.progress * 100)}% of the way"
          ><span style:transform="translateX({seal.progress * 100 - 100}%)"></span></span
        >
      {/if}
    </li>
  {/each}
</ul>

<style>
  .count {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 700;
    color: var(--ink-2);
  }

  .album {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 14px 10px;
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
    font-size: 12px;
    font-weight: 600;
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
