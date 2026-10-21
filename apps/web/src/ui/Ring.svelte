<script lang="ts">
  // Progress ring, drawn like a brush circle (ensō) that closes as the value reaches 1.
  interface Props {
    value: number;
    size?: number;
    stroke?: number;
    color?: string;
    label?: string;
    children?: import('svelte').Snippet;
  }

  let { value, size = 120, stroke = 8, color = 'var(--seal)', label, children }: Props = $props();
  const r = $derived((size - stroke) / 2);
  const c = $derived(2 * Math.PI * r);
  const clamped = $derived(Math.max(0, Math.min(1, value)));
</script>

<div class="ring" style:width="{size}px" style:height="{size}px" role="img" aria-label={label}>
  <svg viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} {r} class="track" stroke-width={stroke} />
    <circle
      cx={size / 2}
      cy={size / 2}
      {r}
      class="value"
      stroke={color}
      stroke-width={stroke}
      stroke-dasharray={c}
      stroke-dashoffset={c * (1 - clamped)}
    />
  </svg>
  <div class="center">{@render children?.()}</div>
</div>

<style>
  .ring {
    position: relative;
    flex: none;
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
    stroke: var(--rule);
  }

  .value {
    stroke-linecap: round;
    transition: stroke-dashoffset 700ms var(--ease);
  }

  .center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    text-align: center;
  }
</style>
