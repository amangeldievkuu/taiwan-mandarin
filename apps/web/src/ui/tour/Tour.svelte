<script lang="ts">
  // The welcome tour: a phone playing the app in four short scenes (Today, Study, Read, the
  // plant), with the step it shows written underneath. It plays while it is on screen and the
  // tab is visible, twice round, then waits for Replay. Pause, Play and the steps are buttons.
  // With reduced motion nothing moves by itself: each step shows a still, chosen with the steps.
  // The phone is drawn at a fixed size and scaled to fit, so it keeps the app's own proportions.
  import type { Component } from 'svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { reduced } from '../../lib/motion';
  import {
    frameAt,
    sceneStart,
    SCENES,
    stillFrame,
    TOUR_MS,
    type Frame,
    type Scene,
  } from '../../lib/tour';
  import Icon, { type IconName } from '../Icon.svelte';
  import GrowScene from './GrowScene.svelte';
  import ReadScene from './ReadScene.svelte';
  import StudyScene from './StudyScene.svelte';
  import TodayScene from './TodayScene.svelte';

  /** The phone's screen, drawn at this size and scaled. */
  const SCREEN = { w: 320, h: 660 };
  /** Times round before it stops and offers Replay. */
  const ROUNDS = 2;

  const VIEWS: Record<string, Component<{ frame: Frame }>> = {
    today: TodayScene,
    study: StudyScene,
    read: ReadScene,
    grow: GrowScene,
  };
  /** The tab bar in the picture, and the tab each scene is on. */
  const TABS: { icon: IconName; key: 'today' | 'study' | 'talk' | 'read' | 'dict' | 'me' }[] = [
    { icon: 'today', key: 'today' },
    { icon: 'study', key: 'study' },
    { icon: 'talk', key: 'talk' },
    { icon: 'read', key: 'read' },
    { icon: 'dict', key: 'dict' },
    { icon: 'me', key: 'me' },
  ];
  const TAB_OF = { today: 'today', study: 'study', read: 'read', grow: 'me' } as const;

  let elapsed = $state(0);
  /** The learner's choice: playing unless they paused (or the rounds ran out). */
  let playing = $state(!reduced());
  let inView = $state(false);
  let pageHidden = $state(false);
  /** Reduced motion: the step shown. */
  let stillScene = $state(0);
  let width = $state(SCREEN.w);
  let root = $state<HTMLElement>();

  const still = $derived(reduced());
  const frame = $derived(still ? stillFrame(stillScene) : frameAt(elapsed));
  const scene = $derived((SCENES[frame.scene] ?? SCENES[0]) as Scene);
  const View = $derived(VIEWS[scene.id] ?? TodayScene);
  const finished = $derived(elapsed >= TOUR_MS * ROUNDS);
  const scale = $derived(width / SCREEN.w);
  const steps = $derived(t().tour.steps);

  // The clock runs only while it is playing, on screen and the tab is in front.
  $effect(() => {
    if (still || !playing || !inView || pageHidden) return;
    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      elapsed = Math.min(elapsed + Math.min(now - last, 100), TOUR_MS * ROUNDS);
      last = now;
      if (elapsed >= TOUR_MS * ROUNDS) {
        playing = false;
        return;
      }
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  });

  $effect(() => {
    const el = root;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => (inView = !!entry?.isIntersecting), {
      threshold: 0.35,
    });
    observer.observe(el);
    const onVisibility = () => (pageHidden = document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  });

  function toggle() {
    if (finished) elapsed = 0;
    playing = !playing || finished;
  }

  function goTo(i: number) {
    if (still) {
      stillScene = i;
      return;
    }
    // Into the round being played, so a jump never ends it early.
    elapsed = Math.floor(elapsed / TOUR_MS) * TOUR_MS + sceneStart(i);
    if (elapsed >= TOUR_MS * ROUNDS) elapsed = sceneStart(i);
    playing = true;
  }

  /** How far each step's bar has filled. */
  const fill = (i: number) => (i < frame.scene ? 1 : i > frame.scene ? 0 : frame.progress);
</script>

