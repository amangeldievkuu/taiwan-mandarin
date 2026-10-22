<script lang="ts">
  // One navigation, three shapes: a bottom tab bar on phones, an icon rail on tablets and a
  // labeled sidebar on desktops (see app.css breakpoints). A jade highlight slides to the current
  // page; the navigation stays put while pages transition.
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
  const PHONE = ITEMS.filter((i) => i.phone);

  const active = (item: Item) => item.match.includes(router.route.name);
  const railIndex = $derived(ITEMS.findIndex(active));
  const phoneIndex = $derived(PHONE.findIndex(active));
  const due = $derived(store.dueCount);
</script>

<nav class="nav" aria-label="Main" style:--rail-i={railIndex} style:--phone-i={phoneIndex}>
  <a class="brand" href={router.href('/')} onclick={router.link} aria-label="臺灣華語 home">
    <Seal text="華" size={38} />
    <span class="brand-text">
      <span class="brand-zh" lang="zh-Hant-TW">臺灣華語</span>
      <span class="brand-en">Taiwan Mandarin</span>
    </span>
  </a>

  <ul>
    <li
      class="indicator"
      class:off-phone={phoneIndex < 0}
      class:off-rail={railIndex < 0}
      aria-hidden="true"
    ></li>
    {#each ITEMS as item (item.path)}
      <li class="item" class:phone={item.phone}>
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
          {#if item.path === '/study' && due > 0}
            {#key due}<span class="count tabular">{due}</span>{/key}
          {/if}
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
    /* Nearly opaque: page transitions capture the bar without its blur. */
    background: color-mix(in srgb, var(--paper-raised) 94%, transparent);
    backdrop-filter: saturate(160%) blur(18px);
    -webkit-backdrop-filter: saturate(160%) blur(18px);
    border-top: 1px solid var(--rule);
    view-transition-name: nav;
  }

  .brand {
    display: none;
  }

  ul {
    position: relative;
    display: flex;
    justify-content: space-around;
    max-width: 560px;
    margin: 0 auto;
    padding: 0;
    list-style: none;
  }

  .item:not(.phone) {
    display: none;
  }

  .item {
    flex: 1;
  }

  /* The highlight under the current item; slides with a spring. */
  .indicator {
    position: absolute;
    top: 7px;
    left: 0;
    width: 20%;
    height: 32px;
    pointer-events: none;
    transform: translateX(calc(var(--phone-i) * 100%));
    transition:
      transform var(--dur-4) var(--ease-spring),
      opacity var(--dur-2) var(--ease-out);
  }

  .indicator::before {
    content: '';
    position: absolute;
    inset: 0;
    width: 58px;
    margin: 0 auto;
    border-radius: var(--radius-pill);
    background: var(--jade-wash);
  }

  .indicator.off-phone {
    opacity: 0;
  }

  a {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: var(--tabbar-h);
    color: var(--ink-3);
    text-decoration: none;
    transition: color var(--dur) var(--ease);
  }

  a.active {
    color: var(--jade-text);
  }

  .glyph {
    position: relative;
    display: grid;
  }

  a.active .glyph {
    animation: bounce var(--dur-4) var(--ease-spring);
  }

  @keyframes bounce {
    40% {
      transform: translateY(-3px) scale(1.12);
    }
  }

  .dot {
    position: absolute;
    top: -1px;
    right: -3px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--seal);
    box-shadow: 0 0 0 2px var(--paper-raised);
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

  /* ---- Tablet: icon rail ---- */
  @media (min-width: 700px) {
    .nav {
      --item-h: 62px;
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
      transition: transform var(--dur-4) var(--ease-spring);
    }

    .brand:hover {
      transform: rotate(-4deg) scale(1.06);
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

    .item:not(.phone) {
      display: block;
    }

    a {
      height: var(--item-h);
      border-radius: 16px;
    }

    .indicator {
      top: 0;
      left: 10px;
      width: auto;
      right: 10px;
      height: var(--item-h);
      opacity: 1;
      transform: translateY(calc(var(--rail-i) * (var(--item-h) + 4px)));
    }

    .indicator::before {
      width: auto;
      border-radius: 16px;
    }

    .indicator.off-phone {
      opacity: 1;
    }

    .indicator.off-rail {
      opacity: 0;
    }

    @media (hover: hover) {
      a:not(.active):hover {
        color: var(--ink);
        background: var(--fill);
      }
    }
  }

  /* ---- Desktop: labeled sidebar ---- */
  @media (min-width: 1100px) {
    .nav {
      --item-h: 48px;
      align-items: stretch;
      padding: 28px 16px;
      gap: 30px;
    }

    .brand {
      padding: 0 10px;
    }

    .brand:hover {
      transform: none;
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
      font-weight: 700;
      color: var(--ink-3);
      letter-spacing: 0.04em;
    }

    ul {
      padding: 0;
    }

    .indicator {
      left: 0;
      right: 0;
    }

    a {
      flex-direction: row;
      justify-content: flex-start;
      gap: 14px;
      height: var(--item-h);
      padding: 0 12px;
      border-radius: 14px;
    }

    .indicator::before {
      border-radius: 14px;
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
      font-weight: 700;
    }

    .dot {
      display: none;
    }

    .count {
      display: inline;
      margin-left: auto;
      min-width: 26px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      font-size: 12px;
      font-weight: 800;
      text-align: center;
      background: var(--seal);
      color: var(--seal-ink);
      animation: bump var(--dur-4) var(--ease-spring);
    }

    @keyframes bump {
      from {
        transform: scale(0.6);
      }
    }
  }
</style>
