<script lang="ts">
  // Progress ring: a jade-to-sky stroke that sweeps round as cards get done (from empty each time
  // it appears), and turns gold with a pulse once the value reaches 1.
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { reduced } from '../lib/motion';

  interface Props {
    value: number;
    size?: number;
    stroke?: number;
    label?: string;
    children?: import('svelte').Snippet;
  }

  let { value, size = 120, stroke = 10, label, children }: Props = $props();
  const id = $props.id();
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const clamped = $derived(Math.max(0, Math.min(1, value)));
  const complete = $derived(clamped >= 1);

  const shown = new Tween(0, { duration: () => (reduced() ? 0 : 900), easing: cubicOut });
  $effect(() => {
    shown.target = clamped;
  });
</script>

<div
  class="ring"
  class:complete
  style:width="{size}px"
  style:height="{size}px"
  role="img"
  aria-label={label}
>
  <svg viewBox="0 0 {size} {size}" aria-hidden="true">
    <defs>
      <linearGradient id="{id}-go" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color: var(--jade)" />
        <stop offset="1" style="stop-color: var(--sky)" />
      </linearGradient>
      <linearGradient id="{id}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" style="stop-color: var(--gold)" />
        <stop offset="1" style="stop-color: var(--gold-edge)" />
      </linearGradient>
    </defs>
    <circle cx={size / 2} cy={size / 2} {r} class="track" stroke-width={stroke} />
    <circle
      cx={size / 2}
      cy={size / 2}
      {r}
      class="value"
      stroke="url(#{id}-{complete ? 'gold' : 'go'})"
      stroke-width={stroke}
      stroke-dasharray={c}
      stroke-dashoffset={c * (1 - shown.current)}
      opacity={shown.current > 0.001 ? 1 : 0}
    />
  </svg>
  <div class="center">{@render children?.()}</div>
</div>

<style>
  .ring {
    position: relative;
    flex: none;
  }

  .complete {
    animation: done 700ms var(--ease-spring) 500ms both;
  }

  @keyframes done {
    40% {
      transform: scale(1.06);
    }
  }

  svg {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }

  circle {
    fill: none;
  }

  .track {
    stroke: var(--paper-sunken);
  }

  .value {
    stroke-linecap: round;
  }

  .center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
  }
</style>
