<script lang="ts">
  // One navigation, three shapes: a bottom tab bar on phones, an icon rail on tablets and a
  // labeled sidebar on desktops (see app.css breakpoints). A jade highlight slides to the current
  // page; the navigation stays put while pages transition. On a phone the tab bar steps aside
  // while the keyboard is up, so it never sits on top of what is being typed.
  import { onMount } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import Seal from './Seal.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { ME_ROUTES, router, type RouteName } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  interface Item {
    path: string;
    icon: IconName;
    zh: string;
    /** Its name in the learner's language. */
    name: RouteName;
    /** Routes that highlight this item. */
    match: RouteName[];
    /** Shown in the phone tab bar (six fit, down to a 320px screen). */
    phone: boolean;
  }

  const ITEMS: Item[] = [
    { path: '/', icon: 'today', zh: '今天', name: 'today', match: ['today'], phone: true },
    { path: '/study', icon: 'study', zh: '學習', name: 'study', match: ['study'], phone: true },
    {
      path: '/path',
      icon: 'path',
      zh: '路徑',
      name: 'path',
      match: ['path', 'level', 'word'],
      phone: false,
    },
    { path: '/talk', icon: 'talk', zh: '對話', name: 'talk', match: ['talk'], phone: true },
    {
      path: '/read',
      icon: 'read',
      zh: '閱讀',
      name: 'read',
      match: ['read', 'reader'],
      phone: true,
    },
    { path: '/dict', icon: 'dict', zh: '字典', name: 'dict', match: ['dict'], phone: true },
    { path: '/me', icon: 'me', zh: '我', name: 'me', match: ME_ROUTES, phone: true },
  ];
  const PHONE = ITEMS.filter((i) => i.phone);

  const active = (item: Item) => item.match.includes(router.route.name);
  const railIndex = $derived(ITEMS.findIndex(active));
  const phoneIndex = $derived(PHONE.findIndex(active));

  // Pages without a phone tab (the path, a level, a word) stay under the tab they were reached
  // from, like a stack in that tab; reached directly, the path and its levels belong to Today.
  const TODAY = PHONE.findIndex((i) => i.path === '/');
  let section = $state(-1);
  $effect(() => {
    if (phoneIndex >= 0) section = phoneIndex;
  });
  const phoneShown = $derived(
    phoneIndex >= 0
      ? phoneIndex
      : section >= 0
        ? section
        : ['path', 'level'].includes(router.route.name)
          ? TODAY
          : -1,
  );
  const due = $derived(store.dueCount);

  // Typing on a phone: <html data-typing> takes the tab bar away (app.css sets --tabbar-h to 0,
  // so everything docked above it drops down too) until the field loses focus.
  onMount(() => {
    const root = document.documentElement;
    const phone = matchMedia('(max-width: 699px)');
    const typing = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement &&
          !['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color'].includes(
            el.type,
          )));
    const update = () => {
      if (phone.matches && typing(document.activeElement)) root.dataset['typing'] = '';
      else delete root.dataset['typing'];
    };
    // focusout fires before the next field's focusin: wait a tick so moving between fields
    // doesn't flash the bar.
    const later = () => setTimeout(update, 0);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', later);
    phone.addEventListener('change', update);
    return () => {
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', later);
      phone.removeEventListener('change', update);
      delete root.dataset['typing'];
    };
  });
</script>

<nav
  class="nav"
  aria-label={t().nav.main}
  style:--rail-i={railIndex}
  style:--phone-i={phoneShown}
  style:--phone-n={PHONE.length}
>
  <a class="brand" href={router.href('/')} onclick={router.link} aria-label={t().nav.home}>
    <Seal text="華" size={38} />
    <span class="brand-text">
      <span class="brand-zh" lang="zh-Hant-TW">臺灣華語</span>
      <span class="brand-en">{t().app.name}</span>
    </span>
  </a>

  <ul>
    <li
      class="indicator"
      class:off-phone={phoneShown < 0}
      class:off-rail={railIndex < 0}
      aria-hidden="true"
    ></li>
    {#each ITEMS as item (item.path)}
      <li class="item" class:phone={item.phone}>
        <a
          href={router.href(item.path)}
          onclick={router.link}
          class:active={active(item)}
          class:section={phoneIndex < 0 && item.phone && PHONE.indexOf(item) === phoneShown}
          aria-current={active(item) ? 'page' : undefined}
          title={t().titles[item.name]}
        >
          <span class="glyph">
            <Icon name={item.icon} size={24} />
            {#if item.path === '/study' && due > 0}<span class="dot" aria-label={t().nav.due(due)}
              ></span>{/if}
          </span>
          <span class="label">
            <span class="zh" lang="zh-Hant-TW">{item.zh}</span>
            <span class="en">{t().titles[item.name]}</span>
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
    transition:
      opacity var(--dur-1) var(--ease-out),
      visibility 0s;
  }

  /* Typing: --tabbar-h is 0 then (app.css), so the bar has no height to slide by; it fades out
     and is hidden, and comes back the moment the field is left. */
  :global(:root[data-typing]) .nav {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--dur-1) var(--ease-out),
      visibility 0s var(--dur-1);
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
    width: calc(100% / var(--phone-n));
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
    width: min(56px, calc(100% - 6px));
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

  a.active,
  a.section {
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

    a.section:not(.active) {
      color: var(--ink-3);
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
