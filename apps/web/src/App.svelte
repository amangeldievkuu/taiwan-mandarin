<script lang="ts">
  import Settings from './components/Settings.svelte';
  import Study from './components/Study.svelte';
  import TabBar from './components/TabBar.svelte';
  import Words from './components/Words.svelte';
  import { onMount } from 'svelte';
  import { store } from './lib/store.svelte';

  onMount(() => {
    void store.init();
    return store.watchVisibility();
  });

  $effect(() => {
    void store.tab;
    window.scrollTo(0, 0);
  });

  $effect(() => {
    const root = document.documentElement;
    root.dataset.glyph = store.settings.glyphStyle;
    // Page language follows the meaning language; Chinese text is tagged zh-Hant-TW itself.
    root.lang = store.settings.meaning;
    // Study sits on plain white; lists use the grouped gray like iOS.
    root.dataset.surface = store.tab === 'study' ? 'plain' : 'grouped';
  });
</script>

{#if store.ready}
  <main>
    {#if store.tab === 'study'}
      <Study />
    {:else if store.tab === 'words'}
      <Words />
    {:else}
      <Settings />
    {/if}
  </main>
  <TabBar />
{/if}
