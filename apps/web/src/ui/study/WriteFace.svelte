<script lang="ts">
  // 寫字: the meaning and the reading, and a blank sheet to write the word on from memory, one
  // character at a time (a hanzi-writer quiz: a wrong stroke shakes, three misses show its hint).
  // The last character written opens the answer; how it went suggests a grade.
  import {
    toToneMarkedSyllables,
    zhuyinString,
    type Phonetics,
    type Word,
  } from '@taiwan-mandarin/shared';
  import HanziWriter from 'hanzi-writer';
  import { untrack } from 'svelte';
  import Localized from '../Localized.svelte';
  import WritingPaper from '../WritingPaper.svelte';
  import WordGlyphs from '../../components/WordGlyphs.svelte';
  import { glossOf } from '../../lib/i18n/content';
  import { t } from '../../lib/i18n/index.svelte';
  import type { Grade } from '../../lib/srs';
  import { store } from '../../lib/store.svelte';
  import { loadChar, writerColors } from '../../lib/strokes';
  import { isHan, maskOwnChars, suggestWriteGrade } from '../../lib/study-modes';
  import { flipIn } from '../../lib/transitions';

  interface Props {
    word: Word;
    phonetics: Phonetics;
    /** CSS length for the hanzi in the answer. */
    size: string;
    revealed: boolean;
    /** The last character has been written. */
    onwritten: () => void;
    onsuggest: (grade: Grade | undefined) => void;
  }

  let { word, phonetics, size, revealed, onwritten, onsuggest }: Props = $props();

  /** Shown already answered (after an undo, or a mode switch): nothing was written here. */
  const answeredBefore = untrack(() => revealed);
  const chars = $derived([...word.hanzi]);
  /** Where the characters to write are; anything else (a letter) is given. */
  const targets = $derived(chars.flatMap((c, i) => (isHan(c) ? [i] : [])));
  const reading = $derived.by(() => {
    const pinyin = toToneMarkedSyllables(word.pinyin).join(' ');
    if (phonetics === 'pinyin') return { zhuyin: '', pinyin };
    return { zhuyin: zhuyinString(word.pinyin), pinyin: phonetics === 'both' ? pinyin : '' };
  });

  /** How many characters are written. */
  let written = $state(0);
  let mistakes = $state(0);
  let hints = $state(0);
  /** A character whose strokes couldn't load: the card is answered from memory instead. */
  let missing = $state<string | null>(null);
  /** A character's order is PRC data, not checked against the Taiwan standard. */
  let unverified = $state(false);
  let status = $state('');
  const done = $derived(targets.length > 0 && written >= targets.length);
  const prompt = $derived.by(() => {
    const gloss = glossOf(word);
    return { ...gloss, text: maskOwnChars(gloss.text, word.hanzi) };
  });

  let host = $state<HTMLDivElement>();
  let width = $state(0);
  let innerHeight = $state(800);
  /** As big as fits beside the prompt and the grade buttons, from a small phone to a desktop. */
  const sheet = $derived(Math.round(Math.max(180, Math.min(320, width || 320, innerHeight - 540))));
  const padding = (px: number) => Math.round(px / 15);
  let writer: HanziWriter | undefined;

  $effect(() => {
    if (!targets.length) missing = word.hanzi;
  });

  // One quiz per character. The next one starts a moment after the last stroke, once its flash
  // has been seen.
  $effect(() => {
    const index = written;
    const target = host;
    const char = chars[targets[index] ?? -1];
    if (!target || !char || revealed || missing) return;
    const px = untrack(() => sheet);
    const say = untrack(() => t().strokes);
    let next: ReturnType<typeof setTimeout> | undefined;
    const w = HanziWriter.create(target, char, {
      width: px,
      height: px,
      padding: padding(px),
      showOutline: false,
      showCharacter: false,
      ...untrack(() => writerColors(store.looks.brush)),
      radicalColor: null,
      drawingWidth: 18,
      charDataLoader: (c, onLoad, onError) => {
        loadChar(c).then((entry) => {
          if (!entry.tw) unverified = true;
          onLoad(entry);
        }, onError);
      },
      onLoadCharDataError: () => (missing = char),
    });
    writer = w;
    status = say.first;
    void w.quiz({
      showHintAfterMisses: 3,
      onCorrectStroke: ({ strokesRemaining }) =>
        (status = strokesRemaining ? say.left(strokesRemaining) : ''),
      onMistake: ({ mistakesOnStroke }) => {
        mistakes++;
        if (mistakesOnStroke === 3) hints++;
        status = mistakesOnStroke >= 3 ? say.hint : say.again;
      },
      onComplete: () => {
        next = setTimeout(() => (written = index + 1), 420);
      },
    });
    return () => {
      clearTimeout(next);
      w.cancelQuiz();
      target.replaceChildren();
      writer = undefined;
    };
  });

  // A new size (the phone turned, the window resized) keeps the quiz where it was.
  $effect(() => {
    const px = sheet;
    untrack(() => writer)?.updateDimensions({ width: px, height: px, padding: padding(px) });
  });

  $effect(() => {
    if (done && !untrack(() => revealed)) onwritten();
  });

  const suggestion = $derived(
    revealed && !answeredBefore && !missing
      ? suggestWriteGrade({ mistakes, hints, gaveUp: !done })
      : undefined,
  );
  $effect(() => onsuggest(suggestion));
