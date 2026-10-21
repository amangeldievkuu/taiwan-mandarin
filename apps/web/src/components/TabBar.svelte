<script lang="ts">
  import { store, type Tab } from '../lib/store.svelte';

  const tabs: { id: Tab; label: string; en: string; icon: string }[] = [
    {
      id: 'study',
      label: '學習',
      en: 'Study',
      // stacked cards
      icon: 'M7 4.5h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2ZM8 2h8',
    },
    {
      id: 'words',
      label: '詞彙',
      en: 'Words',
      // list
      icon: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    },
    {
      id: 'settings',
      label: '設定',
      en: 'Settings',
      // sliders
      icon: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
    },
  ];
</script>

<nav class="tabbar" aria-label="Main">
  {#each tabs as tab (tab.id)}
    <button
      type="button"
      class:active={store.tab === tab.id}
      aria-current={store.tab === tab.id ? 'page' : undefined}
      aria-label={tab.en}
      onclick={() => (store.tab = tab.id)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={tab.icon} />
      </svg>
      <span lang="zh-Hant-TW">{tab.label}</span>
    </button>
  {/each}
</nav>

<style>
  .tabbar {
    position: fixed;
    inset: auto 0 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    padding-bottom: var(--safe-bottom);
    background: var(--bar-bg);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border-top: 1px solid var(--separator);
  }

  button {
    flex: 1;
    max-width: 160px;
    height: var(--tabbar-h);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--text-2);
    transition: color var(--dur) var(--ease);
  }

  button.active {
    color: var(--accent);
  }

  svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  span {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }
</style>
