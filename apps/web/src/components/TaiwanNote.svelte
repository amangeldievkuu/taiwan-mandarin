<script lang="ts">
  import type { MeaningLang, Word } from '@taiwan-mandarin/shared';
  import MixedText from './MixedText.svelte';

  interface Props {
    word: Word;
    lang: MeaningLang;
  }

  let { word, lang }: Props = $props();

  const MAINLAND_LABEL: Record<MeaningLang, string> = { ky: 'Материкте', en: 'Mainland' };
</script>

{#if word.tw || word.mainland}
  <div class="note">
    {#if word.tw}
      <p class="tw">
        <span class="badge-tw" lang="zh-Hant-TW">臺灣</span>
        <span><MixedText text={word.tw[lang]} /></span>
      </p>
    {/if}
    {#if word.mainland}
      <p class="mainland">
        {MAINLAND_LABEL[lang]}: <span lang="zh-Hant-TW">{word.mainland}</span>
      </p>
    {/if}
  </div>
{/if}

<style>
  .note {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: var(--note-bg, var(--grouped));
    font-size: 15px;
    line-height: 1.4;
    color: var(--text-2);
    text-align: left;
  }

  @media (prefers-color-scheme: dark) {
    .note {
      background: var(--note-bg, var(--cell));
    }
  }

  p {
    margin: 0;
  }

  .tw {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .mainland {
    font-size: 13px;
  }
</style>
