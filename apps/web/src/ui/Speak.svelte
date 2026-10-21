<script lang="ts">
  // Pronunciation practice: hear the word, record yourself, compare. Signed in, the recording is
  // checked on the server: syllables by speech-to-text (Whisper), tones from your pitch contour,
  // with your curve drawn over the ideal tone shape.
  import { TONE_TEMPLATES, toToneMarkedSyllables } from '@taiwan-mandarin/shared';
  import type { PronounceResult, SyllableResult } from '@taiwan-mandarin/shared/api';
  import Icon from './Icon.svelte';
  import { api } from '../lib/api';
  import { recorder, toWav } from '../lib/recorder.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { account } from '../lib/sync.svelte';

  interface Props {
    target: string;
    pinyin?: string;
  }

  let { target, pinyin }: Props = $props();
  let audioUrl = $state<string | null>(null);
  let checking = $state(false);
  let result = $state<PronounceResult | null>(null);
  let error = $state<string | null>(null);

  const TONE_NAMES = ['', '1st', '2nd', '3rd', '4th', 'neutral'];

  async function toggle() {
    if (recorder.recording) {
      const recording = await recorder.stop();
      if (!recording) return;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(recording.blob);
      if (account.user) await check(recording.blob);
    } else {
      result = null;
      error = null;
      await recorder.start();
    }
  }

  async function check(blob: Blob) {
    checking = true;
    try {
      const { wav } = await toWav(blob);
      const bytes = new Uint8Array(await wav.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      result = await api<PronounceResult>('/v1/speech/check', {
        method: 'POST',
        body: { audio: btoa(binary), target, ...(pinyin ? { pinyin } : {}) },
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      checking = false;
    }
  }

  function playMine() {
    if (audioUrl) void new Audio(audioUrl).play();
  }

  $effect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  });

  function message(s: SyllableResult): string {
    if (s.sound === 'missing') return 'Not heard';
    if (s.sound === 'wrong') return `Heard ${s.heard ?? '?'}`;
    if (s.tone === 'wrong' && s.heardTone) {
      return `Sounded ${TONE_NAMES[s.heardTone]}, needs ${TONE_NAMES[s.expectedTone]}`;
    }
    if (s.tone === 'unclear') return 'Tone unclear';
    return s.tone === 'neutral' ? 'Neutral tone' : 'Good';
  }

  /** SVG path through normalized points (0–1) in a 60×32 box. */
  function path(points: readonly number[]): string {
    return points
      .map((v, i) => {
        const x = (i / (points.length - 1)) * 56 + 2;
        const y = 30 - Math.max(0, Math.min(1, v)) * 28;
        return `${i ? 'L' : 'M'}${x},${y}`;
      })
      .join(' ');
  }

  const marked = (p: string) => toToneMarkedSyllables(p)[0] ?? p;
</script>

<div class="speak">
  <div class="controls">
    {#if canSpeak}
      <button type="button" class="btn quiet small" onclick={() => speak(target)}>
        <Icon name="speaker" size={18} /> Listen
      </button>
    {/if}
    {#if recorder.supported}
      <button
        type="button"
        class="btn small {recorder.recording ? 'seal recording' : 'primary'}"
        disabled={checking}
        onclick={toggle}
      >
        {#if recorder.recording}<Icon name="pause" size={18} /> Stop{:else}<Icon
            name="mic"
            size={18}
          />
          Record{/if}
      </button>
      {#if audioUrl && !recorder.recording}
        <button type="button" class="btn quiet small" onclick={playMine}>
          <Icon name="play" size={18} /> Play mine
        </button>
      {/if}
    {:else}
      <span class="hint">Recording isn't available in this browser.</span>
    {/if}
  </div>
  {#if recorder.error}<p class="hint">{recorder.error}</p>{/if}
  {#if !account.user && account.checked}
    <p class="hint">Sign in to get your syllables and tones checked.</p>
  {/if}
  {#if checking}<p class="hint">Listening…</p>{/if}
  {#if error}<p class="hint error">{error}</p>{/if}

  {#if result}
    <div class="result">
      <div class="score">
        <strong class="tabular">{result.score}</strong>
        <span>Heard: <span class="hanzi" lang="zh-Hant-TW">{result.transcript || '—'}</span></span>
      </div>
      <ul class="syllables">
        {#each result.syllables as s, i (i)}
          {@const bad = s.sound !== 'ok' || s.tone === 'wrong'}
          <li class:bad class:unclear={!bad && s.tone === 'unclear'}>
            <span class="ch hanzi" lang="zh-Hant-TW">{s.char}</span>
            <span class="py">
              {marked(
                s.pinyin,
              )}{#if s.expectedTone !== 5 && !s.pinyin.endsWith(String(s.expectedTone))}
                → {marked(s.pinyin.replace(/[1-5]$/, String(s.expectedTone)))}{/if}
            </span>
            {#if s.contour.length && s.expectedTone !== 5}
              <svg viewBox="0 0 60 32" aria-hidden="true">
                <path class="ideal" d={path(TONE_TEMPLATES[s.expectedTone as 1 | 2 | 3 | 4])} />
                <path class="yours" d={path(s.contour)} />
              </svg>
            {/if}
            <span class="msg">{message(s)}</span>
          </li>
        {/each}
      </ul>
      <p class="hint">Dashed: the tone you need. Solid: your pitch. Tone checks are approximate.</p>
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .recording {
    animation: pulse 1.2s infinite;
  }

  @keyframes pulse {
    50% {
      box-shadow: 0 0 0 8px var(--seal-wash);
    }
  }

  .hint {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--ink-2);
  }

  .error {
    color: var(--seal);
  }

  .result {
    margin-top: 14px;
  }

  .score {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .score strong {
    font-family: var(--font-serif);
    font-size: 34px;
  }

  .score .hanzi {
    font-size: 18px;
  }

  .syllables {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .syllables li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 92px;
    padding: 10px 10px 8px;
    border: 1px solid color-mix(in srgb, var(--jade) 45%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--jade) 7%, var(--paper-raised));
  }

  .syllables li.bad {
    border-color: color-mix(in srgb, var(--seal) 50%, transparent);
    background: var(--seal-wash);
  }

  .syllables li.unclear {
    border-color: color-mix(in srgb, var(--ochre) 50%, transparent);
    background: color-mix(in srgb, var(--ochre) 8%, var(--paper-raised));
  }

  .ch {
    font-size: 30px;
    line-height: 1.1;
  }

  .py {
    font-size: 13px;
    color: var(--ink-2);
  }

  svg {
    width: 60px;
    height: 32px;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .ideal {
    stroke: var(--ink-3);
    stroke-width: 2;
    stroke-dasharray: 3 3;
  }

  .yours {
    stroke: var(--seal);
    stroke-width: 2.5;
  }

  .msg {
    font-size: 12px;
    color: var(--ink-2);
    text-align: center;
  }
</style>
