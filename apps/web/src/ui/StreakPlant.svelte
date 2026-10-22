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
  }

  let { bowl, crack = 0, fresh = null, size = 120, label }: Props = $props();
  const id = $props.id();
  const plant = $derived(plantShape(bowl?.start ?? '', bowl?.days ?? 0));
  const inBloom = $derived((bowl?.days ?? 0) >= 100);
  const seams = $derived(bowl ? visibleSeams(bowl) : []);
  const crackSeed = $derived(bowl ? `crack:${bowl.end}` : '');
  const PETALS = [0, 72, 144, 216, 288].map((a) => (a * Math.PI) / 180);
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
    <radialGradient id="{id}-petal">
      <stop offset="0.2" stop-color="#fff7f9" />
      <stop offset="1" stop-color="#f7c3d0" />
    </radialGradient>
    <clipPath id="{id}-pot"><path d={POT_BODY} /></clipPath>
  </defs>

  <!-- The pot: shadow, glazed body, the light on its rim and side, then the gold. -->
  <ellipse class="shadow" cx="60" cy="115" rx="26" ry="2.6" />
  <path class="pot" d={POT_BODY} fill="url(#{id}-glaze)" />
  <g clip-path="url(#{id}-pot)">
    <rect class="rim-light" x={POT_RIM.x} y={POT_RIM.y} width={POT_RIM.width} height={POT_RIM.height} />
    <rect class="rim-shade" x={POT_RIM.x} y={POT_RIM.y + POT_RIM.height} width={POT_RIM.width} height="3" />
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
        {#each plant.stems as stem, i (i)}
          <path class="stem" class:woody={plant.woody} d={stem.d} stroke-width={stem.width} />
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
          </g>
        {/each}
        {#each plant.blossoms as flower, i (i)}
          <g class="blossom" transform="translate({flower.x} {flower.y}) rotate({flower.turn})">
            {#each PETALS as a, p (p)}
              <circle
                class="petal"
                cx={Math.cos(a) * flower.size * 0.48}
                cy={Math.sin(a) * flower.size * 0.48}
                r={flower.size * 0.5}
                fill="url(#{id}-petal)"
              />
            {/each}
            <circle
              class="heart"
              r={flower.size * 0.24}
              style:fill={inBloom ? `url(#${id}-gold)` : null}
            />
            {#each PETALS as a, p (p)}
              <circle
                class="stamen"
                cx={Math.cos(a + 0.6) * flower.size * 0.36}
                cy={Math.sin(a + 0.6) * flower.size * 0.36}
                r="0.45"
              />
            {/each}
          </g>
        {/each}
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
    --leaf-0: #6dbb7a;
    --leaf-1: #3f8f5a;
  }

  :global(:root[data-theme='dark']) .plant-art {
    --bark: #a27c60;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme='light'])) .plant-art {
      --bark: #a27c60;
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

  .stem.woody {
    stroke: var(--bark);
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

  .petal {
    stroke: #eba3b5;
    stroke-width: 0.35;
  }

  .heart {
    fill: #e2607e;
  }

  .stamen {
    fill: #e9b23c;
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
