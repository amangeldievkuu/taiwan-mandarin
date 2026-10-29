<script lang="ts">
  // A word's Sino-Vietnamese (Hán-Việt) reading, "quốc gia" for 國家: shown in Vietnamese when the
  // setting is on, as a quiet reading aid under the meaning (it is a reading, not a meaning).
  import { hanVietOf } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    reading: string | undefined;
  }

  let { reading }: Props = $props();
  const shown = $derived(hanVietOf(reading));
</script>

{#if shown}
  <p class="hv"><span class="label">{t().common.hanViet}</span> {shown}</p>
{/if}

<style>
  .hv {
    margin: 0;
    font-size: 14px;
    color: var(--ink-2);
  }
  .label {
    margin-right: 0.3em;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-3);
  }
</style>
