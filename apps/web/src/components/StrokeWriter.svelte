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
</script>

<script lang="ts">
  import HanziWriter from 'hanzi-writer';

  const UNVERIFIED_HINT =
    'Stroke order comes from PRC data and has not been checked against the Taiwan MOE standard.';

  interface Props {
    char: string;
  }

  let { char }: Props = $props();

  const SIZE = 240;
  let target: HTMLDivElement;
  let writer: HanziWriter | undefined;
  let mode = $state<'idle' | 'animating' | 'quiz' | 'done'>('idle');
  let status = $state('');
  let missing = $state(false);
  let verified = $state<boolean | null>(null);
  let scheme = $state(0);

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
    // The target is an empty element owned by hanzi-writer, not by Svelte.
    // eslint-disable-next-line svelte/no-dom-manipulating
    target.replaceChildren();
    const w = HanziWriter.create(target, current, {
      width: SIZE,
      height: SIZE,
      padding: 16,
      showOutline: true,
      strokeColor: cssVar('--ink'),
      outlineColor: cssVar('--paper-sunken'),
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
    status = 'Draw the first stroke';
    void writer.quiz({
      showHintAfterMisses: 3,
      onCorrectStroke: ({ strokesRemaining }) =>
        (status = strokesRemaining ? `${strokesRemaining} strokes left` : ''),
      onMistake: ({ mistakesOnStroke }) =>
        (status = mistakesOnStroke >= 3 ? 'Follow the hint' : 'Try again'),
      onComplete: ({ totalMistakes }) => {
        mode = 'done';
        status = totalMistakes
          ? `Done · ${totalMistakes} ${totalMistakes === 1 ? 'mistake' : 'mistakes'}`
          : 'Perfect · no mistakes';
      },
    });
  }
</script>

<div class="stroke-writer">
  <div class="canvas" class:quiz={mode === 'quiz'}>
    <svg class="grid" viewBox="0 0 240 240" aria-hidden="true">
      <path d="M120 0v240M0 120h240M0 0l240 240M240 0L0 240" />
    </svg>
    <div class="target" bind:this={target} aria-label="Stroke order for {char}" role="img"></div>
    {#if missing}
      <p class="missing">No stroke data for <span lang="zh-Hant-TW">{char}</span></p>
    {/if}
  </div>

  {#if verified === false}
    <p class="unverified" lang="zh-Hant-TW" title={UNVERIFIED_HINT}>筆順可能與臺灣標準不同</p>
  {/if}

  <p class="status" aria-live="polite">{status}</p>

  <div class="actions">
    <button type="button" onclick={animate} disabled={missing || mode === 'animating'}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" /></svg>
      Stroke order
    </button>
    <button type="button" onclick={practice} disabled={missing}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10zM14 7.5l3 3" />
      </svg>
      {mode === 'quiz' ? 'Restart' : 'Practice writing'}
    </button>
  </div>
</div>

<style>
  .stroke-writer {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .canvas {
    position: relative;
    width: 242px;
    height: 242px;
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

  .unverified {
    margin: 10px 0 0;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 18px;
    color: var(--hard);
    background: color-mix(in srgb, var(--hard) 12%, transparent);
  }

  .status {
    min-height: 20px;
    margin: 10px 0 6px;
    font-size: 15px;
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
</style>