<figure class="tour" bind:this={root} aria-labelledby="tour-title">
  <div class="phone" bind:clientWidth={width} style:--k={scale} aria-hidden="true">
    <div class="screen" style:width="{SCREEN.w}px" style:height="{SCREEN.h}px">
      <div class="status">
        <span>9:41</span>
        <span class="notch"></span>
        <span class="battery"></span>
      </div>
      <div class="view">
        {#key scene.id}
          <div class="scene-wrap"><View {frame} /></div>
        {/key}
      </div>
      <div class="tabs">
        {#each TABS as tab (tab.key)}
          <span class="tab" class:on={TAB_OF[scene.id] === tab.key}>
            <Icon name={tab.icon} size={20} />
            <span>{t().nav.tabs[tab.key]}</span>
          </span>
        {/each}
      </div>
    </div>
  </div>

  <figcaption>
    <h2 id="tour-title" class="visually-hidden">{t().tour.title}</h2>
    <div class="row">
      <ol class="steps">
        {#each SCENES as s, i (s.id)}
          <li class:current={i === frame.scene}>
            <button
              type="button"
              class="step"
              aria-current={i === frame.scene ? 'step' : undefined}
              onclick={() => goTo(i)}
            >
              <span class="bar" aria-hidden="true"
                ><span style:transform="scaleX({fill(i)})"></span></span
              >
              <span class="step-name">
                <span class="n">{i + 1}</span>
                {steps[i]?.title}
              </span>
            </button>
            <span class="visually-hidden">{steps[i]?.text}</span>
          </li>
        {/each}
      </ol>
      <!-- Play, Pause or Replay; with reduced motion, the next still. -->
      {#if still}
        <button
          type="button"
          class="control"
          aria-label={t().tour.next}
          title={t().tour.next}
          onclick={() => (stillScene = (stillScene + 1) % SCENES.length)}
        >
          <Icon name="forward" size={18} />
        </button>
      {:else}
        {@const label = finished ? t().tour.replay : playing ? t().tour.pause : t().tour.play}
        <button type="button" class="control" aria-label={label} title={label} onclick={toggle}>
          <Icon name={finished ? 'undo' : playing ? 'pause' : 'play'} size={18} />
        </button>
      {/if}
    </div>
    {#key frame.scene}
      <p class="text" aria-hidden="true">{steps[frame.scene]?.text}</p>
    {/key}
  </figcaption>
</figure>

<style>
  .tour {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-4);
    width: 100%;
    margin: 0;
  }

  /* The phone: the screen is drawn at its own size and scaled to the frame's width. Its body is
     near-black in both themes, edged with a hairline so it still shows on a dark page. */
  .phone {
    --bezel: #141517;
    position: relative;
    width: min(100% - 24px, var(--tour-w, 280px));
    aspect-ratio: 320 / 660;
    padding: 0;
    border-radius: calc(44px * var(--k));
    background: var(--bezel);
    box-shadow:
      0 0 0 calc(9px * var(--k)) var(--bezel),
      0 0 0 calc(10px * var(--k)) var(--rule-strong),
      var(--shadow-3);
    margin: calc(10px * var(--k));
  }

  .screen {
    position: absolute;
    top: 0;
    left: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 36px;
    background: var(--paper);
    transform: scale(var(--k));
    transform-origin: 0 0;
    /* The picture is never a target: no taps, no text selection. */
    pointer-events: none;
    user-select: none;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 30px;
    padding: 0 var(--sp-6);
    font-size: var(--fs-xs);
    font-weight: var(--fw-heading);
  }

  .notch {
    width: 84px;
    height: 20px;
    margin-top: -6px;
    border-radius: 0 0 14px 14px;
    background: var(--bezel);
  }

  .battery {
    width: 22px;
    height: 10px;
    border-radius: 3px;
    border: 1.5px solid var(--ink);
    background: linear-gradient(to right, var(--ink) 70%, transparent 70%) padding-box;
  }

  .view {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .scene-wrap {
    position: absolute;
    inset: 0;
    animation: scene-in var(--dur-4) var(--ease-spring-soft);
  }

  @keyframes scene-in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }

  .tabs {
    display: flex;
    height: 56px;
    padding: 0 var(--sp-1) 6px;
    border-top: 1px solid var(--rule);
    background: var(--paper-raised);
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    color: var(--ink-3);
    font-size: 9.5px;
    font-weight: var(--fw-strong);
    transition: color var(--dur-3) var(--ease-out);
  }

  .tab span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tab.on {
    color: var(--jade-text);
  }

  .tab.on :global(.icon) {
    padding: 2px 10px;
    box-sizing: content-box;
    border-radius: var(--radius-pill);
    background: var(--jade-wash);
  }

  /* ---- The steps underneath ---- */
  figcaption {
    width: 100%;
    max-width: 420px;
    container-type: inline-size;
  }

  .steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .step {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    width: 100%;
    min-height: 44px;
    padding: var(--sp-1) 0;
    text-align: left;
    color: var(--ink-3);
    transition: color var(--dur-2) var(--ease-out);
  }

  .current .step {
    color: var(--ink);
  }

  .bar {
    display: block;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--fill);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--jade);
    transform-origin: left;
  }

  .step-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--fs-sm);
    font-weight: var(--fw-strong);
    line-height: var(--lh-tight);
  }

  .n {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--fill);
    font-size: var(--fs-2xs);
    font-weight: var(--fw-heading);
  }

  .current .n {
    background: var(--jade);
    color: var(--jade-ink);
  }

  .steps li {
    position: relative;
    min-width: 0;
  }

  /* The current step's text, under all four. */
  .text {
    margin: var(--sp-3) 0 0;
    min-height: 3em;
    font-size: var(--fs-base);
    line-height: var(--lh-snug);
    color: var(--ink-2);
    text-align: center;
    animation: enter var(--dur-3) var(--ease-out);
  }

  .row {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
  }

  .row .steps {
    flex: 1;
    min-width: 0;
  }

  .control {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid var(--rule-strong);
    background: var(--paper-raised);
    box-shadow: var(--shadow-1);
    color: var(--ink-2);
    transition:
      transform 160ms var(--ease-out),
      background-color var(--dur-2) var(--ease-out);
  }

  @media (hover: hover) {
    .control:hover {
      color: var(--ink);
      background: color-mix(in oklab, var(--paper-raised) 94%, var(--ink));
    }
  }

  .control:active {
    transform: scale(0.94);
  }

  /* A narrow column (a phone, or beside the text on an iPad): the number above the name. */
  @container (max-width: 400px) {
    .step-name {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--sp-1);
      font-size: var(--fs-xs);
    }
  }
</style>
