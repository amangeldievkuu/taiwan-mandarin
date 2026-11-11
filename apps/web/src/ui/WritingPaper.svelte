<script lang="ts" module>
  /** Writing paper, from what ink has unlocked: 米字格, 九宮格, or 宣紙 with the 米 lines. */
  const GRID = {
    plain: 'M120 0v240M0 120h240M0 0l240 240M240 0L0 240',
    nine: 'M80 0v240M160 0v240M0 80h240M0 160h240',
    xuan: 'M120 0v240M0 120h240M0 0l240 240M240 0L0 240',
  } as const;
</script>

<script lang="ts">
  // A sheet to write one character on, ruled as the learner's chosen paper. What is drawn on it
  // (hanzi-writer's own <svg>) is the caller's.
  import type { Snippet } from 'svelte';
  import { store } from '../lib/store.svelte';

  interface Props {
    /** Width and height of the writing area, in px. */
    size: number;
    /** A quiz is going on: the edge turns vermilion. */
    active?: boolean;
    /** Its view-transition-name while it moves, if any. */
    name?: string | null;
    children: Snippet;
  }

  let { size, active = false, name = null, children }: Props = $props();
</script>

<div
  class="paper paper-{store.looks.paper}"
  class:active
  style:--size="{size}px"
  style:view-transition-name={name}
>
  <svg class="grid" viewBox="0 0 240 240" aria-hidden="true">
    <path d={GRID[store.looks.paper]} vector-effect="non-scaling-stroke" />
  </svg>
  {@render children()}
</div>

<style>
  .paper {
    position: relative;
    flex: none;
    width: calc(var(--size) + 2px);
    height: calc(var(--size) + 2px);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    touch-action: none;
    transition: border-color var(--dur) var(--ease);
  }

  .grid {
    position: absolute;
    inset: 0;
    fill: none;
    stroke: var(--rule);
    stroke-width: 1;
    stroke-dasharray: 4 5;
  }

  /* 九宮格: nine squares, ruled in faint vermilion like a copybook. */
  .paper-nine .grid {
    stroke: color-mix(in srgb, var(--seal) 30%, transparent);
    stroke-dasharray: none;
  }

  /* 宣紙: warm rice paper with a few fibres in it. */
  .paper-xuan {
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='f'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.006 0.05' numOctaves='3' seed='7' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.45 0 0 0 0 0.36 0 0 0 0 0.22 0 0 0 0.8 -0.45'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23f)'/%3E%3C/svg%3E"),
      color-mix(in srgb, #e9d6ad 32%, var(--paper));
  }

  .active {
    border-color: color-mix(in srgb, var(--seal) 50%, transparent);
  }
</style>
