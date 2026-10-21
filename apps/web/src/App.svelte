<script lang="ts">
  import { onMount } from 'svelte';
  import Dict from './routes/Dict.svelte';
  import Level from './routes/Level.svelte';
  import Me from './routes/Me.svelte';
  import Path from './routes/Path.svelte';
  import Read from './routes/Read.svelte';
  import ReaderView from './routes/ReaderView.svelte';
  import Study from './routes/Study.svelte';
  import Talk from './routes/Talk.svelte';
  import Today from './routes/Today.svelte';
  import WordPage from './routes/WordPage.svelte';
  import LookupSheet from './ui/LookupSheet.svelte';
  import Nav from './ui/Nav.svelte';
  import Seal from './ui/Seal.svelte';
  import { router } from './lib/router.svelte';
  import { store } from './lib/store.svelte';
  import { account } from './lib/sync.svelte';

  onMount(() => {
    void store.init().then(() => account.init());
    return store.watchVisibility();
  });

  $effect(() => {
    const root = document.documentElement;
    root.dataset.glyph = store.settings.glyphStyle;
    if (store.settings.theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = store.settings.theme;
  });

  // Keyboard navigation (desktop): g then t/s/p/r/d/m.
  let pendingG = false;
  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (
      target?.closest('input, textarea, select, [contenteditable]') ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    if (pendingG) {
      pendingG = false;
      const to = { t: '/', s: '/study', p: '/path', r: '/read', d: '/dict', m: '/me' }[e.key];
      if (to) {
        e.preventDefault();
        router.go(to);
      }
      return;
    }
    if (e.key === 'g') {
      pendingG = true;
      setTimeout(() => (pendingG = false), 1200);
    } else if (e.key === '/' && router.route.name !== 'study') {
      e.preventDefault();
      router.go('/dict');
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if store.ready}
  <Nav />
  <main>
    {#key router.route.name + (router.route.params.id ?? router.route.params.level ?? '')}
      <div class="view">
        {#if router.route.name === 'today'}
          <Today />
        {:else if router.route.name === 'study'}
          <Study />
        {:else if router.route.name === 'path'}
          <Path />
        {:else if router.route.name === 'level'}
          <Level level={router.route.params.level ?? 'N1'} />
        {:else if router.route.name === 'word'}
          <WordPage id={router.route.params.id ?? ''} />
        {:else if router.route.name === 'read'}
          <Read />
        {:else if router.route.name === 'reader'}
          <ReaderView id={router.route.params.id ?? ''} />
        {:else if router.route.name === 'dict'}
          <Dict />
        {:else if router.route.name === 'talk'}
          <Talk />
        {:else}
          <Me />
        {/if}
      </div>
    {/key}
  </main>
  <LookupSheet />
{:else}
  <div class="splash">
    <Seal text="華" size={72} />
    {#if store.error}
      <p>Couldn't load the word lists.<br /><small>{store.error}</small></p>
      <button class="btn quiet" type="button" onclick={() => location.reload()}>Try again</button>
    {/if}
  </div>
{/if}

<style>
  main {
    margin-left: var(--rail-w);
    min-height: 100dvh;
  }

  .view {
    animation: enter 260ms var(--ease);
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  .splash {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 20px;
    min-height: 100dvh;
    text-align: center;
    color: var(--ink-2);
  }

  .splash :global(.seal) {
    animation: breathe 1.6s var(--ease) infinite alternate;
  }

  @keyframes breathe {
    to {
      opacity: 0.55;
    }
  }
</style>
