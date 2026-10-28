<script lang="ts">
  // The streak as a plum tree (梅) in a celadon pot: it grows with every day practiced, buds at
  // 30 days and blooms at 100. Every mended gap is a gold seam on the pot (金繼). While days can
  // still be mended the pot shows an open crack and the leaves droop until you come back. Before
  // the first practice it is an unglazed pot with a seed in it.
  import type { Bowl, Seam } from '@taiwan-mandarin/shared';
  import {
    POT_BODY,
    POT_RIM,
    SOIL,
    leafPath,
    plantShape,
    seamKey,
    seamPath,
    visibleSeams,
  } from '../lib/plant-art';

  interface Props {
    bowl: Bowl | null;
    /** Days missed so far that can still be mended. */
    crack?: number;
    /** A seam mended just now: it draws itself in. */
    fresh?: Seam | null;
    size?: number;
    label?: string;
    /** Sway in the breeze and, with flowers out, let petals drift down. For a plant shown on its
        own; a garden of them stays still. */
    lively?: boolean;
  }

  let { bowl, crack = 0, fresh = null, size = 120, label, lively = false }: Props = $props();
  const id = $props.id();
  const plant = $derived(plantShape(bowl?.start ?? '', bowl?.days ?? 0));
  const inBloom = $derived((bowl?.days ?? 0) >= 100);
  const seams = $derived(bowl ? visibleSeams(bowl) : []);
  const crackSeed = $derived(bowl ? `crack:${bowl.end}` : '');
  const PETALS = [0, 72, 144, 216, 288];
  const STAMENS = Array.from({ length: 10 }, (_, i) => i * 36 + 18);
  /** A rounded plum petal from the flower's heart, pointing up, 1 long. */
  const PETAL = 'M0-.12C-.48-.22-.62-.78-.3-1-.12-1.1.12-1.1.3-1 .62-.78.48-.22 0-.12Z';
  /** The dark red sepals that show between plum petals. */
  const SEPAL = 'M0-.1C-.22-.2-.24-.52 0-.66.24-.52.22-.2 0-.1Z';
  /** Moss tufts and a pebble round the foot of a tree. */
  const MOSS = [
    { cx: 51, cy: 71.9, rx: 4.6, ry: 1.5 },
    { cx: 67, cy: 72.4, rx: 5.4, ry: 1.6 },
    { cx: 74.5, cy: 72, rx: 2.6, ry: 1 },
  ];

  /** A soft pink glow behind the flowers. */
  const haze = $derived.by(() => {
    const flowers = plant.blossoms;
    if (!flowers.length) return null;
    const xs = flowers.map((f) => f.x);
    const ys = flowers.map((f) => f.y);
    return {
      cx: xs.reduce((a, b) => a + b, 0) / xs.length,
      cy: ys.reduce((a, b) => a + b, 0) / ys.length,
      rx: Math.max(16, (Math.max(...xs) - Math.min(...xs)) / 2 + 12),
      ry: Math.max(14, (Math.max(...ys) - Math.min(...ys)) / 2 + 12),
    };
  });
  /** Petals that come loose from the first few flowers and drift down to the soil. */
  const drift = $derived(
    plant.blossoms.slice(0, 4).map((f, i) => ({
      x: f.x,
      y: f.y,
      dx: -5 - i * 3,
      dy: Math.max(6, SOIL.cy - f.y - 1),
      dur: 5 + i * 0.8,
      delay: i * 1.6,
      turn: i * 70,
    })),
  );
  /** Petals already fallen, lying on the soil. */
  const FALLEN = [
    { x: 47, y: 72.3, turn: 30 },
    { x: 68, y: 72.9, turn: -50 },
    { x: 74.5, y: 72.1, turn: 105 },
  ];
</script>

<svg
  class="plant-art"
  class:clay={!bowl}
  class:wilt={crack > 0}
  viewBox="0 0 120 120"
  width={size}
  height={size}
  role="img"
  aria-label={label}
