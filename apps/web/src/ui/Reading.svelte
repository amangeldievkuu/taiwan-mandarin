<script lang="ts">
  // A reading in the learner's phonetic system. A word on one line: ㄐㄧㄝˊ ㄩㄣˋ · jiéyùn. With
  // `text`, a whole sentence, spaced by word with its punctuation: Wǒ míngtiān zài lái.
  import {
    pinyinSentence,
    pinyinWord,
    toToneMarked,
    zhuyinSentence,
    zhuyinString,
  } from '@taiwan-mandarin/shared';
  import { store } from '../lib/store.svelte';

  interface Props {
    pinyin: string;
    /** The sentence the reading belongs to; renders it as a sentence rather than one word. */
    text?: string;
    /** Characters per word of `text` (Example.wordLengths); without it syllables are spaced. */
    wordLengths?: readonly number[];
  }

  let { pinyin, text, wordLengths }: Props = $props();

  const parts = $derived.by(() => {
    try {
      return text
        ? {
            zhuyin: zhuyinSentence(text, pinyin, wordLengths),
            pinyin: pinyinSentence(text, pinyin, wordLengths),
          }
        : { zhuyin: zhuyinString(pinyin), pinyin: pinyinWord(pinyin) };
    } catch {
      try {
        return { zhuyin: zhuyinString(pinyin), pinyin: toToneMarked(pinyin) };
      } catch {
        return { zhuyin: '', pinyin };
      }
    }
  });
  const phonetics = $derived(store.settings.phonetics);
  // The neutral-tone dot goes before its syllable; a word joiner keeps a line from breaking there.
  const zhuyin = $derived(parts.zhuyin.replaceAll('˙', '˙\u2060'));
</script>

<span class="reading" class:sentence={text !== undefined}>
  {#if phonetics !== 'pinyin' && parts.zhuyin}<span class="zhuyin" lang="zh-Hant-TW">{zhuyin}</span
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
    min-width: 0;
    color: var(--ink-2);
    overflow-wrap: anywhere;
  }

  /* A sentence: Zhuyin and pinyin each on their own line, wrapping like text. */
  .reading.sentence {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sentence .dot {
    display: none;
  }

  .zhuyin {
    font-family: var(--font-kai);
    letter-spacing: 0.04em;
  }

  .dot {
    color: var(--ink-3);
  }
</style>
