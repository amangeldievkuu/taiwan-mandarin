<!--
  墨 (Mo), a drop of ink with legs, drawn in outline. It drips onto the page, walks while the
  page scrolls, faces the way it is going, sits down to say something when the scrolling stops,
  and dozes off after a while. Tap it and it hops. The parent sets `--dir` and the classes
  walking / sitting / sleepy / fast (see lib/walk.ts), hanging (on a rope or a thread) and hush
  (sitting without a word); everything else is CSS on the SVG.
-->
<script module lang="ts">
  export interface Line {
    zh: string;
    /** The same in the learner's language. */
    gloss: string;
  }
</script>

<script lang="ts">
  import { t } from '../../lib/i18n/index.svelte';

  interface Props {
    /** What 墨 says once it sits down. */
    says?: Line;
    /** Put the speech bubble on the left, near the end of the road. */
    flip?: boolean;
    /** Put the speech bubble underneath, near the top of the screen. */
    below?: boolean;
  }

  let { says, flip = false, below = false }: Props = $props();

  const TAPS = ['嘿！', '哈哈', '咚！', '再來！', '好癢'];

  let taps = 0;
  let tapped = $state<Line | null>(null);
  let hopping = $state(false);
  let hopTimer: ReturnType<typeof setTimeout> | undefined;
  let sayTimer: ReturnType<typeof setTimeout> | undefined;

  function hop() {
    // Off for a frame, so a second tap starts the hop again.
    hopping = false;
    requestAnimationFrame(() => (hopping = true));
    clearTimeout(hopTimer);
    hopTimer = setTimeout(() => (hopping = false), 700);
    const i = taps++ % TAPS.length;
    tapped = { zh: TAPS[i] ?? '', gloss: t().taps[i] ?? '' };
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => (tapped = null), 1800);
  }

  $effect(() => () => {
    clearTimeout(hopTimer);
    clearTimeout(sayTimer);
  });

  const line = $derived(tapped ?? says);
</script>

