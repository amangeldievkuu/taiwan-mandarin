<!--
  墨 (Mo), the little ink bot: line art that inks itself in, walks while the page scrolls, sits
  down with a cup of tea when it stops, and dozes off after a while. All drawing is CSS on the
  SVG; the parent sets `--dir` and the classes walking / sitting / sleepy / fast (see lib/walk.ts).
-->
<svg class="bot" viewBox="0 0 120 150" aria-hidden="true">
  <!-- dust while walking fast -->
  <g class="dust">
    <circle cx="28" cy="138" r="3" />
    <circle cx="18" cy="134" r="2" />
  </g>

  <g class="figure">
    <!-- tea, for sitting down -->
    <g class="tea">
      <path class="ink" pathLength="1" d="M100 124h14l-2 10h-10z" />
      <path class="ink" pathLength="1" d="M114 126q6 1 4 6" />
      <path class="steam" d="M105 120q-2-4 0-7M110 120q-2-4 0-7" />
    </g>

    <!-- z z z, for dozing -->
    <g class="zzz">
      <text x="92" y="24">z</text>
      <text x="101" y="14" class="z2">z</text>
      <text x="109" y="6" class="z3">z</text>
    </g>

    <!-- antenna -->
    <path class="ink part" style:--d="0.0s" pathLength="1" d="M60 22V11" />
    <circle class="ink part tip" style:--d="0.1s" pathLength="1" cx="60" cy="7" r="4" />

    <!-- head -->
    <rect
      class="ink part"
      style:--d="0.15s"
      pathLength="1"
      x="30"
      y="22"
      width="60"
      height="46"
      rx="14"
    />
    <g class="eye" style:--d="0.9s" style:transform-origin="46px 44px">
      <circle class="fill" cx="46" cy="44" r="4.5" />
    </g>
    <g class="eye" style:--d="0.9s" style:transform-origin="74px 44px">
      <circle class="fill" cx="74" cy="44" r="4.5" />
    </g>
    <path class="ink part mouth" style:--d="0.7s" pathLength="1" d="M51 56q9 7 18 0" />
    <circle class="cheek" style:--d="1s" cx="39" cy="54" r="3.5" />
    <circle class="cheek" style:--d="1s" cx="81" cy="54" r="3.5" />

    <!-- neck and body -->
    <path class="ink part" style:--d="0.4s" pathLength="1" d="M54 68v6M66 68v6" />
    <rect
      class="ink part"
      style:--d="0.45s"
      pathLength="1"
      x="34"
      y="74"
      width="52"
      height="44"
      rx="12"
    />
    <g class="chest" style:--d="1.1s">
      <rect x="52" y="87" width="16" height="16" rx="3" />
      <text x="60" y="99.5" lang="zh-Hant-TW">華</text>
    </g>

    <!-- arms -->
    <g class="arm arm-l" style:transform-origin="34px 84px">
      <path class="ink part" style:--d="0.6s" pathLength="1" d="M34 84L19 104" />
      <circle class="ink part" style:--d="0.75s" pathLength="1" cx="17" cy="107" r="4" />
    </g>
    <g class="arm arm-r" style:transform-origin="86px 84px">
      <path class="ink part" style:--d="0.6s" pathLength="1" d="M86 84l15 20" />
      <circle class="ink part" style:--d="0.75s" pathLength="1" cx="103" cy="107" r="4" />
    </g>

    <!-- legs -->
    <g class="leg leg-l" style:transform-origin="48px 118px">
      <path class="ink part" style:--d="0.5s" pathLength="1" d="M48 118v16" />
      <path class="ink part" style:--d="0.65s" pathLength="1" d="M39 136h17" />
    </g>
    <g class="leg leg-r" style:transform-origin="72px 118px">
      <path class="ink part" style:--d="0.5s" pathLength="1" d="M72 118v16" />
      <path class="ink part" style:--d="0.65s" pathLength="1" d="M64 136h17" />
    </g>
  </g>
</svg>

