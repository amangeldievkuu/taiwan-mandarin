<script lang="ts">
  // Chinese text where every character can be tapped to look up the word starting there.
  // The current lookup is underlined in vermilion.
  import { lookup } from '../lib/lookup.svelte';

  interface Props {
    text: string;
    /** Extra class for sizing from the parent. */
    class?: string;
  }

  let { text, class: className = '' }: Props = $props();

  const HAN = /\p{Script=Han}/u;
  const chars = $derived(
    [...text].reduce<{ char: string; index: number }[]>((list, char) => {
      const prev = list.at(-1);
      list.push({ char, index: prev ? prev.index + prev.char.length : 0 });
      return list;
    }, []),
  );

  const selected = (index: number) =>
    lookup.open &&
    lookup.source?.text === text &&
    index >= lookup.source.start &&
    index < lookup.source.end;
</script>

<span class="hanzi-text {className}" lang="zh-Hant-TW"
  >{#each chars as { char, index } (index)}{#if HAN.test(char)}<button
        type="button"
        class="ch"
        class:selected={selected(index)}
        onclick={(e) => {
          e.stopPropagation();
          void lookup.openAt(text, index);
        }}>{char}</button
      >{:else}{char}{/if}{/each}</span
>

<style>
  .hanzi-text {
    font-family: var(--font-hanzi);
  }

  .ch {
    display: inline;
    font: inherit;
    line-height: inherit;
    padding: 0;
    border-radius: 3px;
    transition: background-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .ch:hover {
      background: var(--fill);
    }
  }

  .ch.selected {
    background: var(--seal-wash);
    box-shadow: inset 0 -2px 0 var(--seal);
    border-radius: 0;
  }
</style>
