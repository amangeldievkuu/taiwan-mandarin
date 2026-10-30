<script lang="ts">
  // The streak and ink at a glance: a little sprout in a pot with the days beside it (green once
  // you have practiced today, a gold seam when the pot has one), and the ink earned. Both lead to Me.
  import InkDrop from './InkDrop.svelte';
  import Counter from './Counter.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  const streak = $derived(store.streak);
  const seams = $derived(streak.current?.seams.length ?? 0);
</script>

<a
  class="stat-chips"
  href={router.href('/me')}
  onclick={router.link}
  aria-label={t().chips(streak.count, seams, store.xp.total)}
>
  <span
    class="chip plant"
    class:lit={streak.practicedToday}
    class:cracked={streak.crack > 0}
    aria-hidden="true"
  >
    <svg viewBox="0 0 20 20" class="mini-plant">
      <path class="stalk" d="M10 10.5 L10 6" />
      <path class="sprig" d="M10 7.6 C7.6 7.9 5.8 6.4 5.5 4.3 C7.8 4.2 9.6 5.5 10 7.6Z" />
      <path class="sprig" d="M10 6.2 C10.5 3.8 12.5 2.4 14.8 2.6 C14.7 4.9 12.6 6.4 10 6.2Z" />
      <path class="pot" d="M5.4 12.6 L14.6 12.6 L13.4 18.2 L6.6 18.2 Z" />
      <rect class="pot" x="4.4" y="10.2" width="11.2" height="2.6" rx="0.8" />
      {#if seams}<path class="seam" d="M8.6 13 L9.8 15.2 L9.2 17.6" />{/if}
    </svg>
    <strong><Counter value={streak.count} /></strong>
  </span>
  <span class="chip xp" aria-hidden="true">
    {#key store.xp.total}<span class="spark"><InkDrop size={15} /></span>{/key}
    <strong><Counter value={store.xp.total} /></strong>
  </span>
</a>

<style>
  .stat-chips {
    display: inline-flex;
    gap: 6px;
    text-decoration: none;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 38px;
    padding: 0 12px 0 9px;
    border-radius: var(--radius-pill);
    border: 1px solid var(--rule-strong);
    background: var(--paper-raised);
    box-shadow: var(--shadow-1);
    font-size: 16px;
    font-weight: 800;
    transition: transform var(--dur-4) var(--ease-spring);
  }

  .stat-chips:active .chip {
    transform: scale(0.97);
  }

  .mini-plant {
    width: 20px;
    height: 20px;
  }

  .pot {
    fill: var(--paper-sunken);
    stroke: var(--ink-3);
    stroke-width: 1.1;
    stroke-linejoin: round;
  }

  .stalk {
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1.3;
    stroke-linecap: round;
  }

  .sprig {
    fill: var(--ink-3);
    opacity: 0.6;
  }

  .lit .pot {
    fill: #a9d0bd;
    stroke: var(--jade-edge);
  }

  .lit .stalk {
    stroke: #3f8f5a;
  }

  .lit .sprig {
    fill: #4fa865;
    opacity: 1;
  }

  .cracked .pot {
    stroke: var(--ochre);
    stroke-dasharray: 2 1.2;
  }

  .seam {
    fill: none;
    stroke: var(--gold);
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .xp {
    color: var(--gold-deep);
    border-color: color-mix(in oklab, var(--gold) 45%, transparent);
    background: var(--gold-wash);
    box-shadow: 0 1px 2px color-mix(in oklab, var(--gold-edge) 30%, transparent);
  }

  .spark {
    display: inline-block;
    font-size: 15px;
    color: var(--gold);
    text-shadow: 0 0 1px var(--gold-edge);
    animation: drip var(--dur-4) var(--ease-spring);
  }

  /* A new drop of ink falls in. */
  @keyframes drip {
    from {
      transform: translateY(-7px) scale(0.5);
    }
  }
</style>
