<script lang="ts">
  // Reviews per day for the last 30 days: one series of thin bars, today in vermilion.
  // Hover or tap a day for its again / hard / good / easy breakdown; a table carries the same data
  // for screen readers.
  import type { DayStats } from '../lib/stats';

  interface Props {
    days: DayStats[];
  }

  let { days }: Props = $props();

  const W = 600;
  const H = 160;
  const PAD = { top: 12, right: 8, bottom: 22, left: 30 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = $derived(Math.max(4, ...days.map((d) => d.total)));
  /** A round axis maximum: 4, 5, 10, 20, 25, 50… */
  const top = $derived.by(() => {
    const steps = [4, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    return steps.find((s) => s >= max) ?? Math.ceil(max / 1000) * 1000;
  });
  const slot = $derived(plotW / Math.max(1, days.length));
  const barW = $derived(Math.max(3, Math.min(14, slot - 2)));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  let hover = $state<number | null>(null);
  const active = $derived(hover === null ? null : days[hover]);

  const label = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  /** Bar path with 4px rounded top, square base on the baseline. */
  function bar(x: number, h: number): string {
    if (h <= 0) return '';
    const r = Math.min(4, barW / 2, h);
    const yTop = PAD.top + plotH - h;
    const base = PAD.top + plotH;
    return `M${x},${base}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + barW - r}Q${x + barW},${yTop} ${x + barW},${yTop + r}V${base}Z`;
  }
</script>

<div class="chart">
  <svg
    viewBox="0 0 {W} {H}"
    role="img"
    aria-label="Reviews per day, last 30 days"
    onpointerleave={() => (hover = null)}
  >
    {#each [0, top / 2, top] as tick (tick)}
      <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
      <text class="axis" x={PAD.left - 6} y={y(tick)} dy="0.32em" text-anchor="end">{tick}</text>
    {/each}

    {#each days as day, i (day.date)}
      {@const x = PAD.left + i * slot + (slot - barW) / 2}
      {@const today = i === days.length - 1}
      <path
        class="bar"
        class:today
        class:dim={hover !== null && hover !== i}
        d={bar(x, (day.total / top) * plotH)}
      />
      <!-- Hit target taller and wider than the bar -->
      <rect
        class="hit"
        x={PAD.left + i * slot}
        y={PAD.top}
        width={slot}
        height={plotH}
        role="presentation"
        onpointerenter={() => (hover = i)}
        onpointerdown={() => (hover = i)}
      />
    {/each}

    {#each [0, Math.floor((days.length - 1) / 2), days.length - 1] as i (i)}
      {#if days[i]}
        <text
          class="axis"
          x={PAD.left + i * slot + slot / 2}
          y={H - 4}
          text-anchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'}
        >
          {i === days.length - 1 ? 'Today' : label(days[i].date)}
        </text>
      {/if}
    {/each}
  </svg>

  {#if active && hover !== null}
    <div
      class="tip sheet"
      style:left="{Math.min(84, Math.max(16, ((PAD.left + hover * slot + slot / 2) / W) * 100))}%"
    >
      <strong>{hover === days.length - 1 ? 'Today' : label(active.date)}</strong>
      <span class="tabular">{active.total} reviews</span>
      {#if active.total}
        <span class="breakdown tabular">
          <span><i style:background="var(--again)"></i>Again {active.again}</span>
          <span><i style:background="var(--hard)"></i>Hard {active.hard}</span>
          <span><i style:background="var(--good)"></i>Good {active.good}</span>
          <span><i style:background="var(--easy)"></i>Easy {active.easy}</span>
        </span>
      {/if}
    </div>
  {/if}

  <table class="visually-hidden">
    <caption>Reviews per day</caption>
    <thead
      ><tr><th>Day</th><th>Total</th><th>Again</th><th>Hard</th><th>Good</th><th>Easy</th></tr
      ></thead
    >
    <tbody>
      {#each days as d (d.date)}
        <tr
          ><td>{d.date}</td><td>{d.total}</td><td>{d.again}</td><td>{d.hard}</td><td>{d.good}</td
          ><td>{d.easy}</td></tr
        >
      {/each}
    </tbody>
  </table>
</div>

<style>
  .chart {
    position: relative;
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    touch-action: pan-y;
  }

  .grid {
    stroke: var(--rule);
    stroke-width: 1;
  }

  .axis {
    font-size: 10px;
    fill: var(--ink-3);
    font-variant-numeric: tabular-nums;
  }

  .bar {
    fill: var(--ink-2);
    transition: opacity var(--dur) var(--ease);
  }

  .bar.today {
    fill: var(--seal);
  }

  .bar.dim {
    opacity: 0.35;
  }

  .hit {
    fill: transparent;
  }

  .tip {
    position: absolute;
    top: -8px;
    transform: translate(-50%, -100%);
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 140px;
    padding: 8px 10px;
    border-radius: 10px;
    font-size: 13px;
    pointer-events: none;
    z-index: 2;
  }

  .tip strong {
    font-size: 13px;
  }

  .breakdown {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 10px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--ink-2);
  }

  .breakdown i {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 4px;
    border-radius: 2px;
  }
</style>