>
  <defs>
    <linearGradient id="{id}-glaze" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" class="glaze-mid" />
      <stop offset="0.3" class="glaze-light" />
      <stop offset="1" class="glaze-dark" />
    </linearGradient>
    <linearGradient id="{id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff1b8" />
      <stop offset="0.45" stop-color="#f2c14e" />
      <stop offset="1" stop-color="#b9831a" />
    </linearGradient>
    <!-- Plum petals: blushing pink at the heart, nearly white at the rim. -->
    <linearGradient id="{id}-petal" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#f08aa5" />
      <stop offset="0.5" stop-color="#fbd3de" />
      <stop offset="1" stop-color="#fffafb" />
    </linearGradient>
    <radialGradient id="{id}-blush">
      <stop offset="0" stop-color="#e2607e" stop-opacity="0.55" />
      <stop offset="1" stop-color="#e2607e" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="{id}-haze">
      <stop offset="0" stop-color="#ffc8d8" stop-opacity="0.7" />
      <stop offset="1" stop-color="#ffc8d8" stop-opacity="0" />
    </radialGradient>
    <clipPath id="{id}-pot"><path d={POT_BODY} /></clipPath>
  </defs>

  <!-- The pot: shadow, glazed body, the light on its rim and side, then the gold. -->
  <ellipse class="shadow" cx="60" cy="115" rx="26" ry="2.6" />
  <path class="pot" d={POT_BODY} fill="url(#{id}-glaze)" />
  <g clip-path="url(#{id}-pot)">
    <rect
      class="rim-light"
      x={POT_RIM.x}
      y={POT_RIM.y}
      width={POT_RIM.width}
      height={POT_RIM.height}
    />
    <rect
      class="rim-shade"
      x={POT_RIM.x}
      y={POT_RIM.y + POT_RIM.height}
      width={POT_RIM.width}
      height="3"
    />
    <ellipse class="shine" cx="43" cy="97" rx="2.6" ry="10" />
    {#each seams as seam (seamKey(seam))}
      {@const d = seamPath(seamKey(seam), seam.days)}
      {@const isFresh = !!fresh && seamKey(fresh) === seamKey(seam)}
      <path class="seam-glow" class:fresh={isFresh} {d} pathLength="1" />
      <path class="seam" class:fresh={isFresh} {d} stroke="url(#{id}-gold)" pathLength="1" />
    {/each}
    {#if bowl && crack > 0}
      <!-- Dark edge and a pale core, so it shows on any glaze -->
      <path class="crack" d={seamPath(crackSeed, crack)} />
      <path class="crack-core" d={seamPath(crackSeed, crack)} />
    {/if}
  </g>
  <ellipse class="lip" cx={SOIL.cx} cy={SOIL.cy} rx={SOIL.rx + 2} ry={SOIL.ry + 0.9} />
  <ellipse class="soil" cx={SOIL.cx} cy={SOIL.cy} rx={SOIL.rx} ry={SOIL.ry} />

  {#if bowl}
    {#key bowl.start}
      <g class="plant">
        <g class="sway" class:lively>
          {#if haze}
            <ellipse
              class="haze"
              cx={haze.cx}
              cy={haze.cy}
              rx={haze.rx}
              ry={haze.ry}
              fill="url(#{id}-haze)"
              opacity={inBloom ? 1 : 0.55}
            />
          {/if}
          {#each [...plant.stems, ...plant.shoots] as stem, i (i)}
            {#if stem.outline}
              <!-- Wood: a tapering limb, dark at the edge, catching the light along one side. -->
              <path class="bark" d={stem.outline} />
              <path
                class="bark-light"
                d={stem.d}
                stroke-width={stem.width * 0.28}
                transform="translate(-{stem.width * 0.18} 0)"
              />
            {:else}
              <path class="stem" d={stem.d} stroke-width={stem.width} />
            {/if}
          {/each}
          {#each plant.leaves as leaf, i (i)}
            <g transform="translate({leaf.x} {leaf.y}) rotate({leaf.angle})">
              <g class="leaf tone-{leaf.tone}" style:--droop="{leaf.droop}deg">
                <path d={leafPath(leaf.size)} />
                <path class="vein" d="M0.8 0 L{leaf.size * 0.82} 0" />
              </g>
            </g>
          {/each}
          {#each plant.buds as bud, i (i)}
            <g class="bud" transform="translate({bud.x} {bud.y}) rotate({bud.angle + 90})">
              <ellipse class="calyx" cx="0" cy="1.2" rx="1.5" ry="1.1" />
              <ellipse class="bud-body" cx="0" cy="-0.6" rx="1.8" ry="2.4" />
              <ellipse class="bud-light" cx="-0.6" cy="-1.4" rx="0.5" ry="0.9" />
            </g>
          {/each}
          {#each plant.blossoms as flower, i (i)}
            <g
              class="blossom"
              transform="translate({flower.x} {flower.y}) rotate({flower.turn}) scale({flower.size *
                0.95})"
            >
              {#each PETALS as a (a)}
                <path class="sepal" d={SEPAL} transform="rotate({a + 36})" />
              {/each}
              {#each PETALS as a (a)}
                <path class="petal" d={PETAL} transform="rotate({a})" fill="url(#{id}-petal)" />
              {/each}
              <circle r="0.46" fill="url(#{id}-blush)" />
              {#each STAMENS as a (a)}
                <g transform="rotate({a})">
                  <path class="filament" d="M0-.16V-.5" />
                  <circle class="anther" cy="-.54" r=".055" />
                </g>
              {/each}
              <circle class="heart" r="0.17" style:fill={inBloom ? `url(#${id}-gold)` : null} />
            </g>
          {/each}
        </g>

        {#if plant.woody}
          {#each MOSS as m, i (i)}
            <ellipse class="moss" cx={m.cx} cy={m.cy} rx={m.rx} ry={m.ry} />
            <ellipse
              class="moss-light"
              cx={m.cx - m.rx * 0.2}
              cy={m.cy - m.ry * 0.35}
              rx={m.rx * 0.55}
              ry={m.ry * 0.45}
            />
          {/each}
          <ellipse class="pebble" cx="44.5" cy="72.1" rx="2" ry="1.2" />
        {/if}

        {#if inBloom}
          {#each FALLEN as f, i (i)}
            <path
              class="petal fallen"
              d={PETAL}
              transform="translate({f.x} {f.y}) scale(1 0.55) rotate({f.turn}) scale(2.6)"
              fill="url(#{id}-petal)"
            />
          {/each}
        {/if}

        {#if lively}
          {#each drift as p, i (i)}
            <g
              class="drift"
              style:transform-origin="{p.x}px {p.y}px"
              style:--dx="{p.dx}px"
              style:--dy="{p.dy}px"
              style:animation-duration="{p.dur}s"
              style:animation-delay="{p.delay}s"
            >
              <path
                class="petal"
                d={PETAL}
                transform="translate({p.x} {p.y}) rotate({p.turn}) scale(2.8)"
                fill="url(#{id}-petal)"
              />
            </g>
          {/each}
        {/if}
      </g>
    {/key}
  {:else}
    <!-- A seed waiting in the soil -->
    <ellipse class="seed" cx="60" cy="71.6" rx="2.2" ry="1.4" />
  {/if}
</svg>

<style>
  .plant-art {
    display: block;
    overflow: visible;
    --stem: #4f9a5c;
    --bark: #6e4c38;
    --bark-edge: #4a3125;
    --bark-light: #a67f62;
    --leaf-0: #6dbb7a;
    --leaf-1: #3f8f5a;
  }

  :global(:root[data-theme='dark']) .plant-art {
    --bark: #a27c60;
    --bark-edge: #6e4c38;
    --bark-light: #d0ab8c;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .plant-art {
      --bark: #a27c60;
      --bark-edge: #6e4c38;
      --bark-light: #d0ab8c;
    }
  }

  /* Celadon (青瓷) glaze; unglazed clay before the first day. */
  .glaze-light {
    stop-color: #d6ebe0;
  }

  .glaze-mid {
    stop-color: #a9d0bd;
  }

  .glaze-dark {
    stop-color: #7aae97;
  }

  .clay .glaze-light {
    stop-color: #f0e2cf;
  }

  .clay .glaze-mid {
    stop-color: #dcc4a6;
  }

  .clay .glaze-dark {
    stop-color: #bf9f7d;
  }

  .shadow {
    fill: rgb(0 0 0 / 0.14);
  }

  .pot {
    stroke: rgb(0 0 0 / 0.16);
    stroke-width: 0.8;
  }

  .rim-light {
    fill: rgb(255 255 255 / 0.16);
  }

  .rim-shade {
    fill: rgb(0 0 0 / 0.1);
  }

  .shine {
    fill: rgb(255 255 255 / 0.3);
  }

  .lip {
    fill: #8fbca8;
  }

  .clay .lip {
    fill: #cdb08f;
  }

  .soil {
    fill: #5a4031;
  }

  .seed {
    fill: #a07850;
  }

  /* The plant springs up from the soil when it first appears. */
  .plant {
    transform-box: view-box;
    transform-origin: 60px 72px;
    animation: grow 700ms var(--ease-spring-soft) backwards;
    transition: filter var(--dur-4) var(--ease-out);
  }

  @keyframes grow {
    from {
      opacity: 0;
      transform: scale(0.7);
    }
  }

  .stem {
    fill: none;
    stroke: var(--stem);
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .bark {
    fill: var(--bark);
    stroke: var(--bark-edge);
    stroke-width: 0.4;
    stroke-linejoin: round;
  }

  .bark-light {
    fill: none;
    stroke: var(--bark-light);
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.55;
  }

  .sepal {
    fill: #9b2c45;
  }

  .moss {
    fill: #5f8f4e;
  }

  .moss-light {
    fill: #8dbb73;
  }

  .pebble {
    fill: #b9b2a6;
    stroke: rgb(0 0 0 / 0.15);
    stroke-width: 0.3;
  }

  .leaf {
    transition: transform var(--dur-4) var(--ease-spring-soft);
  }

  .tone-0 > path:first-child {
    fill: var(--leaf-0);
  }

  .tone-1 > path:first-child {
    fill: var(--leaf-1);
  }

  .vein {
    fill: none;
    stroke: rgb(255 255 255 / 0.35);
    stroke-width: 0.5;
    stroke-linecap: round;
  }

  .calyx {
    fill: #6a8f4e;
  }

  .bud-body {
    fill: #e2607e;
  }

  .bud-light {
    fill: rgb(255 255 255 / 0.45);
  }

  .petal {
    stroke: #eba3b5;
    stroke-width: 0.05;
  }

  .fallen {
    opacity: 0.85;
  }

  /* Plum blossom's fine stamens, fanned out with gold tips. */
  .filament {
    fill: none;
    stroke: #d9718f;
    stroke-width: 0.035;
    stroke-linecap: round;
  }

  .anther {
    fill: #e9b23c;
  }

  .heart {
    fill: #e2607e;
  }

  .haze {
    filter: blur(2px);
  }

  /* Lively: the tree sways from the soil, and petals come loose and drift down. */
  .sway {
    transform-box: view-box;
    transform-origin: 60px 72px;
  }

  .sway.lively {
    animation: sway 6s ease-in-out infinite alternate;
  }

  @keyframes sway {
    from {
      rotate: -1.4deg;
    }
    to {
      rotate: 1.4deg;
    }
  }

  .drift {
    opacity: 0;
    animation: fall ease-in-out infinite;
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
      rotate: 150deg;
    }
    85% {
      opacity: 0.8;
    }
    100% {
      opacity: 0;
      translate: var(--dx) var(--dy);
      rotate: 300deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sway.lively,
    .drift {
      animation: none;
    }
  }

  /* Needs water: days missed that can still be mended. The leaves droop and the colour fades
     until the next practice revives it. */
  .wilt .plant {
    filter: saturate(0.45) brightness(0.97);
  }

  .wilt .leaf {
    transform: rotate(var(--droop));
  }

  .seam {
    fill: none;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .seam-glow {
    fill: none;
    stroke: rgb(255 214 102 / 0.35);
    stroke-width: 5.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: blur(1.5px);
  }

  /* A seam mended just now draws itself from the rim, then glints. */
  .fresh {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation:
      draw 1.4s var(--ease-out) 300ms forwards,
      glint 1.2s ease-in-out 1.6s 2;
  }

  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes glint {
    50% {
      filter: brightness(1.5) drop-shadow(0 0 3px rgb(255 214 102 / 0.9));
    }
  }

  .crack,
  .crack-core {
    fill: none;
    stroke: rgb(20 15 10 / 0.55);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 2.5 1.5;
  }

  .crack-core {
    stroke: rgb(255 248 230 / 0.75);
    stroke-width: 0.6;
  }
</style>
