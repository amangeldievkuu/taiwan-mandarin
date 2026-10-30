<script lang="ts" module>
  import type { CharacterJson } from 'hanzi-writer';

  /** `tw` is true only when the order is verified against the Taiwan MOE standard. */
  type StrokeData = CharacterJson & { tw: boolean };

  // Characters checked against the Taiwan MOE standard (scripts/build-strokes.ts). Everything
  // else comes from hanzi-writer-data on jsDelivr; the service worker keeps it for offline use.
  const CDN = 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/';
  let overrides: Promise<Record<string, StrokeData>> | undefined;
  const loadOverrides = () =>
    (overrides ??= fetch(`${import.meta.env.BASE_URL}strokes-tw.json`)
      .then((r): Promise<Record<string, StrokeData>> | Record<string, StrokeData> =>
        r.ok ? r.json() : {},
      )
      .catch((): Record<string, StrokeData> => ({})));

  async function loadChar(char: string): Promise<StrokeData> {
    const verified = (await loadOverrides())[char];
    if (verified) return verified;
    const response = await fetch(`${CDN}${encodeURIComponent(char)}.json`);
    if (!response.ok) throw new Error(`No stroke data for ${char}`);
    return { ...((await response.json()) as CharacterJson), tw: false };
  }

  // The faint character to trace can be hidden, to write from memory: a per-device choice that
  // stays from one character to the next.
  const OUTLINE_KEY = 'taiwan-mandarin:stroke-outline';
  const outline = $state({ shown: readOutline() });

  function readOutline(): boolean {
    try {
      return localStorage.getItem(OUTLINE_KEY) !== '0';
    } catch {
      return true;
    }
  }
</script>

<script lang="ts">
  import HanziWriter from 'hanzi-writer';
  import { flushSync, untrack } from 'svelte';
  import Icon from '../ui/Icon.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { reduced } from '../lib/motion';
  import { store } from '../lib/store.svelte';

  interface Props {
    char: string;
  }

  let { char }: Props = $props();

  const SIZE = 240;
  /** Full screen never draws bigger than this (an iPad held upright). */
  const MAX_SIZE = 640;
  const padding = (size: number) => Math.round(size / 15);

  // One drawing, two places for it: on the page, and in the full-screen view.
  type Place = 'page' | 'focus';
  const hosts: Partial<Record<Place, HTMLDivElement>> = {};
  let dialog: HTMLDialogElement;
  let stage: HTMLDivElement;
  /** The sheet is on its way between the page and full screen. */
  let morphing = $state(false);
  let writer: HanziWriter | undefined;
  let mode = $state<'idle' | 'animating' | 'quiz' | 'done'>('idle');
  let status = $state('');
  let missing = $state(false);
  let verified = $state<boolean | null>(null);
  let scheme = $state(0);
  let focused = $state(false);
  let stageWidth = $state(0);
  let stageHeight = $state(0);
  const focusSize = $derived(
    Math.max(0, Math.min(MAX_SIZE, Math.floor(Math.min(stageWidth, stageHeight)) - 2)),
  );
  /** Full screen takes the drawing once its stage has been measured. */
  const place = $derived<{ host: Place; size: number }>(
    focused && focusSize > 0 ? { host: 'focus', size: focusSize } : { host: 'page', size: SIZE },
  );

  function cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Re-create the writer when the character or the color scheme changes.
  $effect(() => {
    void scheme;
    const current = char;
    missing = false;
    verified = null;
    mode = 'idle';
    status = '';
    const { host, size } = untrack(() => place);
    const shown = untrack(() => outline.shown);
    // The targets are empty elements owned by hanzi-writer, not by Svelte.
    hosts.page?.replaceChildren();
    hosts.focus?.replaceChildren();
    const target = hosts[host];
    if (!target) return;
    const w = HanziWriter.create(target, current, {
      width: size,
      height: size,
      padding: padding(size),
      showOutline: shown,
      // Without the outline the sheet starts blank: nothing to copy before you write.
      showCharacter: shown,
      strokeColor: cssVar('--ink'),
      outlineColor: cssVar('--stroke-outline'),
      drawingColor: cssVar('--seal'),
      highlightColor: cssVar('--seal'),
      radicalColor: null,
      strokeAnimationSpeed: 1,
      delayBetweenStrokes: 220,
      drawingWidth: 18,
      charDataLoader: (c, onLoad, onError) => {
        loadChar(c).then((entry) => {
          verified = entry.tw;
          onLoad(entry);
        }, onError);
      },
      onLoadCharDataError: () => (missing = true),
    });
    writer = w;
    return () => {
      w.cancelQuiz();
      writer = undefined;
    };
  });

  // Move the drawing (hanzi-writer's own <svg>) between the page and full screen, and fit it.
  // Resizing keeps an animation or a quiz going where it was.
  $effect(() => {
    const { host, size } = place;
    const target = hosts[host];
    const drawing = hosts[host === 'focus' ? 'page' : 'focus']?.firstElementChild;
    if (target && drawing) target.append(drawing);
    writer?.updateDimensions({ width: size, height: size, padding: padding(size) });
  });

  // Colors come from CSS variables: redraw when the theme (system or in-app) changes.
  $effect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => scheme++;
    media.addEventListener('change', onChange);
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
    return () => {
      media.removeEventListener('change', onChange);
      observer.disconnect();
    };
  });

  function animate() {
    if (!writer) return;
    writer.cancelQuiz();
    writer.showCharacter();
    mode = 'animating';
    status = '';
    void writer.animateCharacter({ onComplete: () => (mode = 'idle') });
  }

  function practice() {
    if (!writer) return;
    mode = 'quiz';
    const say = t().strokes;
    status = say.first;
    void writer.quiz({
      showHintAfterMisses: 3,
      onCorrectStroke: ({ strokesRemaining }) =>
        (status = strokesRemaining ? say.left(strokesRemaining) : ''),
      onMistake: ({ mistakesOnStroke }) => (status = mistakesOnStroke >= 3 ? say.hint : say.again),
      onComplete: ({ totalMistakes }) => {
        mode = 'done';
        void store.practiced('write', char);
        status = totalMistakes ? say.done(totalMistakes) : say.perfect;
      },
    });
  }

  function toggleOutline() {
    outline.shown = !outline.shown;
    try {
      localStorage.setItem(OUTLINE_KEY, outline.shown ? '1' : '0');
    } catch {
      // per-device preference only
    }
    if (!writer) return;
    if (outline.shown) writer.showOutline();
    else writer.hideOutline();
    // Before practice, the character goes with its outline: a blank sheet to write on.
    if (mode === 'idle') {
      if (outline.shown) writer.showCharacter();
      else writer.hideCharacter();
    }
  }

  // Full screen opens and closes as one movement: the sheet grows out of the page and back into
  // it, while the full-screen paper fades in or out around it (View Transitions, as page changes).
  function swap(update: () => void) {
    if (
      typeof document.startViewTransition !== 'function' ||
      document.visibilityState !== 'visible' ||
      reduced()
    ) {
      update();
      return;
    }
    const root = document.documentElement;
    // Named only while it moves, and before the browser takes its picture of the page.
    flushSync(() => (morphing = true));
    root.dataset['nav'] = 'sheet';
    const transition = document.startViewTransition(() => flushSync(update));
    void transition.finished.finally(() => {
      morphing = false;
      if (root.dataset['nav'] === 'sheet') delete root.dataset['nav'];
    });
  }

  function expand() {
    swap(() => {
      dialog.showModal();
      // Measured now rather than on the next resize callback, so the drawing is already in its
      // full-screen place and size when the transition looks at it.
      stageWidth = stage.clientWidth;
      stageHeight = stage.clientHeight;
      focused = true;
      // Full screen is for writing: practice starts unless something is already going on.
      if (mode === 'idle' || mode === 'done') practice();
    });
  }

  function collapse() {
    swap(() => {
      dialog.close();
      focused = false;
    });
  }
