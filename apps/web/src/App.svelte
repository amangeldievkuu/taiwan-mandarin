<script lang="ts">
  import { onMount } from 'svelte';
  import About from './routes/About.svelte';
  import Account from './routes/Account.svelte';
  import Dict from './routes/Dict.svelte';
  import Garden from './routes/Garden.svelte';
  import Level from './routes/Level.svelte';
  import Levels from './routes/Levels.svelte';
  import Me from './routes/Me.svelte';
  import Settings from './routes/Settings.svelte';
  import Path from './routes/Path.svelte';
  import Read from './routes/Read.svelte';
  import ReaderView from './routes/ReaderView.svelte';
  import Study from './routes/Study.svelte';
  import Talk from './routes/Talk.svelte';
  import Today from './routes/Today.svelte';
  import Welcome from './routes/Welcome.svelte';
  import WordPage from './routes/WordPage.svelte';
  import Celebrations from './ui/Celebrations.svelte';
  import LookupSheet from './ui/LookupSheet.svelte';
  import Nav from './ui/Nav.svelte';
  import Seal from './ui/Seal.svelte';
  import UpdatePrompt from './ui/UpdatePrompt.svelte';
  import { feedback } from './lib/feedback.svelte';
  import { pwa } from './lib/pwa.svelte';
  import { router, viewKey } from './lib/router.svelte';
  import { store } from './lib/store.svelte';
  import { account, rememberedUser } from './lib/sync.svelte';
  import { toasts } from './lib/toast.svelte';
  import { shouldWelcome, wasWelcomed } from './lib/welcome';

  /** The welcome page has no navigation and no rail: it is the page before the app. */
  const bare = $derived(router.route.name === 'welcome');

  onMount(() => {
    void store.init().then(() => {
      // Someone who has never used the app here lands on the welcome page first.
      if (
        router.route.name === 'today' &&
        shouldWelcome({
          cards: Object.keys(store.cards).length,
          deck: store.deck.length,
          user: rememberedUser() !== null,
          welcomed: wasWelcomed(),
        })
      ) {
        router.go('/welcome', { replace: true });
      }
      return account.init();
    });
    pwa.start(() =>
      toasts.show({
        kind: 'info',
        title: 'Ready to work offline',
        body: 'Words you open from now on stay available without a connection.',
      }),
    );
    const stopFeedback = feedback.init();
    const stopWatching = store.watchVisibility();
    return () => {
      stopFeedback();
      stopWatching();
    };
  });

  /** The browser chrome's colour (status bar, title bar): --paper in each theme. */
  const THEME_COLOR = { light: '#ffffff', dark: '#0f1012' } as const;

  $effect(() => {
    const root = document.documentElement;
    const theme = store.settings.theme;
    root.dataset.glyph = store.settings.glyphStyle;
    if (theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = theme;
    // A forced theme recolours the chrome too; "auto" leaves each meta on its own scheme.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const own = meta.media.includes('dark') ? 'dark' : 'light';
      meta.content = THEME_COLOR[theme === 'auto' ? own : theme];
    }
  });

  // Keyboard navigation (desktop): g then t/s/p/c/r/d/m.
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
      const to = {
        t: '/',
        s: '/study',
        p: '/path',
        c: '/talk',
        r: '/read',
        d: '/dict',
        m: '/me',
      }[e.key];
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
  {#if !bare}<Nav />{/if}
  <main class:bare>
    {#key viewKey(router.route)}
      <div class="view">
        {#if router.route.name === 'welcome'}
          <Welcome />
        {:else if router.route.name === 'today'}
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
        {:else if router.route.name === 'me-account'}
          <Account />
        {:else if router.route.name === 'me-settings'}
          <Settings />
        {:else if router.route.name === 'me-garden'}
          <Garden />
        {:else if router.route.name === 'me-levels'}
          <Levels />
        {:else if router.route.name === 'me-about'}
          <About />
        {:else}
          <Me />
        {/if}
      </div>
    {/key}
  </main>
  <LookupSheet />
  <Celebrations />
  <UpdatePrompt />
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

  main.bare {
    margin-left: 0;
  }

  /* Without the View Transitions API, pages still fade up into place. */
  @supports not (view-transition-name: none) {
    .view {
      animation: enter var(--dur-3) var(--ease-out);
    }
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(8px);
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
