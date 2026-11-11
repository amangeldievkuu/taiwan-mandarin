<script lang="ts" module>
  import { parseMode, type Mode } from '../lib/study-modes';

  const MODE_KEY = 'taiwan-mandarin:study-mode';

  function savedMode(): Mode {
    try {
      return parseMode(localStorage.getItem(MODE_KEY));
    } catch {
      return 'recognize';
    }
  }
</script>

<script lang="ts">
  // The study session: one card at a time on a little stack. Reveal it (tap, Space, or the
  // button), grade it, and it flies off (left for Again, right for Good: the direction tells the
  // grade, every grade gets the same energy and ink) while the next card rises from the stack.
  // Writing the word or saying it also opens the answer, and suggests a grade.
  import InkDrop from '../ui/InkDrop.svelte';
  import { XP } from '@taiwan-mandarin/shared';
  import { tick, untrack } from 'svelte';
  import HanziText from '../ui/HanziText.svelte';
  import Icon from '../ui/Icon.svelte';
  import Reading from '../ui/Reading.svelte';
  import SessionComplete from '../ui/SessionComplete.svelte';
  import TaiwanNote from '../components/TaiwanNote.svelte';
  import WordGlyphs, { fitSize } from '../components/WordGlyphs.svelte';
  import ModePicker from '../ui/study/ModePicker.svelte';
  import SpeakFace from '../ui/study/SpeakFace.svelte';
  import WriteFace from '../ui/study/WriteFace.svelte';
  import { celebrate } from '../lib/celebrate.svelte';
  import { companion } from '../lib/companion.svelte';
  import { content } from '../lib/content.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { glossOf, translationOf } from '../lib/i18n/content';
  import { formatInterval, t } from '../lib/i18n/index.svelte';
  import HanViet from '../ui/HanViet.svelte';
  import Localized from '../ui/Localized.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { flipFrom } from '../lib/motion';
  import { router } from '../lib/router.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { GRADES, Rating, type Grade } from '../lib/srs';
  import { COMBOS } from '../lib/mo';
  import { store } from '../lib/store.svelte';
  import { prefetchStrokes } from '../lib/strokes';
  import { isHan, maskOwnChars } from '../lib/study-modes';
  import { toasts } from '../lib/toast.svelte';
  import { cardIn, cardOut, flipIn, rise } from '../lib/transitions';

  type GradeName = keyof ReturnType<typeof t>['study']['grades'];
  const GRADE_INFO: Record<Grade, { name: GradeName; zh: string; color: string; key: string }> = {
    [Rating.Again]: { name: 'again', zh: '再來', color: 'var(--again)', key: '1' },
    [Rating.Hard]: { name: 'hard', zh: '困難', color: 'var(--hard)', key: '2' },
    [Rating.Good]: { name: 'good', zh: '記得', color: 'var(--good)', key: '3' },
    [Rating.Easy]: { name: 'easy', zh: '簡單', color: 'var(--easy)', key: '4' },
  };
  let mode = $state<Mode>(savedMode());
  $effect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // per-device preference only
    }
  });

  const word = $derived(store.current);
  const settings = $derived(store.settings);
  const isNew = $derived(word ? !store.cards[word.id] : false);
  const level = $derived(word ? t().levels[word.level] : undefined);
  const example = $derived(word?.examples?.[0]);
  /** The meaning as a question, without the word's own characters in it. */
  const prompt = $derived.by(() => {
    if (!word) return undefined;
    const gloss = glossOf(word);
    return { ...gloss, text: maskOwnChars(gloss.text, word.hanzi) };
  });
  const size = $derived(
    word
      ? fitSize(
          [...word.hanzi].length,
          settings.phonetics,
          132,
          'min(100vw - 2 * var(--gutter), 600px) - 64px',
        )
      : '',
  );
  /** One card per answer, so a card that comes straight back still animates in. */
  const cardKey = $derived(word ? `${word.id}:${store.stats.reviewed}` : '');
  const remaining = $derived(store.queue.length);
  /** Tapping the card shows the answer; writing and speaking need the card for themselves. */
  const tapReveals = $derived(mode !== 'write' && mode !== 'speak');

  /** The grade a written or spoken answer suggests, for this card in this mode only. */
  let suggestion = $state<{ key: string; grade: Grade } | null>(null);
  const suggested = $derived(
    suggestion && suggestion.key === `${cardKey}:${mode}` ? suggestion.grade : undefined,
  );
  function suggest(grade: Grade | undefined) {
    suggestion = grade ? { key: `${cardKey}:${mode}`, grade } : null;
  }
  let speakFace = $state<ReturnType<typeof SpeakFace>>();

  /** Which way the card just graded leaves; read when its exit starts. */
  let exitGrade = $state<Grade>(Rating.Good);
  /** Cards were studied in this visit (the end screen celebrates only then). */
  let studied = $state(false);
  let halfway = false;
  /** Right answers in a row (anything but "again"), for 墨 to cheer. */
  let run = 0;
  let glyphs = $state<HTMLElement>();
  let pressed = $state<string | null>(null);
  /** The phone's mode menu is open. */
  let modeOpen = $state(false);
  /** Just graded: the next card's "Show answer" ignores a second tap meant for the rating. */
  let cooling = $state(false);
  /** Read out by screen readers when an answer is taken back. */
  let announcement = $state('');

  // A new card is shown: note the time, and in listening mode play it. Only a new card counts:
  // revealing it or switching modes must not restart the clock.
  $effect(() => {
    if (!cardKey || !word) return;
    const shown = word;
    untrack(() => {
      studied = true;
      store.markShown();
      if (mode === 'listen' && !store.revealed) speak(shown.hanzi);
    });
  });

  // Writing: the next card's strokes load while this one is written, so its sheet is ready.
  $effect(() => {
    if (mode !== 'write') return;
    const next = store.queue[1];
    const nextWord = next ? content.word(next) : undefined;
    if (nextWord) prefetchStrokes([...nextWord.hanzi].filter(isHan));
  });

  // Switching to listening mode on a hidden card plays it.
  let lastMode = untrack(() => mode);
  $effect(() => {
    if (mode === lastMode) return;
    lastMode = mode;
    untrack(() => {
      if (mode === 'listen' && word && !store.revealed) speak(word.hanzi);
    });
  });

  async function reveal() {
    if (!word || store.revealed) return;
    // The glyph glides up as the answer opens beneath it, instead of jumping.
    const before = mode === 'recognize' ? glyphs?.getBoundingClientRect() : undefined;
    store.reveal();
    if (mode !== 'listen') speak(word.hanzi);
    await tick();
    if (before && glyphs) flipFrom(glyphs, before);
  }

  function grade(g: Grade) {
    if (!store.revealed || !word) return;
    const from = document
      .querySelector(`.rate[data-key="${GRADE_INFO[g].key}"]`)
      ?.getBoundingClientRect();
    const gained = XP.review + (isNew ? XP.newWord : 0);
    exitGrade = g;
    cooling = true;
    setTimeout(() => (cooling = false), 320);
    feedback.play('grade');
    feedback.buzz('light');
    store.rate(g);
    if (from) celebrate.float(from, `+${gained}`);
    run = g === Rating.Again ? 0 : run + 1;
    if (!store.queue.length) companion.say('finished');
    else if (COMBOS.includes(run)) companion.say('combo', run);
    const total = store.finished + store.queue.length;
    if (!halfway && total >= 8 && store.progress >= 0.5 && store.queue.length) {
      halfway = true;
      toasts.show(
        { kind: 'info', title: `一半了！ ${t().study.halfway}`, body: t().study.halfwayBody },
        2600,
      );
    }
  }

  /** Takes back the last answer (until it is sent): the card comes back with its answer open. */
  async function undo() {
    if (!store.canUndo || !(await store.undo())) return;
    feedback.play('toggle');
    feedback.buzz('light');
    run = Math.max(0, run - 1);
    announcement = '';
    await tick();
    announcement = t().study.undone;
  }

  /** A key press shows on its button too. */
  function press(key: string) {
    pressed = key;
    setTimeout(() => {
      if (pressed === key) pressed = null;
    }, 140);
  }

  function onkeydown(event: KeyboardEvent) {
    if (lookup.open) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
    // U, or Ctrl/Cmd+Z as elsewhere.
    const command = event.metaKey || event.ctrlKey;
    const undoKey = command ? event.key.toLowerCase() === 'z' : event.key === 'u';
    if (store.canUndo && !modeOpen && undoKey && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      press('undo');
      void undo();
      return;
    }
    if (command || event.altKey) return;
    if (modeOpen) {
      if (event.key === 'Escape') modeOpen = false;
      return;
    }
    if (!store.revealed && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      press('show');
      void reveal();
      return;
    }
    if (mode === 'speak' && !store.revealed) {
      // M records; R would say the reading this card asks for.
      if (event.key === 'm') void speakFace?.toggle();
      return;
    }
    if (event.key === 'r' && word) speak(word.hanzi);
    if (store.revealed) {
      const g = GRADES.find((x) => GRADE_INFO[x].key === event.key);
      if (g) {
        press(event.key);
        grade(g);
      }
    }
  }

  // When only short learning steps remain, bring them back once they are due.
  $effect(() => {
    if (store.queue.length || !store.nextDue) return;
    const wait = store.nextDue.getTime() - Date.now();
    if (wait > 60 * 60 * 1000) return;
    const timer = setTimeout(() => void store.refreshQueue(), Math.max(wait, 0) + 1000);
    return () => clearTimeout(timer);
  });
