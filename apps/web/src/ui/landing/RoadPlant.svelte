<!--
  The pot at the end of the road, where 墨 is headed: a Taiwan cherry (台灣山櫻花) in a celadon
  pot that grows with the scroll. The trunk, reddish with the bands cherry bark has, rises as far
  as the page has got; every TOCFL level reached puts out a branch hung with deep rose bells, the
  way this cherry flowers on bare wood in late winter; the last one sets a bud, and at the very
  end the crown flowers and a white-eye (綠繡眼) drops in for the nectar. The bells swing a
  little, petals drift down, and a gold seam (金繼) draws itself down the pot alongside. Scroll
  back up and it all folds away again.
-->
<script lang="ts">
  import { taper } from '../../lib/plant-art';

  interface Props {
    /** How far the trunk and the gold have grown, 0–1. */
    grow: number;
    /** Levels reached: one flowering branch each. */
    reached: number;
    total: number;
    bloom: boolean;
  }

  let { grow, reached, total, bloom }: Props = $props();
  const id = $props.id();

  type Pt = { x: number; y: number };
  type Curve = [Pt, Pt, Pt, Pt];

  const BASE = 58;
  const TOP = 9;
  /** How far each branch reaches out, low to high: widest in the middle of the crown. */
  const REACH = [10, 11, 12.5, 13, 12.5, 11, 9, 7];

  /** The trunk: a lean one way and then the other. */
  const FOOT: Curve = [
    { x: 24, y: 58 },
    { x: 21, y: 50 },
    { x: 28, y: 44 },
    { x: 25, y: 35 },
  ];
  const UPPER: Curve = [
    { x: 25, y: 35 },
    { x: 22, y: 26 },
    { x: 20, y: 22 },
    { x: 23.5, y: 9 },
  ];
  const bezier = (c: Curve, t: number): Pt => {
    const u = 1 - t;
    const k = [u ** 3, 3 * u ** 2 * t, 3 * u * t ** 2, t ** 3] as const;
    return {
      x: k[0] * c[0].x + k[1] * c[1].x + k[2] * c[2].x + k[3] * c[3].x,
      y: k[0] * c[0].y + k[1] * c[1].y + k[2] * c[2].y + k[3] * c[3].y,
    };
  };
  const sample = (c: Curve, n: number) => Array.from({ length: n + 1 }, (_, i) => bezier(c, i / n));
  const TRUNK_PTS = [...sample(FOOT, 8), ...sample(UPPER, 8).slice(1)];
  const TRUNK = taper(TRUNK_PTS, 4.4, 1.1);

  /** Where the trunk is at height y (it only ever rises), so a branch starts on it. */
  function trunkX(y: number): number {
    const c = y >= FOOT[3].y ? FOOT : UPPER;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (bezier(c, mid).y > y) lo = mid;
      else hi = mid;
    }
    return bezier(c, lo).x;
  }

  /** Cherry bark's horizontal bands (lenticels), across the trunk. */
  const BANDS = [53, 48.5, 44, 39.5, 34.5, 29.5, 24.5, 19.5].map((y) => {
    const half = 1.9 - ((BASE - y) / (BASE - TOP)) * 1.3;
    const x = trunkX(y);
    return `M${(x - half * 0.55).toFixed(2)} ${y}h${(half * 1.1).toFixed(2)}`;
  });

  interface Bell {
    x: number;
    y: number;
    /** Lean from hanging straight down, in degrees. */
    angle: number;
    /** Length of the flower stalk. */
    stalk: number;
    size: number;
    swing: number;
    delay: number;
  }

  const cluster = (x: number, y: number, size: number, seed: number, n: number): Bell[] =>
    [
      { angle: -20, stalk: 2.4 },
      { angle: 4, stalk: 3.6 },
      { angle: 24, stalk: 2.8 },
    ]
      .slice(0, n)
      .map((b, j) => ({
        x,
        y,
        angle: b.angle + ((seed * 7 + j * 5) % 9) - 4,
        stalk: b.stalk,
        size: size * (j === 1 ? 1 : 0.88),
        swing: 2.6 + ((seed + j) % 4) * 0.35,
        delay: -((seed * 0.7 + j * 0.9) % 3),
      }));

  /** A branch for every level, spaced up the trunk on alternating sides, a cluster of bells
      hanging from its tip and one more part way along. */
  const branches = $derived(
    Array.from({ length: total }, (_, i) => {
      const y = BASE - ((BASE - TOP) * (i + 1)) / (total + 1);
      const x = trunkX(y);
      const side = i % 2 ? -1 : 1;
      const dx = (REACH[i] ?? 7) * side;
      const dy = 4.5 + (i % 3) * 0.7;
      const size = 1.05 - (i / total) * 0.25;
      // Along the branch's gentle curve (a quadratic through a raised elbow).
      const elbow = { x: x + dx * 0.45, y: y - dy * 0.1 };
      const end = { x: x + dx, y: y - dy };
      const at = (t: number): Pt => {
        const u = 1 - t;
        return {
          x: u * u * x + 2 * u * t * elbow.x + t * t * end.x,
          y: u * u * y + 2 * u * t * elbow.y + t * t * end.y,
        };
      };
      const mid = at(0.55);
      return {
        base: { x, y },
        mid,
        outline: taper([0, 0.25, 0.5, 0.75, 1].map(at), 1.9, 0.5),
        bells: [
          ...cluster(end.x, end.y, size, i, 3),
          ...cluster(mid.x, mid.y, size * 0.85, i + 3, 2),
        ],
      };
    }),
  );

  /** The crown that opens at the very end. */
  const CROWN = cluster(23.5, 9.4, 1.1, 11, 3);

  /** Petals that drift down on the wind, more of them as more of the tree flowers. */
  const DRIFT = [
    { x: 32, y: 44, dx: -10, dy: 34, dur: 5.2, delay: 0 },
    { x: 15, y: 34, dx: -7, dy: 43, dur: 6.4, delay: 1.7 },
    { x: 31, y: 25, dx: -12, dy: 52, dur: 6, delay: 3.1 },
    { x: 19, y: 16, dx: -8, dy: 60, dur: 7, delay: 4.4 },
  ];

  /** Where the white-eye perches: on top of the fourth branch, part way out. */
  const perch = $derived(branches[3] ? { x: branches[3].mid.x, y: branches[3].mid.y - 0.5 } : null);

  const PETAL = 'M0-.12C-.48-.22-.62-.78-.3-1-.12-1.1.12-1.1.3-1 .62-.78.48-.22 0-.12Z';
  const POT =
    'M6 59q0-1 1-1h34q1 0 1 1v4q0 1-1 1h-2l-3.6 14.2q-.3.8-1.4.8H14q-1.1 0-1.4-.8L9 64H7q-1 0-1-1Z';
  /** The gold seam down the pot, and the fork off it that draws once the seam gets there. */
  const SEAM = 'M17 58l2.4 3.6-1.6 3.4 3.2 3.8-1.2 3.6 2.6 3.2';
  const FORK = 'M21 68.8l3.4 1.4 1.6 3.4';
  /** How high the trunk shows: it rises with the page. */
  const reveal = $derived(BASE + 2 - (BASE - TOP + 6) * grow);
  /** A rounded tip where the growing trunk stops, so it never looks sawn off. */
  const tip = $derived.by(() => {
    if (reveal <= TOP + 0.5 || reveal >= BASE) return null;
    return { x: trunkX(reveal), y: reveal, r: (4.4 - 3.3 * ((BASE - reveal) / (BASE - TOP))) / 2 };
  });
