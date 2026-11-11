<script lang="ts">
  // What a pronunciation check found: the score, what was heard, and each syllable with its tone,
  // the learner's pitch drawn over the ideal tone shape.
  import { TONE_TEMPLATES, toToneMarkedSyllables } from '@taiwan-mandarin/shared';
  import type { PronounceResult, SyllableResult } from '@taiwan-mandarin/shared/api';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    result: PronounceResult;
    /** Centred, as on a study card. */
    centered?: boolean;
  }

  let { result, centered = false }: Props = $props();

  function message(s: SyllableResult): string {
    const say = t().speak;
    if (s.sound === 'missing') return say.notHeard;
    if (s.sound === 'wrong') return say.heard(s.heard ?? '?');
    if (s.tone === 'wrong' && s.heardTone) {
      return say.sounded(say.tones[s.heardTone - 1] ?? '', say.tones[s.expectedTone - 1] ?? '');
    }
    if (s.tone === 'unclear') return say.unclear;
    return s.tone === 'neutral' ? say.neutral : say.good;
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

<div class="result" class:centered>
  <div class="score">
    <strong class="tabular">{result.score}</strong>
    <span
      >{t().speak.heardLabel}:
      <span class="hanzi" lang="zh-Hant-TW">{result.transcript || '—'}</span></span
    >
  </div>
  <ul class="syllables">
    {#each result.syllables as s, i (i)}
      {@const bad = s.sound !== 'ok' || s.tone === 'wrong'}
      <li class:bad class:unclear={!bad && s.tone === 'unclear'}>
        <span class="ch hanzi" lang="zh-Hant-TW">{s.char}</span>
        <span class="py">
          {marked(s.pinyin)}{#if s.expectedTone !== 5 && !s.pinyin.endsWith(String(s.expectedTone))}
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
  <p class="legend">{t().speak.legend}</p>
</div>

<style>
  .score {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
  }

  .score strong {
    font-family: var(--font-display);
    font-size: 34px;
  }

  .score .hanzi {
    font-size: var(--fs-lg);
  }

  .syllables {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sp-2);
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .centered .score,
  .centered .syllables {
    justify-content: center;
  }

  .syllables li {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 92px;
    padding: 10px 10px var(--sp-2);
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
    font-size: var(--fs-3xl);
    line-height: 1.1;
  }

  .py {
    font-size: var(--fs-sm);
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
    font-size: var(--fs-xs);
    color: var(--ink-2);
    text-align: center;
  }

  .legend {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
</style>
