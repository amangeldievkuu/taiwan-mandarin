<script lang="ts" module>
  import type { Phonetics } from '@taiwan-mandarin/shared';

  /** Hanzi size that fits `count` characters (plus their Zhuyin columns) across `available`. */
  export function fitSize(count: number, phonetics: Phonetics, max: number, available: string) {
    const perChar = phonetics === 'pinyin' ? 1.08 : 1.42;
    return `min(${max}px, calc((${available}) / ${(count * perChar).toFixed(2)}))`;
  }
</script>

<script lang="ts">
  import { toToneMarkedSyllables, toZhuyin, type Word } from '@taiwan-mandarin/shared';

  interface Props {
    word: Word;
    /** CSS length for the hanzi size. */
    size: string;
    phonetics: Phonetics;
    /** Phonetics are laid out (space reserved) but only visible when true. */
    show?: boolean;
  }

  let { word, size, phonetics, show = true }: Props = $props();

  const units = $derived.by(() => {
    const zhuyin = toZhuyin(word.pinyin);
    const pinyin = toToneMarkedSyllables(word.pinyin);
    return [...word.hanzi].map((char, i) => ({
      char,
      zhuyin: zhuyin[i] ?? { body: '', tone: '' },
      pinyin: pinyin[i] ?? '',
    }));
  });
  const withZhuyin = $derived(phonetics !== 'pinyin');
  const withPinyin = $derived(phonetics !== 'zhuyin');
</script>

<span class="word" style:--size={size} lang="zh-Hant-TW">
  {#each units as { char, zhuyin, pinyin }, i (i)}
    <span class="unit">
      <span class="char hanzi">{char}</span>
      {#if withZhuyin}
        <span class="zhuyin hanzi" class:hidden={!show} aria-hidden={!show}>
          {#if zhuyin.tone === '˙'}<span class="neutral">˙</span>{/if}
          <span class="letters">
            {#each zhuyin.body as letter, j (j)}<span>{letter}</span>{/each}
          </span>
          {#if zhuyin.tone && zhuyin.tone !== '˙'}
            <span class="tone">{zhuyin.tone}</span>
          {/if}
        </span>
      {/if}
      {#if withPinyin}
        <span class="pinyin" class:hidden={!show} aria-hidden={!show}>{pinyin}</span>
      {/if}
    </span>
  {/each}
</span>

<style>
  .word {
    display: inline-flex;
    justify-content: center;
    align-items: flex-start;
    gap: calc(var(--size) * 0.04);
  }

  .unit {
    display: grid;
    grid-template-columns: auto auto;
    grid-template-areas: 'char zhuyin' 'pinyin .';
    align-items: center;
  }

  .char {
    grid-area: char;
    font-size: var(--size);
    line-height: 1.12;
  }

  /* Zhuyin column: symbols stacked, tone mark in its own lane on the right, neutral ˙ on top */
  .zhuyin {
    grid-area: zhuyin;
    display: grid;
    grid-template-columns: 1em 0.5em;
    align-content: center;
    font-size: calc(var(--size) * 0.22);
    line-height: 1.02;
    color: var(--text);
  }

  /* Tone marks use the UI font: Kai's ˇ looks like a check mark */
  .neutral,
  .tone {
    font-family: var(--font-ui);
  }

  .neutral {
    grid-area: 1 / 1;
    justify-self: center;
    line-height: 0.7;
  }

  .letters {
    grid-area: 2 / 1;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tone {
    grid-area: 2 / 2;
    align-self: end;
    margin-bottom: 0.4em;
    font-size: 0.8em;
    line-height: 1;
  }

  .pinyin {
    grid-area: pinyin;
    justify-self: center;
    margin-top: calc(var(--size) * 0.02);
    font-family: var(--font-ui);
    font-size: max(13px, calc(var(--size) * 0.17));
    line-height: 1.2;
    color: var(--text-2);
  }

  .hidden {
    opacity: 0;
    visibility: hidden;
  }

  .zhuyin,
  .pinyin {
    transition:
      opacity var(--dur) var(--ease),
      visibility var(--dur);
  }
</style>