</script>

<!-- A Taiwan cherry flower: a stalk, a dark red calyx cup and a rose bell that hangs open
     downwards, stamens just showing. Drawn hanging from (0, 0). -->
{#snippet bell(b: Bell, open: boolean)}
  {@const p = b.stalk}
  <g
    class="bell"
    class:out={open}
    style:transform-origin="{b.x}px {b.y}px"
    style:--swing="{b.swing}s"
    style:--delay="{b.delay}s"
  >
    <g transform="translate({b.x} {b.y}) rotate({b.angle}) scale({b.size})">
      <path class="stalk" d="M0 0Q.5 {p * 0.5} 0 {p}" />
      <path
        class="calyx"
        d="M-.4 {p - 0.1}C-.5 {p + 0.6}-.8 {p + 1.2}-.85 {p + 1.6}H.85C.8 {p + 1.2}.5 {p +
          0.6}.4 {p - 0.1}Z"
      />
      <g class="stamens">
        <path d="M-.45 {p + 3.6}l-.15 1.3M0 {p + 3.8}v1.4M.45 {p + 3.6}l.15 1.3" />
        <circle cx="-.6" cy={p + 4.95} r=".16" />
        <circle cx="0" cy={p + 5.25} r=".16" />
        <circle cx=".6" cy={p + 4.95} r=".16" />
      </g>
      <path
        class="petals"
        d="M-.75 {p + 1.3}C-1.8 {p + 1.8}-2.1 {p + 3.4}-1.6 {p + 4.3}Q-.8 {p + 3.9} 0 {p +
          4.4}Q.8 {p + 3.9} 1.6 {p + 4.3}C2.1 {p + 3.4} 1.8 {p + 1.8}.75 {p + 1.3}Z"
        fill="url(#{id}-bell)"
      />
      <path
        class="front"
        d="M-.5 {p + 1.5}C-1.15 {p + 2.2}-1.05 {p + 3.8} 0 {p + 4.55}C1.05 {p + 3.8} 1.15 {p +
          2.2}.5 {p + 1.5}Z"
        fill="url(#{id}-front)"
      />
    </g>
  </g>
{/snippet}

