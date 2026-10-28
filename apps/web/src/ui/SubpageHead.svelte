<script lang="ts">
  // The header of a page under Me: a back button, an eyebrow and the title (with its Chinese).
  import Icon from './Icon.svelte';
  import { router } from '../lib/router.svelte';

  interface Props {
    title: string;
    zh?: string;
    eyebrow?: string;
    /** Where back goes when there is no in-app history (a deep link). */
    back?: string;
    backLabel?: string;
  }

  let { title, zh, eyebrow = 'Me', back = '/me', backLabel = 'Back' }: Props = $props();
</script>

<header class="page-head">
  <div class="head">
    <a
      class="back"
      href={router.href(back)}
      aria-label={backLabel}
      onclick={(e) => {
        e.preventDefault();
        router.back(back);
      }}><Icon name="back" /></a
    >
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h1 class="title">
        {#if zh}<span class="zh" lang="zh-Hant-TW">{zh}</span>{/if}{title}
      </h1>
    </div>
  </div>
</header>

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .back {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    margin-left: -8px;
    border-radius: 50%;
    color: var(--ink-2);
    transition: background-color var(--dur) var(--ease);
  }

  .back:active {
    background: var(--fill);
  }
</style>