<div class="blob" class:tapped={!!tapped} class:flip class:below>
  <button class="body" class:hopping type="button" tabindex="-1" aria-hidden="true" onclick={hop}>
    <svg viewBox="0 0 30 30">
      <!-- z z z, for dozing -->
      <g class="zzz">
        <text x="24" y="4">z</text>
        <text x="27.5" y="-1" class="z2">z</text>
        <text x="31" y="-6.5" class="z3">z</text>
      </g>

      <g class="facing">
        <!-- dust while walking fast -->
        <g class="dust">
          <circle cx="6" cy="28" r="1.5" />
          <circle cx="2.5" cy="26" r="1" />
        </g>

        <g class="figure">
          <g class="legs">
            <path class="leg leg-a" pathLength="1" d="M12 22 11 29" />
            <path class="leg leg-b" pathLength="1" d="M18 22 19 29" />
          </g>
          <g class="drop">
            <!-- the brush tip the drop fell from -->
            <path class="hair" pathLength="1" d="M15 6c-1-3 1-5 3-5" />
            <path
              class="shape"
              d="M15 5.5c5.6 0 9 3.6 9 8.4 0 5-3.6 8.6-9 8.6s-9-3.4-9-8.4c0-5 3.6-8.6 9-8.6Z"
            />
            <g class="eyes">
              <circle cx="17.5" cy="12.5" r="1.3" />
              <circle cx="21.5" cy="12.5" r="1.3" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  </button>

  {#if line}
    <p class="says">
      <span class="zh" lang="zh-Hant-TW">{line.zh}</span>
      <small>{line.gloss}</small>
    </p>
  {/if}
</div>

<style>
  .blob {
    position: relative;
  }

  .body {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    cursor: pointer;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
  }

  .body svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    transform-origin: 50% 100%;
  }

  .body.hopping svg {
    animation: hop 0.6s var(--ease-out);
  }

  @keyframes hop {
    0% {
      translate: 0 0;
      scale: 1 1;
    }
    15% {
      scale: 1.18 0.82;
    }
    45% {
      translate: 0 -40%;
      scale: 0.9 1.1;
    }
    75% {
      translate: 0 0;
      scale: 1.12 0.88;
    }
    100% {
      scale: 1 1;
    }
  }

  /* Faces the way the page is going. */
  .facing {
    transform-box: view-box;
    transform-origin: 15px 0;
    scale: var(--dir, 1) 1;
    transition: scale var(--dur-2) var(--ease-out);
  }

  .figure {
    transition: translate var(--dur-4) var(--ease-spring);
  }

  /* The drop falls onto the page and splats into shape. */
  .drop {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    animation: drip 0.9s var(--ease-spring) 0.1s backwards;
  }

  @keyframes drip {
    0% {
      opacity: 0;
      translate: 0 -24px;
      scale: 0.5 1.4;
    }
    45% {
      opacity: 1;
      translate: 0 0;
      scale: 1.3 0.7;
    }
    70% {
      scale: 0.92 1.08;
    }
    100% {
      scale: 1 1;
    }
  }

  /* Line art: an ink outline around a paper body, like the rest of the road. */
  .shape {
    fill: var(--paper);
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linejoin: round;
  }

  .hair,
  .leg {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
  }

  /* The brush tip and legs ink themselves in once the drop has landed. */
  .hair,
  .leg {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: ink 0.4s var(--ease-out) forwards;
  }

  .hair {
    animation-delay: 0.7s;
  }

  .leg {
    animation-delay: 0.5s;
  }

  @keyframes ink {
    to {
      stroke-dashoffset: 0;
    }
  }

  .eyes {
    fill: currentColor;
    transform-box: fill-box;
    transform-origin: center;
    animation: blink 4.6s 1.2s infinite;
    transition: scale var(--dur-4) var(--ease-out);
  }

  @keyframes blink {
    0%,
    93%,
    100% {
      scale: 1 1;
    }
    96% {
      scale: 1 0.1;
    }
  }

  /* Walking: the legs step and the drop bobs. */
  .leg {
    transform-box: fill-box;
    transform-origin: 50% 0;
    transition: rotate 0.35s var(--ease-spring);
  }

  :global(.walking) .leg-a {
    animation:
      ink 0.4s var(--ease-out) 0.5s forwards,
      step 0.3s ease-in-out infinite alternate;
  }

  :global(.walking) .leg-b {
    animation:
      ink 0.4s var(--ease-out) 0.5s forwards,
      step 0.3s ease-in-out infinite alternate-reverse;
  }

  :global(.walking.fast) .leg {
    animation-duration: 0.4s, 0.2s;
  }

  :global(.walking) .figure {
    animation: bob 0.3s ease-in-out infinite alternate;
  }

  @keyframes step {
    from {
      rotate: -24deg;
    }
    to {
      rotate: 24deg;
    }
  }

  @keyframes bob {
    to {
      translate: 0 -1px;
    }
  }

  /* Sitting: down on the road, legs out in front. */
  :global(.sitting) .figure {
    translate: 0 3px;
  }

  :global(.sitting) .leg {
    rotate: -70deg;
  }

  /* Hanging on a rope or a thread: legs dangling apart. */
  :global(.hanging) .leg-a {
    rotate: 18deg;
  }

  :global(.hanging) .leg-b {
    rotate: -18deg;
  }

  /* Dozing: eyes shut, z's float up. */
  :global(.sleepy) .blob:not(.tapped) .eyes {
    animation: none;
    scale: 1 0.15;
  }

  .zzz text {
    fill: var(--ink-2);
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: 4.5px;
    opacity: 0;
  }

  .zzz .z2 {
    font-size: 5.5px;
  }

  .zzz .z3 {
    font-size: 6.5px;
  }

  :global(.sleepy) .blob:not(.tapped) .zzz text {
    animation: doze 2.4s ease-in-out infinite;
  }

  :global(.sleepy) .blob:not(.tapped) .zzz .z2 {
    animation-delay: 0.5s;
  }

  :global(.sleepy) .blob:not(.tapped) .zzz .z3 {
    animation-delay: 1s;
  }

  @keyframes doze {
    0% {
      opacity: 0;
      translate: 0 2px;
    }
    30% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      translate: 0 -4px;
    }
  }

  /* Dust: little puffs behind the feet when the page flies by. */
  .dust circle {
    fill: var(--ink-3);
    opacity: 0;
  }

  :global(.walking.fast) .dust circle {
    animation: puff 0.5s ease-out infinite;
  }

  :global(.walking.fast) .dust circle:last-child {
    animation-delay: 0.2s;
  }

  @keyframes puff {
    0% {
      opacity: 0.5;
      translate: 0 0;
      scale: 0.6;
    }
    100% {
      opacity: 0;
      translate: -4px -3px;
      scale: 1.4;
    }
  }

  /* The speech bubble: up while sitting (not dozing), or right after a tap. */
  .says {
    position: absolute;
    left: 40%;
    bottom: calc(100% + 4px);
    display: flex;
    align-items: baseline;
    gap: 6px;
    margin: 0;
    padding: 5px 12px 6px;
    white-space: nowrap;
    background: var(--paper);
    border: 1.5px solid var(--ink);
    border-radius: 14px 14px 14px 3px;
    box-shadow: var(--shadow-1);
    opacity: 0;
    translate: 0 6px;
    scale: 0.9;
    transform-origin: 0 100%;
    pointer-events: none;
    transition:
      opacity var(--dur-2),
      translate var(--dur-4) var(--ease-spring),
      scale var(--dur-4) var(--ease-spring);
  }

  .flip .says {
    left: auto;
    right: 40%;
    border-radius: 14px 14px 3px 14px;
    transform-origin: 100% 100%;
  }

  .below .says {
    top: calc(100% + 4px);
    bottom: auto;
    translate: 0 -6px;
    border-radius: 3px 14px 14px 14px;
    transform-origin: 0 0;
  }

  .below.flip .says {
    border-radius: 14px 3px 14px 14px;
    transform-origin: 100% 0;
  }

  :global(.sitting:not(.sleepy):not(.hush)) .says,
  .tapped .says {
    opacity: 1;
    translate: 0 0;
    scale: 1;
  }

  .says .zh {
    font-family: var(--font-kai);
    font-size: 18px;
    line-height: 1.1;
    color: var(--ink);
  }

  .says small {
    font-size: 11px;
    font-weight: 700;
    color: var(--ink-3);
  }

  @media (prefers-reduced-motion: reduce) {
    .drop,
    .hair,
    .leg,
    .eyes,
    .figure,
    .zzz text,
    .dust circle,
    .body.hopping svg {
      animation: none !important;
    }

    .hair,
    .leg {
      stroke-dashoffset: 0;
    }

    .facing,
    .figure,
    .leg,
    .says {
      transition: none;
    }
  }
</style>