<div class="road-plant" class:bloom style:--grow={grow.toFixed(4)}>
  <svg viewBox="0 0 48 80" aria-hidden="true">
    <defs>
      <linearGradient id="{id}-glaze" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#a9d0bd" />
        <stop offset="0.3" stop-color="#d6ebe0" />
        <stop offset="1" stop-color="#7aae97" />
      </linearGradient>
      <linearGradient id="{id}-gold" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff1b8" />
        <stop offset="0.45" stop-color="#f2c14e" />
        <stop offset="1" stop-color="#b9831a" />
      </linearGradient>
      <!-- Taiwan cherry: deep rose at the cup, brighter at the open mouth. -->
      <linearGradient id="{id}-bell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a8154a" />
        <stop offset="0.55" stop-color="#d93a72" />
        <stop offset="1" stop-color="#ef6f9a" />
      </linearGradient>
      <linearGradient id="{id}-front" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#c4235c" />
        <stop offset="0.6" stop-color="#ec6593" />
        <stop offset="1" stop-color="#f9a6c2" />
      </linearGradient>
      <linearGradient id="{id}-petal" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#c4235c" />
        <stop offset="1" stop-color="#f48db0" />
      </linearGradient>
      <radialGradient id="{id}-haze">
        <stop offset="0" stop-color="#ffb3c9" stop-opacity="0.7" />
        <stop offset="1" stop-color="#ffb3c9" stop-opacity="0" />
      </radialGradient>
      <clipPath id="{id}-pot"><path d={POT} /></clipPath>
      <clipPath id="{id}-grown"><rect x="-10" y={reveal} width="68" height="70" /></clipPath>
    </defs>

    <ellipse
      class="haze"
      cx="24"
      cy="30"
      rx="26"
      ry="27"
      fill="url(#{id}-haze)"
      style:opacity={bloom ? 1 : (reached / total) * 0.45}
    />

    <g class="tree">
      <g clip-path="url(#{id}-grown)">
        <path class="bark" d={TRUNK} />
        <path
          class="bark-light"
          d="M{TRUNK_PTS.map((p) => `${(p.x - 0.5).toFixed(2)} ${p.y.toFixed(2)}`).join(' L')}"
        />
        {#each BANDS as d, i (i)}
          <path class="band" {d} />
        {/each}
      </g>
      {#if tip}
        <circle class="bark-tip" cx={tip.x} cy={tip.y} r={tip.r} />
      {/if}

      {#each branches as b, i (i)}
        <g
          class="branch"
          class:out={i < reached}
          style:transform-origin="{b.base.x}px {b.base.y}px"
        >
          <path class="bark" d={b.outline} />
        </g>
      {/each}
      {#each branches as b, i (i)}
        {#each b.bells as f, j (j)}
          {@render bell(f, i < reached)}
        {/each}
      {/each}

      <g class="bud" class:out={reached >= total}>
        <path class="stalk" d="M23.5 9.4q.4 1.2 0 2.4" />
        <ellipse class="bud-body" cx="23.5" cy="13.4" rx="1.1" ry="1.8" />
      </g>
      {#each CROWN as f, j (j)}
        {@render bell(f, bloom)}
      {/each}

      <!-- 綠繡眼, the white-eye, come for the nectar once the tree is in full flower. -->
      {#if perch}
        <g class="bird" style:transform-origin="{perch.x}px {perch.y}px">
          <g transform="translate({perch.x} {perch.y}) scale(1.05)">
            <path class="feet" d="M-.9-.9-.7 0M.1-.9.3 0" />
            <path class="tail" d="M-2.4-1.5-5-.4-4.6.1-2.2-.9Z" />
            <ellipse
              class="body"
              cx="-.5"
              cy="-2.1"
              rx="2.5"
              ry="1.6"
              transform="rotate(-12 -.5 -2.1)"
            />
            <ellipse class="belly" cx="0" cy="-1.5" rx="1.6" ry=".85" />
            <path class="wing" d="M-2.4-2.6Q-.7-3.5.6-2.3-.7-1.5-2.4-2.6Z" />
            <circle class="head" cx="1.5" cy="-3.5" r="1.3" />
            <circle class="throat" cx="2.1" cy="-2.8" r=".62" />
            <circle class="eye-ring" cx="1.9" cy="-3.75" r=".52" />
            <circle class="eye" cx="1.95" cy="-3.75" r=".26" />
            <path class="beak" d="M2.6-3.75 3.7-3.5 2.6-3.25Z" />
          </g>
        </g>
      {/if}
    </g>

    <ellipse class="shadow" cx="24" cy="79.4" rx="13" ry="1.2" />
    <path class="pot" d={POT} fill="url(#{id}-glaze)" />
    <g clip-path="url(#{id}-pot)">
      <rect class="rim-shade" x="6" y="64" width="36" height="1.6" />
      <ellipse class="shine" cx="15" cy="70" rx="1.2" ry="4.4" />
      {#each [SEAM, FORK] as d, i (i)}
        <path class="seam-glow" class:fork={i} pathLength="1" {d} />
        <path class="seam" class:fork={i} pathLength="1" {d} stroke="url(#{id}-gold)" />
      {/each}
    </g>
    <ellipse class="soil" cx="24" cy="58.4" rx="16" ry="1.1" />

    {#each DRIFT as p, i (i)}
      <g
        class="drift"
        class:falling={bloom || reached > i * 2 + 1}
        style:transform-origin="{p.x}px {p.y}px"
        style:--dx="{p.dx}px"
        style:--dy="{p.dy}px"
        style:animation-duration="{p.dur}s"
        style:animation-delay="{p.delay}s"
      >
        <path
          d={PETAL}
          transform="translate({p.x} {p.y}) rotate({i * 50}) scale(1.8)"
          fill="url(#{id}-petal)"
        />
      </g>
    {/each}
  </svg>
  <p class="count">{reached} of {total}</p>
</div>

<style>
  .road-plant {
    --bark: #6b3a2e;
    --bark-edge: #45231b;
    --bark-light: #a8695a;
    --band: #d3a894;
    display: grid;
    justify-items: center;
    gap: 2px;
  }

  :global(:root[data-theme='dark']) .road-plant {
    --bark: #a0634f;
    --bark-edge: #6b3a2e;
    --bark-light: #d39a85;
    --band: #e8c4b3;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .road-plant {
      --bark: #a0634f;
      --bark-edge: #6b3a2e;
      --bark-light: #d39a85;
      --band: #e8c4b3;
    }
  }

  svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .haze {
    filter: blur(2px);
    transition: opacity 1.2s var(--ease-out);
  }

  /* The whole tree sways a little from the soil. */
  .tree {
    transform-origin: 24px 58px;
    animation: sway 5s ease-in-out infinite alternate;
  }

  @keyframes sway {
    from {
      rotate: -1.4deg;
    }
    to {
      rotate: 1.4deg;
    }
  }

  .bark {
    fill: var(--bark);
    stroke: var(--bark-edge);
    stroke-width: 0.3;
    stroke-linejoin: round;
  }

  .bark-tip {
    fill: var(--bark);
  }

  .bark-light {
    fill: none;
    stroke: var(--bark-light);
    stroke-width: 0.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.6;
  }

  .band {
    fill: none;
    stroke: var(--band);
    stroke-width: 0.35;
    stroke-linecap: round;
    opacity: 0.7;
  }

  /* A branch springs out from the trunk when its level is passed, then its bells open. */
  .branch {
    scale: 0;
    transition: scale 0.35s var(--ease-out);
  }

  .branch.out {
    scale: 1;
    transition: scale 0.6s var(--ease-spring);
  }

  .bell {
    scale: 0;
    transition: scale 0.3s var(--ease-out);
    animation: swing var(--swing, 3s) ease-in-out var(--delay, 0s) infinite alternate;
  }

  .bell.out {
    scale: 1;
    transition: scale 0.8s var(--ease-spring) 0.3s;
  }

  /* Hanging bells swing a little on their stalks. */
  @keyframes swing {
    from {
      rotate: -7deg;
    }
    to {
      rotate: 7deg;
    }
  }

  .stalk {
    fill: none;
    stroke: #7d2338;
    stroke-width: 0.3;
    stroke-linecap: round;
  }

  .calyx {
    fill: #8a1c38;
  }

  .stamens path {
    fill: none;
    stroke: #f6d3df;
    stroke-width: 0.14;
    stroke-linecap: round;
  }

  .stamens circle {
    fill: #f3cf5b;
  }

  .petals {
    stroke: #9c1445;
    stroke-width: 0.08;
  }

  .bud {
    transform-origin: 23.5px 9.4px;
    scale: 0;
    transition: scale 0.8s var(--ease-spring);
  }

  .bud.out {
    scale: 1;
  }

  .bloom .bud {
    scale: 0;
  }

  .bud-body {
    fill: #b31e52;
  }

  /* The white-eye flies in at full bloom and pecks about. */
  .bird {
    opacity: 0;
    scale: 0.4;
    translate: 6px -8px;
    transition:
      opacity 0.3s var(--ease-out),
      scale 0.3s var(--ease-out),
      translate 0.3s var(--ease-out);
  }

  .bloom .bird {
    opacity: 1;
    scale: 1;
    translate: 0 0;
    transition:
      opacity 0.4s var(--ease-out) 0.6s,
      scale 0.7s var(--ease-spring) 0.6s,
      translate 0.7s var(--ease-spring) 0.6s;
    animation: peck 3.2s ease-in-out 1.6s infinite;
  }

  @keyframes peck {
    0%,
    70%,
    100% {
      rotate: 0deg;
    }
    78% {
      rotate: 14deg;
    }
    86% {
      rotate: -4deg;
    }
  }

  .feet {
    fill: none;
    stroke: #4a4a4a;
    stroke-width: 0.25;
    stroke-linecap: round;
  }

  .tail,
  .wing {
    fill: #6f8f2c;
  }

  .body,
  .head {
    fill: #9cbf3e;
  }

  .belly {
    fill: #ece8c4;
  }

  .throat {
    fill: #f2d54b;
  }

  .eye-ring {
    fill: #ffffff;
  }

  .eye {
    fill: #1a1c1e;
  }

  .beak {
    fill: #3d3d3d;
  }

  /* Petals on the wind: they come loose, spin, drift left and fade near the road. */
  .drift {
    opacity: 0;
  }

  .drift.falling {
    animation-name: fall;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
  }

  @keyframes fall {
    0% {
      opacity: 0;
      translate: 0 0;
      rotate: 0deg;
    }
    12% {
      opacity: 0.95;
    }
    50% {
      translate: calc(var(--dx) * 0.4 + 3px) calc(var(--dy) * 0.5);
      rotate: 160deg;
    }
    85% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      translate: var(--dx) var(--dy);
      rotate: 320deg;
    }
  }

  .shadow {
    fill: rgb(0 0 0 / 0.14);
  }

  .pot {
    stroke: rgb(0 0 0 / 0.18);
    stroke-width: 0.6;
  }

  .rim-shade {
    fill: rgb(0 0 0 / 0.1);
  }

  .shine {
    fill: rgb(255 255 255 / 0.35);
  }

  .soil {
    fill: #5a4031;
  }

  .seam,
  .seam-glow {
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1 2;
    stroke-dashoffset: calc(1 - var(--grow, 0));
  }

  /* The fork starts about halfway down the seam. */
  .fork {
    stroke-dashoffset: clamp(0, 1 - (var(--grow, 0) - 0.5) * 2, 1);
  }

  .seam {
    stroke-width: 1.3;
  }

  .seam-glow {
    stroke: rgb(255 214 102 / 0.4);
    stroke-width: 3;
    filter: blur(0.8px);
  }

  /* In bloom, the gold glints. */
  .bloom .seam {
    animation: glint 1.2s ease-in-out 0.4s 2;
  }

  @keyframes glint {
    50% {
      filter: brightness(1.5) drop-shadow(0 0 2px rgb(255 214 102 / 0.9));
    }
  }

  .count {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-3);
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .tree,
    .bell,
    .bloom .bird,
    .drift.falling,
    .bloom .seam {
      animation: none;
    }

    .branch,
    .branch.out,
    .bell,
    .bell.out,
    .bud,
    .bird,
    .bloom .bird,
    .haze {
      transition: none;
    }
  }
</style>
