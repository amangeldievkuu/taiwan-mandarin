<script lang="ts">
  // A word's reading on one line, in the learner's phonetic system: ㄐㄧㄝˊ ㄩㄣˋ · jiéyùn
  import { toToneMarkedSyllables, zhuyinString } from '@taiwan-mandarin/shared';
  import { store } from '../lib/store.svelte';

  interface Props {
    pinyin: string;
  }

  let { pinyin }: Props = $props();

  const parts = $derived.by(() => {
    try {
      return {
        zhuyin: zhuyinString(pinyin),
        pinyin: toToneMarkedSyllables(pinyin).join(''),
      };
    } catch {
      return { zhuyin: '', pinyin };
    }
  });
  const phonetics = $derived(store.settings.phonetics);
</script>

<span class="reading">
  {#if phonetics !== 'pinyin' && parts.zhuyin}<span class="zhuyin" lang="zh-Hant-TW"
      >{parts.zhuyin}</span
    >{/if}
  {#if phonetics === 'both' && parts.zhuyin}<span class="dot" aria-hidden="true">·</span>{/if}
  {#if phonetics !== 'zhuyin' || !parts.zhuyin}<span class="pinyin">{parts.pinyin}</span>{/if}
</span>

<style>
  .reading {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 6px;
    color: var(--ink-2);
  }

  .zhuyin {
    font-family: var(--font-kai);
    letter-spacing: 0.04em;
  }

  .dot {
    color: var(--ink-3);
  }
</style>
