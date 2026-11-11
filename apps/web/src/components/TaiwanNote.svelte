<script lang="ts">
  import type { Word } from '@taiwan-mandarin/shared';
  import Localized from '../ui/Localized.svelte';
  import { twNoteOf } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    word: Word;
  }

  let { word }: Props = $props();
  const note = $derived(twNoteOf(word));
</script>

{#if word.tw || word.mainland}
  <div class="note">
    {#if note}
      <p class="tw">
        <span class="badge-tw" lang="zh-Hant-TW">臺灣</span>
        <span><Localized value={note} /></span>
      </p>
    {/if}
    {#if word.mainland}
      <p class="mainland">{t().word.mainland}: <span lang="zh-Hant-TW">{word.mainland}</span></p>
    {/if}
  </div>
{/if}

<style>
  .note {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: var(--sp-4);
    padding: 10px var(--sp-4);
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    font-size: var(--fs-md);
    line-height: 1.45;
    color: var(--ink-2);
    text-align: left;
  }

  p {
    margin: 0;
  }

  .tw {
    display: flex;
    gap: var(--sp-2);
    align-items: baseline;
  }

  .tw .badge-tw {
    flex: none;
  }

  .mainland {
    font-size: var(--fs-sm);
  }
</style>
