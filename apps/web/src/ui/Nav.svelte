<script lang="ts">
  // One navigation, three shapes: a bottom tab bar on phones, an icon rail on tablets and a
  // labeled sidebar on desktops (see app.css breakpoints).
  import Icon, { type IconName } from './Icon.svelte';
  import Seal from './Seal.svelte';
  import { router, type RouteName } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  interface Item {
    path: string;
    icon: IconName;
    zh: string;
    en: string;
    /** Routes that highlight this item. */
    match: RouteName[];
    /** Shown in the phone tab bar (5 fit comfortably). */
    phone: boolean;
  }

  const ITEMS: Item[] = [
    { path: '/', icon: 'today', zh: '今天', en: 'Today', match: ['today'], phone: true },
    { path: '/study', icon: 'study', zh: '學習', en: 'Study', match: ['study'], phone: true },
    {
      path: '/path',
      icon: 'path',
      zh: '路徑',
      en: 'Path',
      match: ['path', 'level', 'word'],
      phone: false,
    },
    { path: '/read', icon: 'read', zh: '閱讀', en: 'Read', match: ['read', 'reader'], phone: true },
    { path: '/dict', icon: 'dict', zh: '字典', en: 'Dictionary', match: ['dict'], phone: true },
    { path: '/talk', icon: 'talk', zh: '對話', en: 'Talk', match: ['talk'], phone: false },
    { path: '/me', icon: 'me', zh: '我', en: 'Me', match: ['me'], phone: true },
  ];

  const active = (item: Item) => item.match.includes(router.route.name);
  const due = $derived(store.dueCount);
</script>

<nav class="nav" aria-label="Main">
  <a class="brand" href={router.href('/')} onclick={router.link} aria-label="臺灣華語 home">
    <Seal text="華" size={36} />
    <span class="brand-text">
      <span class="brand-zh" lang="zh-Hant-TW">臺灣華語</span>
      <span class="brand-en">Taiwan Mandarin</span>
    </span>
  </a>

  <ul>
    {#each ITEMS as item (item.path)}
      <li class:phone={item.phone}>
        <a
          href={router.href(item.path)}
          onclick={router.link}
          class:active={active(item)}
          aria-current={active(item) ? 'page' : undefined}
          title={item.en}
        >
          <span class="glyph">
            <Icon name={item.icon} size={24} />
            {#if item.path === '/study' && due > 0}<span class="dot" aria-label="{due} due"
              ></span>{/if}
          </span>
          <span class="label">
            <span class="zh" lang="zh-Hant-TW">{item.zh}</span>
            <span class="en">{item.en}</span>
          </span>
          {#if item.path === '/study' && due > 0}<span class="count tabular">{due}</span>{/if}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  /* ---- Phone: bottom tab bar ---- */
  .nav {
    position: fixed;
    inset: auto 0 0;
    z-index: 20;
    padding-bottom: var(--safe-bottom);
    background: color-mix(in srgb, var(--paper) 86%, transparent);
    backdrop-filter: saturate(160%) blur(18px);
    -webkit-backdrop-filter: saturate(160%) blur(18px);
    border-top: 1px solid var(--rule);
  }

  .brand {
    display: none;
  }

  ul {
    display: flex;
    justify-content: space-around;
    max-width: 560px;
    margin: 0 auto;
    padding: 0;
    list-style: none;
  }

  li:not(.phone) {
    display: none;
  }

  li {
    flex: 1;
  }

  a {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    height: var(--tabbar-h);
    color: var(--ink-3);
    text-decoration: none;
    transition: color var(--dur) var(--ease);
  }

  a.active {
    color: var(--ink);
  }

  .glyph {
    position: relative;
    display: grid;
  }

  .dot {
    position: absolute;
    top: -1px;
    right: -3px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--seal);
    box-shadow: 0 0 0 2px var(--paper);
  }

  .label {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }

  .zh {
    font-family: var(--font-kai);
    font-size: 13px;
  }

  .en,
  .count {
    display: none;
  }

  a.active .zh {
    color: var(--seal);
  }

  /* ---- Tablet: icon rail ---- */
  @media (min-width: 700px) {
    .nav {
      inset: 0 auto 0 0;
      width: var(--rail-w);
      padding: calc(var(--safe-top) + 18px) 0 18px;
      border-top: 0;
      border-right: 1px solid var(--rule);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 22px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
    }

    .brand-text {
      display: none;
    }

    ul {
      flex-direction: column;
      gap: 4px;
      width: 100%;
      padding: 0 10px;
    }

    li:not(.phone) {
      display: block;
    }

    a {
      height: 62px;
      border-radius: 14px;
    }

    a.active {
      background: var(--fill);
    }

    @media (hover: hover) {
      a:hover {
        color: var(--ink);
      }
    }
  }

  /* ---- Desktop: labeled sidebar ---- */
  @media (min-width: 1100px) {
    .nav {
      align-items: stretch;
      padding: 28px 16px;
      gap: 30px;
    }

    .brand {
      padding: 0 10px;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }

    .brand-zh {
      font-family: var(--font-kai);
      font-size: 19px;
    }

    .brand-en {
      font-size: 12px;
      color: var(--ink-3);
      letter-spacing: 0.04em;
    }

    ul {
      padding: 0;
    }

    a {
      flex-direction: row;
      justify-content: flex-start;
      gap: 14px;
      height: 46px;
      padding: 0 12px;
      border-radius: 12px;
    }

    .label {
      flex-direction: row;
      align-items: baseline;
      gap: 8px;
    }

    .zh {
      font-size: 17px;
      width: 2.2em;
    }

    .en {
      display: inline;
      font-size: 15px;
      font-weight: 500;
    }

    .dot {
      display: none;
    }

    .count {
      display: inline;
      margin-left: auto;
      min-width: 24px;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      background: var(--seal);
      color: var(--seal-ink);
    }
  }
</style>