</script>

<svelte:window bind:innerHeight />

{#if revealed}
  <div class="glyphs" in:flipIn>
    <WordGlyphs {word} {size} {phonetics} />
  </div>
  {#if done && !answeredBefore}
    <p class="result" class:clean={mistakes === 0}>{t().study.written(mistakes, hints)}</p>
    {#if unverified && mistakes > 0}
      <p class="unverified" lang="zh-Hant-TW" title={t().strokes.unverified}>
        筆順可能與臺灣標準不同
      </p>
    {/if}
  {/if}
{:else}
  <p class="prompt"><Localized value={prompt} /></p>
  <p class="reading">
    {#if reading.zhuyin}<span class="hanzi" lang="zh-Hant-TW">{reading.zhuyin}</span>{/if}
    {#if reading.pinyin}<span>{reading.pinyin}</span>{/if}
  </p>
  {#if word.cl}<p class="cl">
      {t().study.measureWordInline} <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
    </p>{/if}

  {#if targets.length > 1}
    <ol class="slots" lang="zh-Hant-TW" aria-hidden="true">
      {#each chars as char, i (i)}
        {@const at = targets.indexOf(i)}
        <li class:given={at < 0} class:written={at >= 0 && at < written} class:now={at === written}>
          {#if at < 0 || at < written}<span class="hanzi">{char}</span>{/if}
        </li>
      {/each}
    </ol>
  {/if}

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="board" bind:clientWidth={width} onclick={(e) => e.stopPropagation()}>
    {#if missing}
      <p class="missing">{t().study.noStrokes(missing)}</p>
    {:else}
      <WritingPaper size={sheet} active>
        <div
          class="target"
          bind:this={host}
          role="img"
          aria-label={t().study.sheet(written + 1, targets.length)}
        ></div>
      </WritingPaper>
    {/if}
  </div>
  <p class="status" aria-live="polite">{missing ? '' : status || t().study.writeIt}</p>
{/if}

<style>
  .glyphs {
    display: flex;
    justify-content: center;
  }

  .prompt {
    margin: 0;
    max-width: 24ch;
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    font-weight: var(--fw-heading);
    line-height: 1.25;
    text-align: center;
  }

  .reading {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 2px var(--sp-3);
    margin: 6px 0 0;
    font-size: var(--fs-lg);
    color: var(--ink-2);
  }

  .cl {
    margin: var(--sp-1) 0 0;
    font-size: var(--fs-sm);
    color: var(--ink-3);
  }

  .cl .hanzi {
    font-size: var(--fs-md);
    color: var(--ink-2);
  }

  /* Which character is next: written ones in ink, the one on the sheet ringed. */
  .slots {
    display: flex;
    gap: 6px;
    margin: var(--sp-3) 0 0;
    padding: 0;
    list-style: none;
  }

  .slots li {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1px dashed var(--rule);
    border-radius: var(--radius-sm);
    font-size: var(--fs-xl);
    transition:
      border-color var(--dur-2) var(--ease-out),
      background-color var(--dur-2) var(--ease-out);
  }

  .slots li.now {
    border: 2px solid color-mix(in srgb, var(--seal) 60%, transparent);
  }

  .slots li.written,
  .slots li.given {
    border-style: solid;
    background: var(--fill);
  }

  .board {
    display: flex;
    justify-content: center;
    width: 100%;
    margin-top: var(--sp-3);
    cursor: auto;
  }

  .target {
    position: relative;
  }

  .missing {
    max-width: 30ch;
    margin: var(--sp-4) 0;
    font-size: var(--fs-md);
    text-align: center;
    color: var(--ink-2);
  }

  .status {
    min-height: 20px;
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-md);
    text-align: center;
    color: var(--ink-2);
  }

  .result {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-md);
    font-weight: var(--fw-strong);
    color: var(--hard);
  }

  .result.clean {
    color: var(--jade-text);
  }

  .unverified {
    margin: 6px 0 0;
    padding: 2px var(--sp-2);
    border-radius: 6px;
    font-size: var(--fs-xs);
    line-height: 18px;
    color: var(--hard);
    background: color-mix(in srgb, var(--hard) 12%, transparent);
  }
</style>