<style>
  .bot {
    display: block;
    width: 100%;
    height: auto;
    overflow: visible;
    transform: scaleX(var(--dir, 1));
    transition: transform var(--dur-2) var(--ease-out);
  }

  .figure {
    transform-box: fill-box;
    transform-origin: 50% 100%;
    transition: transform var(--dur-3) var(--ease-spring-soft);
  }

  /* Ink: every stroke draws itself in, one part after another. */
  .ink {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .part {
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    animation: ink 0.6s var(--ease-out) forwards;
    animation-delay: calc(var(--d, 0s) + 0.1s);
  }

  @keyframes ink {
    to {
      stroke-dashoffset: 0;
    }
  }

  .fill,
  .cheek,
  .chest {
    opacity: 0;
    animation: appear 0.4s var(--ease-out) forwards;
    animation-delay: var(--d, 1s);
  }

  @keyframes appear {
    to {
      opacity: 1;
    }
  }

  .fill {
    fill: var(--ink);
  }

  .cheek {
    fill: var(--seal);
    opacity: 0;
    --to: 0.55;
  }

  .chest rect {
    fill: var(--seal);
  }

  .chest text {
    fill: var(--seal-ink);
    font-family: var(--font-kai);
    font-size: 11px;
    text-anchor: middle;
  }

  .tip {
    transition: fill var(--dur-3) var(--ease-out);
  }

  /* Eyes blink now and then. */
  .eye {
    animation: blink 4.2s ease-in-out infinite;
    animation-delay: 1.6s;
  }

  @keyframes blink {
    0%,
    92%,
    100% {
      transform: scaleY(1);
    }
    95% {
      transform: scaleY(0.08);
    }
  }

  /* Walking: legs and arms swing, the body bobs. Paused unless the parent says `walking`. */
  .leg,
  .arm {
    animation-duration: 0.56s;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    animation-play-state: paused;
    transition: transform var(--dur-3) var(--ease-spring-soft);
  }

  .leg-l,
  .arm-r {
    animation-name: swing;
  }

  .leg-r,
  .arm-l {
    animation-name: swing-back;
  }

  @keyframes swing {
    0%,
    100% {
      transform: rotate(-26deg);
    }
    50% {
      transform: rotate(26deg);
    }
  }

  @keyframes swing-back {
    0%,
    100% {
      transform: rotate(26deg);
    }
    50% {
      transform: rotate(-26deg);
    }
  }

  :global(.walking) .leg,
  :global(.walking) .arm {
    animation-play-state: running;
  }

  :global(.walking) .figure {
    animation: bob 0.28s ease-in-out infinite alternate;
  }

  :global(.walking.fast) .leg,
  :global(.walking.fast) .arm {
    animation-duration: 0.36s;
  }

  @keyframes bob {
    from {
      transform: translateY(0);
    }
    to {
      transform: translateY(-3px);
    }
  }

  /* Sitting: legs out in front, body down on the ground, a cup of tea within reach. */
  :global(.sitting) .figure {
    transform: translateY(14px);
  }

  :global(.sitting) .leg-l {
    transform: rotate(-78deg);
  }

  :global(.sitting) .leg-r {
    transform: rotate(-64deg);
  }

  :global(.sitting) .arm-r {
    transform: rotate(-30deg);
  }

  .tea {
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity var(--dur-3) var(--ease-out),
      transform var(--dur-3) var(--ease-out);
  }

  .tea .ink {
    stroke-width: 2.4;
  }

  .steam {
    fill: none;
    stroke: var(--ink-3);
    stroke-width: 1.6;
    stroke-linecap: round;
    opacity: 0;
  }

  :global(.sitting) .tea {
    opacity: 1;
    transform: translateY(14px);
    transition-delay: 0.3s;
  }

  :global(.sitting) .steam {
    animation: steam 2.4s ease-in-out infinite;
    animation-delay: 0.6s;
  }

  @keyframes steam {
    0% {
      opacity: 0;
      transform: translateY(2px);
    }
    40% {
      opacity: 0.8;
    }
    100% {
      opacity: 0;
      transform: translateY(-6px);
    }
  }

  /* Dozing: eyes close, the antenna dims, z's float up. */
  :global(.sleepy) .eye {
    animation: none;
    transform: scaleY(0.12);
    transition: transform var(--dur-4) var(--ease-out);
  }

  :global(.sleepy) .mouth {
    d: path('M53 58q7 3 14 0');
  }

  .zzz text {
    fill: var(--ink-2);
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: 11px;
    opacity: 0;
  }

  .zzz .z2 {
    font-size: 13px;
  }

  .zzz .z3 {
    font-size: 15px;
  }

  :global(.sleepy) .zzz text {
    animation: doze 2.4s ease-in-out infinite;
  }

  :global(.sleepy) .zzz .z2 {
    animation-delay: 0.5s;
  }

  :global(.sleepy) .zzz .z3 {
    animation-delay: 1s;
  }

  @keyframes doze {
    0% {
      opacity: 0;
      transform: translateY(4px);
    }
    30% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(-10px);
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
      transform: translate(0, 0) scale(0.6);
    }
    100% {
      opacity: 0;
      transform: translate(-10px, -8px) scale(1.4);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .part,
    .fill,
    .cheek,
    .chest {
      animation: none;
      stroke-dashoffset: 0;
      opacity: 1;
    }

    .eye,
    .leg,
    .arm,
    .figure,
    .zzz text,
    .steam,
    .dust circle {
      animation: none !important;
    }
  }
</style>