</script>

<svelte:window {onkeydown} />

{#snippet undoButton()}
  {#if store.canUndo}
    <button
      type="button"
      class="chip undo"
      class:pressed={pressed === 'undo'}
      title={t().study.undoHint}
      aria-label={t().study.undo}
      aria-keyshortcuts="U Control+Z Meta+Z"
      onclick={undo}
      in:rise={{ y: -4 }}
    >
      <Icon name="undo" size={16} />
      <span class="undo-label">{t().study.undo}</span>
    </button>
  {/if}
{/snippet}

<section class="study">
  <header class="top">
    <ModePicker bind:mode bind:open={modeOpen} />
    {#if word}
      <div class="counters">
        {@render undoButton()}
        {#key store.sessionXp}<span
            class="session-xp"
            aria-label={t().study.sessionXp(store.sessionXp)}
            ><InkDrop size={12} /> {store.sessionXp}</span
          >{/key}
        <span class="left tabular" aria-label={t().study.cardsLeft(remaining)}
          >{t().study.left(remaining)}</span
        >
      </div>
    {/if}
  </header>

  {#if word}
    <!-- 墨 sits on the right-hand end of the progress bar, clear of the buttons below. -->
    <div
      class="progress"
      use:companion.perch
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(store.progress * 100)}
    >
      <span style:transform="translateX({(store.progress - 1) * 100}%)"></span>
    </div>

    <div class="deck" class:stacked={remaining > 1} class:tall={remaining > 2}>
      {#key cardKey}
        <!-- Tapping the card also reveals; keyboard users get Space/Enter and the button below. -->
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
        <article
          class="card sheet"
          class:revealed={store.revealed}
          class:taps={tapReveals}
          class:plain={!tapReveals}
          class:writing={mode === 'write'}
          onclick={tapReveals ? reveal : undefined}
          in:cardIn
          out:cardOut={{ grade: exitGrade }}
        >
          <div class="meta">
            {#if isNew}<span class="new">{t().study.new}</span>{/if}
            {#if level}<span class="level-tag">{level}</span>{/if}
            {#if word.tw}<span class="badge-tw" lang="zh-Hant-TW">臺灣</span>{/if}
          </div>

          <div class="face">
            {#if mode === 'recall' && !store.revealed && prompt}
              <p class="prompt"><Localized value={prompt} /></p>
              {#if word.cl}<p class="prompt-sub">
                  {t().study.measureWordInline}
                  <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
                </p>{/if}
              <p class="prompt-sub tap">{t().study.tapToSee}</p>
            {:else if mode === 'listen' && !store.revealed}
              <button
                type="button"
                class="listen"
                aria-label={t().study.playAgain}
                onclick={(e) => {
                  e.stopPropagation();
                  speak(word.hanzi);
                }}
              >
                <Icon name="speaker" size={40} />
              </button>
              <p class="prompt-sub">{t().study.tapToHear}</p>
            {:else if mode === 'write'}
              <WriteFace
                {word}
                {size}
                phonetics={settings.phonetics}
                revealed={store.revealed}
                onwritten={reveal}
                onsuggest={suggest}
              />
            {:else if mode === 'speak'}
              <SpeakFace
                bind:this={speakFace}
                {word}
                {size}
                phonetics={settings.phonetics}
                revealed={store.revealed}
                onanswered={reveal}
                onsuggest={suggest}
              />
            {:else if mode === 'recognize'}
              <div class="glyphs" bind:this={glyphs}>
                <WordGlyphs {word} {size} phonetics={settings.phonetics} show={store.revealed} />
              </div>
            {:else}
              <div class="glyphs" in:flipIn>
                <WordGlyphs {word} {size} phonetics={settings.phonetics} show={store.revealed} />
              </div>
            {/if}
          </div>

          {#if store.revealed}
            <div class="answer">
              <p class="meaning enter" style:--i={0}><Localized value={glossOf(word)} /></p>
              <div class="enter" style:--i={1}><HanViet reading={word.hv} /></div>
              {#if word.cl}<p class="cl enter" style:--i={1}>
                  {t().word.measureWord} <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
                </p>{/if}
              <div class="enter" style:--i={1}><TaiwanNote {word} /></div>
              {#if example}
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div class="example enter" style:--i={2} onclick={(e) => e.stopPropagation()}>
                  <HanziText text={example.zh} class="example-zh" />
                  <Reading
                    pinyin={example.pinyin}
                    text={example.zh}
                    wordLengths={example.wordLengths}
                  />
                  <p class="example-en"><Localized value={translationOf(example)} /></p>
                </div>
              {/if}
              <div class="answer-tools enter" style:--i={3}>
                {#if canSpeak}
                  <button
                    type="button"
                    class="tool"
                    aria-label={t().word.playPronunciation}
                    aria-keyshortcuts="r"
                    onclick={(e) => {
                      e.stopPropagation();
                      speak(word.hanzi);
                    }}
                  >
                    <Icon name="speaker" />
                  </button>
                {/if}
                <a
                  class="tool"
                  href={router.href(`/word/${encodeURIComponent(word.id)}`)}
                  aria-label={t().word.details}
                  onclick={(e) => {
                    e.stopPropagation();
                    router.link(e);
                  }}
                >
                  <Icon name="layers" />
                </a>
              </div>
            </div>
          {/if}
        </article>
      {/key}
    </div>

    <div class="controls">
      {#if store.revealed && store.intervals}
        <div class="ratings">
          {#each GRADES as g, i (g)}
            <button
              type="button"
              class="rate enter"
              class:pressed={pressed === GRADE_INFO[g].key}
              class:suggested={suggested === g}
              style:--c={GRADE_INFO[g].color}
              style:--i={i}
              aria-keyshortcuts={GRADE_INFO[g].key}
              data-key={GRADE_INFO[g].key}
              onclick={() => grade(g)}
            >
              <span class="rate-zh" lang="zh-Hant-TW">{GRADE_INFO[g].zh}</span>
              <span class="rate-label"
                >{t().study.grades[GRADE_INFO[g].name]} · {formatInterval(store.intervals[g])}</span
              >
              <kbd class="key">{GRADE_INFO[g].key}</kbd>
              {#if suggested === g}<span class="suggest-tag" in:rise={{ y: 4 }}
                  >{t().study.suggested}</span
                >{/if}
            </button>
          {/each}
        </div>
      {:else}
        <button
          type="button"
          class="btn primary show"
          class:pressed={pressed === 'show'}
          aria-keyshortcuts="Space"
          disabled={cooling}
          onclick={reveal}
        >
          {t().study.showAnswer} <kbd class="key">{t().study.space}</kbd>
        </button>
      {/if}
    </div>
  {:else}
    {#if store.canUndo}<div class="undo-row">{@render undoButton()}</div>{/if}
    <SessionComplete
      stats={store.stats}
      xp={store.sessionXp}
      streak={store.streak}
      nextDue={store.nextDue}
      celebrate={studied && store.stats.reviewed > 0}
    />
  {/if}
  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</section>

<style>
  /* Room for the fixed tab bar at the bottom (like .page), or a long answer would end under it. */
  .study {
    display: flex;
    flex-direction: column;
    max-width: calc(680px + 2 * var(--gutter));
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(var(--safe-top) + var(--sp-4)) var(--gutter)
      calc(var(--tabbar-h) + var(--safe-bottom) + 12px);
  }

  @media (min-width: 700px) {
    .study {
      padding-top: var(--sp-7);
      padding-bottom: var(--sp-7);
    }
  }

  /* The mode and the counters share a row while they fit; when a long mode name (Узнавание)
     doesn't, the counters drop to a row of their own, on the right. */
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2) var(--sp-3);
  }

  .counters {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    margin-left: auto;
  }

  .session-xp,
  .left {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    height: 32px;
    padding: 0 11px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-md);
    font-weight: var(--fw-heading);
    white-space: nowrap;
  }

  /* Taking back the last answer: quiet, beside the counters (icon only on narrow phones). */
  .undo {
    min-height: 32px;
    padding: 0 11px;
    font-size: var(--fs-md);
  }
  .undo.pressed {
    transform: scale(0.97);
  }
  @media (max-width: 400px) {
    .undo-label {
      display: none;
    }
  }
  .undo-row {
    display: flex;
    justify-content: center;
    margin: var(--sp-1) 0 var(--sp-2);
  }

  .session-xp {
    color: var(--gold-deep);
    background: var(--gold-wash);
    animation: bump var(--dur-4) var(--ease-spring);
  }

  @keyframes bump {
    40% {
      transform: scale(1.12);
    }
  }

  .left {
    color: var(--ink-2);
    background: var(--fill);
  }

  .progress {
    height: 10px;
    margin: var(--sp-4) 0 var(--sp-5);
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background:
      linear-gradient(to bottom, rgb(255 255 255 / 0.35), transparent 55%),
      linear-gradient(90deg, var(--jade), color-mix(in oklab, var(--jade) 60%, var(--sky)));
    transition: transform var(--dur-4) var(--ease-spring-soft);
  }

  /* The card, with the next ones peeking out underneath. */
  .deck {
    position: relative;
    flex: 1;
    display: grid;
    min-height: 380px;
  }

  .deck > :global(.card) {
    grid-area: 1 / 1;
  }

  .deck.stacked::before,
  .deck.tall::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: var(--radius-lg);
    background: var(--paper-raised);
    border: 1px solid var(--rule);
    box-shadow: var(--shadow-1);
  }

  .deck.stacked::before {
    transform: translateY(8px) scale(0.96);
    opacity: 0.8;
  }

  .deck.tall::after {
    transform: translateY(15px) scale(0.92);
    opacity: 0.5;
    z-index: -1;
  }

  .card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 380px;
    padding: var(--sp-5) var(--sp-6) var(--sp-6);
    box-shadow: var(--shadow-3);
    /* 田字格: a faint practice-paper cross behind the character */
    background-image:
      linear-gradient(var(--grid-line), var(--grid-line)),
      linear-gradient(var(--grid-line), var(--grid-line));
    background-size:
      1px 46%,
      46% 1px;
    background-position: center 42%;
    background-repeat: no-repeat;
  }

  .card.taps:not(.revealed) {
    cursor: pointer;
  }

  /* The writing sheet has its own ruling, and the spoken word sits above the mic. */
  .card.revealed,
  .card.plain {
    background-image: none;
  }

  /* A writing sheet as wide as the card allows, on a small phone too. */
  .card.writing:not(.revealed) {
    padding-inline: var(--sp-4);
  }

  .meta {
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 22px;
  }

  .new {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 9px;
    border-radius: var(--radius-pill);
    background: var(--sky);
    color: var(--sky-ink);
    font-size: var(--fs-2xs);
    font-weight: var(--fw-heading);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .face {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 180px;
  }

  .prompt {
    margin: 0;
    max-width: 22ch;
    font-family: var(--font-display);
    font-size: clamp(24px, 4vw, 34px);
    font-weight: var(--fw-heading);
    line-height: 1.25;
    text-align: center;
  }

  .prompt-sub {
    margin: 10px 0 0;
    color: var(--ink-2);
    font-size: var(--fs-md);
  }

  .prompt-sub.tap {
    color: var(--ink-3);
  }

  .listen {
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    border-radius: 50%;
    background: var(--sky-wash);
    color: var(--sky-text);
    box-shadow:
      inset 0 0 0 1px color-mix(in oklab, var(--sky) 22%, transparent),
      0 8px 20px -10px color-mix(in oklab, var(--sky) 50%, transparent);
    transition:
      transform 160ms var(--ease-out),
      box-shadow 160ms var(--ease-out),
      background-color var(--dur-2) var(--ease-out);
  }

  @media (hover: hover) {
    .listen:hover {
      background: color-mix(in oklab, var(--sky) 18%, var(--paper-raised));
    }
  }

  .listen:active {
    transform: scale(0.95);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--sky) 30%, transparent);
    transition-duration: 80ms;
  }

  .answer {
    width: 100%;
    max-width: 520px;
    text-align: center;
  }

  .meaning {
    margin: var(--sp-1) 0 0;
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    font-weight: var(--fw-strong);
    line-height: 1.35;
  }

  .cl {
    margin: 6px 0 0;
    font-size: var(--fs-md);
    color: var(--ink-2);
  }

  .cl .hanzi {
    font-size: var(--fs-lg);
    color: var(--ink);
  }

  .example {
    margin: var(--sp-4) auto 0;
    padding: var(--sp-3) var(--sp-4);
    border-left: 4px solid var(--sky);
    border-radius: 4px var(--radius-sm) var(--radius-sm) 4px;
    background: var(--sky-wash);
    text-align: left;
    cursor: auto;
  }

  .example :global(.example-zh) {
    display: block;
    font-size: var(--fs-xl);
    line-height: 1.5;
  }

  .example :global(.reading) {
    font-size: var(--fs-md);
  }

  .example-en {
    margin: var(--sp-1) 0 0;
    font-size: var(--fs-md);
    color: var(--ink-2);
  }

  .answer-tools {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: var(--sp-4);
  }

  .tool {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    color: var(--ink-2);
    background: var(--fill);
    transition: transform var(--dur-4) var(--ease-spring);
  }

  .tool:active {
    transform: scale(0.9);
  }

  /* Sticks above the tab bar while a long answer scrolls, so the grades are always in reach. */
  .controls {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom));
    z-index: 2;
    min-height: 92px;
    margin: 0 calc(-1 * var(--gutter));
    padding: var(--sp-5) var(--gutter) var(--sp-2);
    background: linear-gradient(to bottom, transparent, var(--paper) 20px);
  }

  @media (min-width: 700px) {
    .controls {
      bottom: 0;
    }
  }

  .show {
    width: 100%;
    min-height: 58px;
    font-size: var(--fs-lg);
  }

  .ratings {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--sp-2);
  }

  .rate {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 66px;
    padding: var(--sp-2) var(--sp-1);
    border-radius: var(--radius);
    border: 1px solid color-mix(in oklab, var(--c) 30%, transparent);
    background: color-mix(in oklab, var(--c) 8%, var(--paper-raised));
    color: var(--c);
    box-shadow:
      var(--shadow-1),
      0 4px 12px -6px color-mix(in oklab, var(--c) 35%, transparent);
    transition:
      transform 160ms var(--ease-out),
      box-shadow 160ms var(--ease-out),
      border-color var(--dur-2) var(--ease-out),
      background-color var(--dur-2) var(--ease-out);
  }

  @media (hover: hover) {
    .rate:hover {
      transform: translateY(-1px);
      border-color: color-mix(in oklab, var(--c) 45%, transparent);
      background: color-mix(in oklab, var(--c) 13%, var(--paper-raised));
    }
  }

  .rate:active,
  .rate.pressed {
    transform: scale(0.97);
    background: color-mix(in oklab, var(--c) 18%, var(--paper-raised));
    box-shadow: inset 0 1px 2px color-mix(in oklab, var(--c) 20%, transparent);
    transition-duration: 80ms;
  }

  /* The grade a written or spoken answer suggests: ringed and labelled; the learner still picks. */
  .rate.suggested {
    border-color: var(--c);
    box-shadow:
      0 0 0 2px color-mix(in oklab, var(--c) 45%, transparent),
      0 4px 12px -6px color-mix(in oklab, var(--c) 35%, transparent);
  }

  .suggest-tag {
    position: absolute;
    top: -9px;
    left: 50%;
    translate: -50% 0;
    padding: 0 7px;
    border-radius: var(--radius-pill);
    font-size: var(--fs-2xs);
    font-weight: var(--fw-heading);
    line-height: 18px;
    white-space: nowrap;
    color: var(--paper-raised);
    background: var(--c);
  }

  .rate-zh {
    font-family: var(--font-kai);
    font-size: var(--fs-xl);
    line-height: 1.2;
  }

  .rate-label {
    font-size: var(--fs-xs);
    font-weight: var(--fw-strong);
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }

  .key {
    display: none;
  }

  @media (hover: hover) and (pointer: fine) {
    .key {
      display: inline-grid;
    }

    .rate .key {
      position: absolute;
      top: 6px;
      right: 6px;
    }

    .show .key {
      color: color-mix(in srgb, var(--jade-ink) 75%, transparent);
      border-color: color-mix(in srgb, var(--jade-ink) 45%, transparent);
    }
  }
</style>
