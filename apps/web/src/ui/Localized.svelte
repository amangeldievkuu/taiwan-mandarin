<script lang="ts">
  // Content text in the learner's language. English standing in for a missing translation is
  // marked (its own lang and a small EN tag), so it reads as a stopgap rather than a mistake.
  import MixedText from '../components/MixedText.svelte';
  import type { Localized } from '../lib/i18n/content';
  import { locale, t } from '../lib/i18n/index.svelte';

  interface Props {
    value: Localized;
  }

  let { value }: Props = $props();
</script>

{#if value.lang === locale.lang}<MixedText text={value.text} />{:else}<span lang={value.lang}
    ><MixedText text={value.text} /></span
  ><abbr class="fallback" title={t().common.inEnglish}>EN</abbr>{/if}

<style>
  .fallback {
    margin-left: 0.4em;
    padding: 0 0.35em;
    border-radius: 4px;
    background: var(--paper-sunken);
    color: var(--ink-3);
    font-size: 0.62em;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-decoration: none;
    vertical-align: 0.15em;
  }
</style>
