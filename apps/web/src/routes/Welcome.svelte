<script lang="ts">
  // The welcome page: what the app is, told along a road. 墨, a drop of ink, walks the road as the
  // page scrolls, passing a signpost for every TOCFL level, towards a Taiwan cherry (山櫻花) in a pot
  // that puts out a flowering branch for each level and blooms in full at the end. It sits down and says something when you stop.
  import { LANGS, LEVELS, type Bowl } from '@taiwan-mandarin/shared';
  import InkBlob, { type Line } from '../ui/landing/InkBlob.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import RoadPlant from '../ui/landing/RoadPlant.svelte';
  import Icon from '../ui/Icon.svelte';
  import Seal from '../ui/Seal.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { walk } from '../lib/walk';
  import { markWelcomed } from '../lib/welcome';
  import { LEVEL_SEAL } from './Path.svelte';

  /** Where each level's signpost stands along the road (0–1). */
  const POSTS = LEVELS.map((level, i) => ({
    ...level,
    at: 0.2 + (i / (LEVELS.length - 1)) * 0.74,
  }));

  let road = $state<HTMLElement>();
  let progress = $state(0);
  // The road element owns --p (set by the walk action); mirror it for the signposts and the plant.
  $effect(() => {
    const el = road;
    if (!el) return;
    const observer = new MutationObserver(() => {
      progress = Number(el.style.getPropertyValue('--p')) || 0;
    });
    observer.observe(el, { attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  });
  const reached = $derived(POSTS.filter((p) => progress >= p.at - 0.015).length);
  const blooming = $derived(progress >= 0.99);

  /** How far the plant has grown: a leaf's share of the stem per signpost, the rest to the end. */
  const grow = $derived.by(() => {
    const knots = [0, ...POSTS.map((p) => p.at - 0.015), 1];
    const k = Math.max(
      0,
      Math.min(
        knots.length - 2,
        knots.findLastIndex((x) => progress >= x),
      ),
    );
    const from = knots[k] ?? 0;
    const span = (knots[k + 1] ?? 1) - from;
    const frac = span > 0 ? Math.min(1, Math.max(0, (progress - from) / span)) : 1;
    return (k + frac) / (knots.length - 1);
  });

  /** What 墨 says when it sits down: one line for each stretch of the road. */
  const SAYS = [
    '你好！',
    '出發！',
    '一步一步',
    '慢慢來',
    '加油！',
    '好厲害',
    '快到了',
    '再一點',
    '到了！',
  ];
  const says = $derived.by((): Line => {
    if (blooming) return { zh: '開花了！', gloss: t().welcome.bloomed };
    const i = Math.min(reached, SAYS.length - 1);
    return { zh: SAYS[i] ?? '', gloss: t().welcome.says[i] ?? '' };
  });

  /** A plant in bloom, for the picture. */
  const bloom: Bowl = {
    start: '2026-01-01',
    end: '2026-10-28',
    days: 120,
    seams: [{ from: '2026-03-04', to: '2026-03-05', days: 2, mendedOn: '2026-03-06' }],
  };

  function start(to: string) {
    markWelcomed();
    router.go(to);
  }

  /** The features' seals; their titles and texts are in the catalog, in this order. */
  const FEATURES = ['路', '憶', '注', '典', '讀', '談'];
  /** The steps' characters, likewise. */
  const STEPS = ['早', '學', '讀'];
</script>

<div class="landing" use:walk bind:this={road}>
  <section class="hero">
    <div class="hero-text">
      <div class="languages" role="group" aria-label={t().landing.language}>
        {#each LANGS as l (l.id)}
          <button
            type="button"
            class="chip"
            lang={l.id}
            aria-pressed={store.settings.language === l.id}
            onclick={() => store.chooseLanguage(l.id)}>{l.name}</button
          >
        {/each}
      </div>
      <p class="eyebrow">{t().landing.eyebrow}</p>
      <h1>
        <span class="zh" lang="zh-Hant-TW">臺灣華語</span>
        <span class="en">{t().landing.headline}</span>
      </h1>
      <p class="lead">{t().landing.lead}</p>
      <div class="cta">
        <button type="button" class="btn primary big" onclick={() => start('/')}>
          {t().landing.start}
          <Icon name="forward" />
        </button>
        <button type="button" class="btn quiet big" onclick={() => start('/me/account')}>
          {t().auth.signIn}
        </button>
      </div>
      <p class="fine">{t().landing.fine}</p>
    </div>
    <div class="hero-seal" aria-hidden="true">
      <Seal text="華" size={132} paste="vermilion" />
      <p class="hint">
        <Icon name="back" />
        {t().landing.scroll}
      </p>
    </div>
  </section>

  <section class="features">
    <h2 class="section-title">
      {t().landing.inside} <span class="zh" lang="zh-Hant-TW">內容</span>
    </h2>
    <ul>
      {#each FEATURES as seal, i (seal)}
        <li class="feature sheet" style:--i={i}>
          <Seal text={seal} size={44} outline paste="vermilion" />
          <h3>{t().landing.features[i]?.title}</h3>
          <p>{t().landing.features[i]?.text}</p>
        </li>
      {/each}
    </ul>
  </section>

  <section class="plant sheet">
    <StreakPlant bowl={bloom} size={170} label={t().landing.plantLabel} lively glaze="celadon" />
    <div>
      <h2>{t().landing.plantTitle}</h2>
      <p>{t().landing.plantText}</p>
    </div>
  </section>

  <section class="steps">
    <h2 class="section-title">{t().landing.day} <span class="zh" lang="zh-Hant-TW">一天</span></h2>
    <ol>
      {#each STEPS as zh, i (zh)}
        <li>
          <span class="step-n">{i + 1}</span>
          <span class="step-zh hanzi" lang="zh-Hant-TW">{zh}</span>
          <strong>{t().landing.steps[i]?.title}</strong>
          <p>{t().landing.steps[i]?.text}</p>
        </li>
      {/each}
    </ol>
  </section>

  <section class="install">
    <h2>{t().landing.install}</h2>
    <p>
      {t().landing.installOpen} <strong>{t().landing.installAdd}</strong>{t().landing.installAfter}
    </p>
    <div class="cta">
      <button type="button" class="btn primary big" onclick={() => start('/')}>
        {t().landing.start}
        <Icon name="forward" />
      </button>
    </div>
  </section>

  <footer class="credits">
    <p>
      {t().landing.wordsFrom}
      <a href="https://tocfl.edu.tw" target="_blank" rel="noopener">TOCFL</a>
      {t().about.and}
      <a href="https://coct.naer.edu.tw" target="_blank" rel="noopener">NAER</a>.
      {t().landing.dictionary}
      <a href="https://cc-cedict.org" target="_blank" rel="noopener">CC-CEDICT</a>
      {t().landing.withTaiwan}
      {t().landing.examples}
      <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a>
      {t().landing.ownSentences}
      {t().landing.fonts}
    </p>
  </footer>

  <!-- The road: sticks to the bottom while the page scrolls, and 墨 walks along it to the pot. -->
  <div class="road" aria-hidden="true">
    <svg class="ground" viewBox="0 0 1000 24" preserveAspectRatio="none">
      <path
        class="trail"
        pathLength="1"
        d="M0 14 Q 60 9 125 14 T 250 14 T 375 13 T 500 15 T 625 13 T 750 14 T 875 13 T 1000 14"
      />
    </svg>
    <ul class="posts">
      {#each POSTS as post, i (post.id)}
        <li class="post" class:lit={i < reached} style:--x={post.at}>
          <Seal text={LEVEL_SEAL[post.id]} size={30} outline={i >= reached} />
          <span>{t().levels[post.id]}</span>
        </li>
      {/each}
    </ul>
    <div class="walker">
      <InkBlob {says} flip={progress > 0.55} />
    </div>
    <div class="plant-pot">
      <RoadPlant {grow} {reached} total={POSTS.length} bloom={blooming} />
    </div>
  </div>
</div>

<style>
  .landing {
    --road-h: 150px;
    --dir: 1;
    --p: 0;
    position: relative;
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    padding: calc(var(--safe-top) + 24px) var(--gutter) 0;
    overflow-x: clip;
  }

  section {
    margin: 0 auto;
  }

  /* ---- Hero ---- */
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    align-items: center;
    gap: 32px;
    min-height: calc(100svh - var(--road-h) - var(--safe-top) - 24px);
    padding-bottom: 24px;
  }

  @media (max-width: 760px) {
    .hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding-top: 8px;
    }

    .hero-seal {
      order: -1;
    }
  }

  .hero-text {
    animation: enter var(--dur-4) var(--ease-spring-soft) backwards;
  }

  .languages {
    display: flex;
    gap: 6px;
    margin-bottom: 14px;
  }

  h1 {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 6px 0 16px;
    line-height: 1.05;
  }

  h1 .zh {
    font-family: var(--font-kai);
    font-weight: 400;
    font-size: clamp(40px, 9vw, 76px);
    letter-spacing: 0.08em;
    color: var(--seal);
  }

  h1 .en {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: clamp(26px, 4.6vw, 44px);
    letter-spacing: -0.02em;
  }

  .lead {
    max-width: 52ch;
    margin: 0 0 22px;
    font-size: clamp(16px, 2vw, 19px);
    line-height: 1.55;
    color: var(--ink-2);
  }

  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .btn.big {
    min-height: 54px;
    padding: 0 26px;
    font-size: 17px;
  }

  .fine {
    margin: 14px 0 0;
    font-size: 13px;
    color: var(--ink-3);
  }

  .hero-seal {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    animation: enter var(--dur-4) var(--ease-spring-soft) 120ms backwards;
  }

  .hero-seal :global(.seal) {
    transform: rotate(-4deg);
    box-shadow: var(--shadow-3);
  }

  .hint {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-3);
  }

  .hint :global(.icon) {
    transform: rotate(-90deg);
    animation: nudge 1.6s ease-in-out infinite;
  }

  @keyframes nudge {
    50% {
      transform: rotate(-90deg) translateX(-3px);
    }
  }

  /* ---- Features ---- */
  .features ul {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .feature {
    padding: 20px;
  }

  .feature h3 {
    margin: 14px 0 6px;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .feature p {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    color: var(--ink-2);
  }

  /* ---- Plant ---- */
  .plant {
    display: flex;
    align-items: center;
    gap: 28px;
    margin-top: 56px;
    padding: 26px 30px;
    border-radius: var(--radius-xl);
    background: var(--jade-wash);
    border-color: transparent;
    box-shadow: none;
  }

  @media (max-width: 640px) {
    .plant {
      flex-direction: column;
      text-align: center;
      padding: 24px 20px;
    }
  }

  .plant h2,
  .install h2 {
    margin: 0 0 8px;
    font-size: clamp(22px, 3vw, 28px);
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  .plant p,
  .install p {
    margin: 0;
    font-size: 16px;
    line-height: 1.55;
    color: var(--ink-2);
  }

  /* ---- Steps ---- */
  .steps {
    margin-top: 40px;
  }

  .steps ol {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: step;
  }

  .steps li {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px 20px 18px 58px;
    border: 1px dashed var(--rule-strong);
    border-radius: var(--radius-lg);
  }

  .step-n {
    position: absolute;
    top: 18px;
    left: 18px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--paper);
    font-size: 13px;
    font-weight: 800;
  }

  .step-zh {
    font-size: 26px;
    color: var(--seal);
    line-height: 1;
  }

  .steps strong {
    font-size: 17px;
  }

  .steps p {
    margin: 0;
    font-size: 15px;
    color: var(--ink-2);
  }

  /* ---- Install ---- */
  .install {
    max-width: 640px;
    margin-top: 56px;
    text-align: center;
  }

  .install .cta {
    justify-content: center;
    margin-top: 18px;
  }

  .credits {
    max-width: 640px;
    margin: 48px auto 0;
    padding-bottom: calc(var(--road-h) + var(--safe-bottom) + 12px);
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
    color: var(--ink-3);
  }

  .credits a {
    color: var(--ink-2);
  }

  /* ---- The road ---- */
  .road {
    --walker-w: 58px;
    --pot-w: 72px;
    position: sticky;
    bottom: 0;
    z-index: 5;
    height: calc(var(--road-h) + var(--safe-bottom));
    margin: 0 calc(-1 * var(--gutter));
    padding: 0 var(--gutter) var(--safe-bottom);
    background: linear-gradient(to bottom, transparent, var(--paper) 36px);
    pointer-events: none;
  }

  /* The road runs from the left edge to the pot. */
  .ground {
    position: absolute;
    left: var(--gutter);
    bottom: calc(var(--safe-bottom) + 10px);
    width: calc(100% - 2 * var(--gutter) - var(--pot-w) + 6px);
    height: 24px;
    overflow: visible;
  }

  /* The trail is inked as 墨 walks: how much of the road is drawn follows the scroll. */
  .trail {
    fill: none;
    stroke: var(--ink);
    stroke-width: 2.5;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    stroke-dasharray: 1;
    stroke-dashoffset: calc(1 - var(--p) * 0.96 - 0.04);
    opacity: 0.8;
  }

  .posts {
    position: absolute;
    inset: 0 calc(var(--gutter) + var(--pot-w) + var(--walker-w) * 0.4) auto var(--gutter);
    height: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .post {
    position: absolute;
    left: calc(var(--x) * 100%);
    bottom: calc(var(--safe-bottom) + 22px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transform: translateX(-50%);
    transition:
      transform var(--dur-4) var(--ease-spring),
      opacity var(--dur-3) var(--ease-out);
    opacity: 0.55;
  }

  .post::after {
    content: '';
    width: 2px;
    height: 10px;
    border-radius: 1px;
    background: var(--ink-3);
  }

  .post span {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--ink-3);
    white-space: nowrap;
  }

  .post.lit {
    opacity: 1;
    transform: translateX(-50%) translateY(-4px);
  }

  .post.lit span {
    color: var(--jade-text);
  }

  .post.lit :global(.seal) {
    box-shadow: 0 0 0 4px var(--gold-wash);
  }

  @media (max-width: 640px) {
    .post span {
      display: none;
    }

    .post :global(.seal) {
      --s: 24px !important;
    }
  }

  /* 墨 walks from the left edge to just short of the pot. */
  .walker {
    position: absolute;
    bottom: calc(var(--safe-bottom) + 18px);
    left: calc(
      var(--gutter) + var(--p) * (100% - 2 * var(--gutter) - var(--walker-w) - var(--pot-w))
    );
    width: var(--walker-w);
    filter: drop-shadow(0 4px 4px rgb(26 28 30 / 0.12));
  }

  .plant-pot {
    position: absolute;
    right: var(--gutter);
    bottom: calc(var(--safe-bottom) + 2px);
    width: var(--pot-w);
  }

  @media (max-width: 640px) {
    .road {
      --walker-w: 46px;
      --pot-w: 54px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hint :global(.icon),
    .hero-text,
    .hero-seal {
      animation: none;
    }
  }
</style>
