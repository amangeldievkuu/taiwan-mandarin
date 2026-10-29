<script lang="ts">
  // The one back button: it says where it goes. Back to the page you came from when that was in
  // the app ("‹ Today"); otherwise up to the page's parent ("‹ Path"), as after opening a link.
  import Icon from './Icon.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { routeTitle } from '../lib/titles';

  interface Props {
    /** Where back goes when there is no page before this one in the app. */
    parent: string;
    /** Only show when there is a page to go back to (for top-level pages). */
    optional?: boolean;
  }

  let { parent, optional = false }: Props = $props();

  const target = $derived(router.previous ?? router.resolve(parent));
  const title = $derived(routeTitle(target));
  const visible = $derived(!optional || router.prev !== null);

  function onclick(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    router.back(parent);
  }
</script>

{#if visible}
  <a class="back" href={router.href(router.prev ?? parent)} {onclick}>
    <Icon name="back" size={20} />
    <span class="visually-hidden">{t().misc.backTo}</span>
    <span class="label" class:hanzi={!!title.lang} lang={title.lang}>{title.text}</span>
  </a>
{/if}

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-height: 44px;
    max-width: min(70vw, 360px);
    margin: -8px 0 4px -10px;
    padding: 0 12px 0 4px;
    border-radius: var(--radius-pill);
    color: var(--jade-text);
    font-size: 16px;
    font-weight: 700;
    text-decoration: none;
    transition: background-color var(--dur) var(--ease);
  }

  .back:active {
    background: var(--jade-wash);
  }

  @media (hover: hover) {
    .back:hover {
      background: var(--jade-wash);
    }
  }

  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .label.hanzi {
    font-size: 18px;
  }
</style>