</script>

{#snippet board(where: Place, size: number)}
  <div
    class="canvas"
    class:quiz={mode === 'quiz'}
    style:--size="{size}px"
    style:view-transition-name={morphing && place.host === where ? 'stroke-sheet' : null}
  >
    <svg class="grid" viewBox="0 0 240 240" aria-hidden="true">
      <path d="M120 0v240M0 120h240M0 0l240 240M240 0L0 240" vector-effect="non-scaling-stroke" />
    </svg>
    <div
      class="target"
      bind:this={hosts[where]}
      aria-label={t().strokes.label(char)}
      role="img"
    ></div>
    {#if missing}
      <p class="missing">{t().strokes.missing} <span lang="zh-Hant-TW">{char}</span></p>
    {/if}
  </div>
{/snippet}

{#snippet controls(where: Place)}
  <div class="controls">
    {#if verified === false}
      <p class="unverified" lang="zh-Hant-TW" title={t().strokes.unverified}>
        筆順可能與臺灣標準不同
      </p>
    {/if}

    <div class="tools">
      <button
        type="button"
        class="tool"
        aria-pressed={!outline.shown}
        aria-label={t().strokes.hideOutline}
        title={t().strokes.hideOutline}
        onclick={toggleOutline}
        disabled={missing}
      >
        <Icon name={outline.shown ? 'eye' : 'eyeClosed'} />
      </button>
      <p class="status" aria-live="polite">{status}</p>
      {#if where === 'page'}
        <button
          type="button"
          class="tool"
          aria-label={t().strokes.fullScreen}
          title={t().strokes.fullScreen}
          onclick={expand}
          disabled={missing}
        >
          <Icon name="expand" />
        </button>
      {:else}
        <button
          type="button"
          class="tool"
          aria-label={t().strokes.exitFullScreen}
          title={t().strokes.exitFullScreen}
          onclick={collapse}
        >
          <Icon name="shrink" />
        </button>
      {/if}
    </div>

    <div class="actions">
      <button type="button" onclick={animate} disabled={missing || mode === 'animating'}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
        {t().strokes.order}
      </button>
      <button type="button" onclick={practice} disabled={missing}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7.5l3 3" />
        </svg>
        {mode === 'quiz' ? t().strokes.restart : t().strokes.practice}
      </button>
    </div>
  </div>
{/snippet}

<div class="stroke-writer">
  {@render board('page', SIZE)}
  {@render controls('page')}
</div>

<!-- Full screen, for writing on a phone: the same drawing, as big as the screen allows. Keys stay
     here, so the app's shortcuts don't navigate away underneath it. -->
<dialog
  class="stroke-focus"
  bind:this={dialog}
  aria-label={t().strokes.label(char)}
  oncancel={(e) => {
    // Escape and Android's back close it the same way the button does.
    e.preventDefault();
    collapse();
  }}
  onclose={() => (focused = false)}
  onkeydown={(e) => e.stopPropagation()}
>
  <div
    class="stage"
    bind:this={stage}
    bind:clientWidth={stageWidth}
    bind:clientHeight={stageHeight}
  >
    {@render board('focus', focusSize)}
  </div>
  {@render controls('focus')}
</dialog>

<style>
  .stroke-writer {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .canvas {
    position: relative;
    flex: none;
    width: calc(var(--size) + 2px);
    height: calc(var(--size) + 2px);
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
    touch-action: none;
    transition: border-color var(--dur) var(--ease);
  }

  .grid {
    position: absolute;
    inset: 0;
    fill: none;
    stroke: var(--rule);
    stroke-width: 1;
  }

  .grid {
    stroke-dasharray: 4 5;
  }

  .target {
    position: relative;
  }

  .canvas.quiz {
    border-color: color-mix(in srgb, var(--seal) 50%, transparent);
  }

  .missing {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    font-size: 15px;
    color: var(--ink-2);
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  .unverified {
    margin: 10px 0 0;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 18px;
    color: var(--hard);
    background: color-mix(in srgb, var(--hard) 12%, transparent);
  }

  /* Outline and full screen at either end, the quiz's progress between them */
  .tools {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin: 6px 0;
  }

  .tool {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: var(--ink-2);
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }

  .tool:hover:not(:disabled) {
    background: var(--fill);
    color: var(--ink);
  }

  .tool[aria-pressed='true'] {
    color: var(--seal);
    background: var(--seal-wash);
  }

  .tool:disabled {
    opacity: 0.4;
  }

  .status {
    flex: 1;
    min-height: 20px;
    margin: 0;
    font-size: 15px;
    text-align: center;
    color: var(--ink-2);
  }

  .actions {
    display: flex;
    gap: 8px;
    width: 100%;
  }

  .actions button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    border-radius: var(--radius);
    font-size: 15px;
    font-weight: 600;
    color: var(--seal);
    background: color-mix(in srgb, var(--seal) 10%, transparent);
  }

  .actions button:disabled {
    opacity: 0.4;
  }

  .actions svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  /* Full screen: the sheet in the middle, as big as fits, the controls under it within thumb's
     reach (beside it on a phone held sideways). */
  .stroke-focus {
    inset: 0;
    width: auto;
    height: auto;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: calc(var(--safe-top) + 16px) calc(env(safe-area-inset-right, 0px) + 16px)
      calc(var(--safe-bottom) + 16px) calc(env(safe-area-inset-left, 0px) + 16px);
    border: 0;
    color: var(--ink);
    background: var(--paper);
    overscroll-behavior: contain;
    /* Its own layer in the transition: in the top layer, so above the nav's and the toasts'. */
    view-transition-name: stroke-focus;
  }

  .stroke-focus[open] {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  /* Without the View Transitions API, full screen still fades in. */
  @supports not (view-transition-name: none) {
    .stroke-focus[open] {
      animation: focus-in var(--dur-3) var(--ease-out);
    }
  }

  /* Over the paper, which would otherwise paint above it (top layer) while it fades. */
  :global(::view-transition-group(stroke-sheet)) {
    z-index: 1;
    animation-duration: var(--dur-4);
    animation-timing-function: var(--ease-out);
  }

  :global(::view-transition-old(stroke-sheet)),
  :global(::view-transition-new(stroke-sheet)) {
    animation-duration: var(--dur-4);
    animation-timing-function: var(--ease-out);
  }

  :global(::view-transition-old(stroke-focus)),
  :global(::view-transition-new(stroke-focus)) {
    animation-duration: var(--dur-3);
    animation-timing-function: var(--ease-out);
  }

  .stage {
    flex: 1;
    align-self: stretch;
    min-width: 0;
    min-height: 0;
    display: grid;
    place-items: center;
    /* A stroke that starts just off the sheet doesn't scroll or zoom anything. */
    touch-action: none;
  }

  .stroke-focus .controls {
    width: min(100%, 440px);
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .stroke-focus[open] {
      flex-direction: row;
    }

    .stroke-focus .controls {
      width: min(45%, 340px);
    }
  }

  /* Nothing behind full screen scrolls while it is open. */
  :global(html:has(dialog.stroke-focus[open])) {
    overflow: hidden;
  }

  @keyframes focus-in {
    from {
      opacity: 0;
    }
  }
</style>
