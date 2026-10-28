<script lang="ts">
  // The header of a page under Me: a back button that names where it goes, then the title.
  import BackButton from './BackButton.svelte';

  interface Props {
    title: string;
    zh?: string;
    /** Where back goes when there is no page before this one in the app. */
    back?: string;
  }

  let { title, zh, back = '/me' }: Props = $props();
</script>

<header class="page-head">
  <div>
    <BackButton parent={back} />
    <h1 class="title">
      {#if zh}<span class="zh" lang="zh-Hant-TW">{zh}</span>{/if}{title}
    </h1>
  </div>
</header>
