<script lang="ts">
  import type { Word } from '@taiwan-mandarin/shared';
  import MixedText from './MixedText.svelte';

  interface Props {
    word: Word;
  }

  let { word }: Props = $props();
</script>

{#if word.tw || word.mainland}
  <div class="note">
    {#if word.tw}
      <p class="tw">
        <span class="badge-tw" lang="zh-Hant-TW">臺灣</span>
        <span><MixedText text={word.tw} /></span>
      </p>
    {/if}
    {#if word.mainland}
      <p class="mainland">Mainland: <span lang="zh-Hant-TW">{word.mainland}</span></p>
    {/if}
  </div>
{/if}

<style>
  .note {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 14px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    font-size: 15px;
    line-height: 1.45;
    color: var(--ink-2);
    text-align: left;
  }

  p {
    margin: 0;
  }

  .tw {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .tw .badge-tw {
    flex: none;
  }

  .mainland {
    font-size: 13px;
  }
</style>
