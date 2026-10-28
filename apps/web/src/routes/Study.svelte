<script lang="ts" module>
  type Mode = 'recognize' | 'recall' | 'listen';
  const MODE_KEY = 'taiwan-mandarin:study-mode';
  const MODES: Mode[] = ['recognize', 'recall', 'listen'];
  /** What each mode asks of the learner; shown on the control and on the card itself. */
  const MODE_INFO: Record<Mode, { zh: string; en: string; hint: string }> = {
    recognize: { zh: '認字', en: 'Recognise', hint: 'See the word, recall the meaning' },
    recall: { zh: '回想', en: 'Recall', hint: 'See the meaning, recall the word' },
    listen: { zh: '聽力', en: 'Listen', hint: 'Hear the word, recall it' },
  };

  function savedMode(): Mode {
    try {
      const value = localStorage.getItem(MODE_KEY);
      return value === 'recall' || value === 'listen' ? value : 'recognize';
    } catch {
      return 'recognize';
    }
  }
</script>

<script lang="ts">
  // The study session: one card at a time on a little stack. Reveal it (tap, Space, or the
  // button), grade it, and it flies off (left for Again, right for Good: the direction tells the
  // grade, every grade gets the same energy and XP) while the next card rises from the stack.
  import { LEVELS, XP } from '@taiwan-mandarin/shared';
  import { tick, untrack } from 'svelte';
  import HanziText from '../ui/HanziText.svelte';
  import Icon from '../ui/Icon.svelte';
  import Reading from '../ui/Reading.svelte';
  import SessionComplete from '../ui/SessionComplete.svelte';
  import Segmented from '../components/Segmented.svelte';
  import TaiwanNote from '../components/TaiwanNote.svelte';
  import WordGlyphs, { fitSize } from '../components/WordGlyphs.svelte';
  import { celebrate } from '../lib/celebrate.svelte';
  import { companion } from '../lib/companion.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { flipFrom } from '../lib/motion';
  import { router } from '../lib/router.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { GRADES, Rating, type Grade } from '../lib/srs';
  import { store } from '../lib/store.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { cardIn, cardOut, flipIn, rise } from '../lib/transitions';

  const GRADE_INFO: Record<Grade, { label: string; zh: string; color: string; key: string }> = {
    [Rating.Again]: { label: 'Again', zh: '再來', color: 'var(--again)', key: '1' },
    [Rating.Hard]: { label: 'Hard', zh: '困難', color: 'var(--hard)', key: '2' },
    [Rating.Good]: { label: 'Good', zh: '記得', color: 'var(--good)', key: '3' },
    [Rating.Easy]: { label: 'Easy', zh: '簡單', color: 'var(--easy)', key: '4' },
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
  const level = $derived(word ? LEVELS.find((l) => l.id === word.level) : undefined);
  const example = $derived(word?.examples?.[0]);
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

  /** Which way the card just graded leaves; read when its exit starts. */
  let exitGrade = $state<Grade>(Rating.Good);
  /** Cards were studied in this visit (the end screen celebrates only then). */
  let studied = $state(false);
  let halfway = false;
  let glyphs = $state<HTMLElement>();
  let pressed = $state<string | null>(null);
  /** The phone's mode menu is open. */
  let modeOpen = $state(false);
  /** Just graded: the next card's "Show answer" ignores a second tap meant for the rating. */
  let cooling = $state(false);

  function pickMode(m: Mode) {
    mode = m;
    modeOpen = false;
  }

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
    const total = store.finished + store.queue.length;
    if (!halfway && total >= 8 && store.progress >= 0.5 && store.queue.length) {
      halfway = true;
      toasts.show(
        { kind: 'info', title: '一半了！ Halfway there', body: 'Keep going, you are doing great.' },
        2600,
      );
    }
  }

  /** A key press shows on its button too. */
  function press(key: string) {
    pressed = key;
    setTimeout(() => {
      if (pressed === key) pressed = null;
    }, 140);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || lookup.open) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
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

<section class="study">
  <header class="top">
    <div class="modes">
      <!-- Phones: one chip opens a menu, away from the card's tap target. -->
      <div class="mode-pick">
        <button
          type="button"
          class="chip mode-chip"
          aria-haspopup="menu"
          aria-expanded={modeOpen}
          aria-label="Study mode: {MODE_INFO[mode].en}"
          onclick={() => (modeOpen = !modeOpen)}
        >
          <span class="hanzi" lang="zh-Hant-TW">{MODE_INFO[mode].zh}</span>
          {MODE_INFO[mode].en}
          <svg class="chevron down" viewBox="0 0 8 14" aria-hidden="true"
            ><path d="M1 5l3 3 3-3" /></svg
          >
        </button>
        {#if modeOpen}
          <button
            type="button"
            class="mode-scrim"
            aria-label="Close"
            onclick={() => (modeOpen = false)}
          ></button>
          <div class="mode-menu sheet" role="menu" aria-label="Study mode" in:rise={{ y: -6 }}>
            {#each MODES as m (m)}
              <button
                type="button"
                class="mode-item"
                role="menuitemradio"
                aria-checked={mode === m}
                onclick={() => pickMode(m)}
              >
                <span class="mode-zh hanzi" lang="zh-Hant-TW">{MODE_INFO[m].zh}</span>
                <span class="mode-en">{MODE_INFO[m].en}<small>{MODE_INFO[m].hint}</small></span>
                {#if mode === m}<Icon name="check" size={18} />{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <!-- Tablets and desktops: the control inline. -->
      <div class="mode-inline">
        <Segmented
          label="Study mode"
          value={mode}
          onchange={pickMode}
          options={MODES.map((m) => ({
            value: m,
            label: MODE_INFO[m].zh,
            sub: MODE_INFO[m].en,
            lang: 'zh-Hant-TW',
          }))}
        />
      </div>
      <span class="mode-hint">{MODE_INFO[mode].hint}</span>
    </div>
    {#if word}
      <div class="counters">
        {#key store.sessionXp}<span
            class="session-xp"
            aria-label="{store.sessionXp} XP this session"
            ><span aria-hidden="true">✦</span> {store.sessionXp}</span
          >{/key}
        <span class="left tabular" aria-label="{remaining} cards left">{remaining} left</span>
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
          onclick={reveal}
          in:cardIn
          out:cardOut={{ grade: exitGrade }}
        >
          <div class="meta">
            {#if isNew}<span class="new">New</span>{/if}
            {#if level}<span class="level-tag">{level.en}</span>{/if}
            {#if word.tw}<span class="badge-tw" lang="zh-Hant-TW">臺灣</span>{/if}
            <span class="level-tag mode-tag {mode}" title={MODE_INFO[mode].hint}>
              <span class="hanzi" lang="zh-Hant-TW">{MODE_INFO[mode].zh}</span>
              {MODE_INFO[mode].en}
            </span>
          </div>

          <div class="face">
            {#if mode === 'recall' && !store.revealed}
              <p class="prompt">{word.en}</p>
              {#if word.cl}<p class="prompt-sub">
                  measure word <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
                </p>{/if}
              <p class="prompt-sub tap">Tap to see the word</p>
            {:else if mode === 'listen' && !store.revealed}
              <button
                type="button"
                class="listen"
                aria-label="Play again"
                onclick={(e) => {
                  e.stopPropagation();
                  speak(word.hanzi);
                }}
              >
                <Icon name="speaker" size={40} />
              </button>
              <p class="prompt-sub">Tap to hear it again</p>
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
              <p class="meaning enter" style:--i={0}>{word.en}</p>
              {#if word.cl}<p class="cl enter" style:--i={1}>
                  Measure word <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
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
                  <p class="example-en">{example.en}</p>
                </div>
              {/if}
              <div class="answer-tools enter" style:--i={3}>
                {#if canSpeak}
                  <button
                    type="button"
                    class="tool"
                    aria-label="Play pronunciation"
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
                  aria-label="Word details"
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
              style:--c={GRADE_INFO[g].color}
              style:--i={i}
              aria-keyshortcuts={GRADE_INFO[g].key}
              data-key={GRADE_INFO[g].key}
              onclick={() => grade(g)}
            >
              <span class="rate-zh" lang="zh-Hant-TW">{GRADE_INFO[g].zh}</span>
              <span class="rate-label">{GRADE_INFO[g].label} · {store.intervals[g]}</span>
              <kbd class="key">{GRADE_INFO[g].key}</kbd>
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
          Show answer <kbd class="key">Space</kbd>
        </button>
      {/if}
    </div>
  {:else}
    <SessionComplete
      stats={store.stats}
      xp={store.sessionXp}
      streak={store.streak}
      nextDue={store.nextDue}
      celebrate={studied && store.stats.reviewed > 0}
    />
  {/if}
</section>

<style>
  /* Room for the fixed tab bar at the bottom (like .page), or a long answer would end under it. */
  .study {
    display: flex;
    flex-direction: column;
    max-width: calc(680px + 2 * var(--gutter));
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(var(--safe-top) + 14px) var(--gutter)
      calc(var(--tabbar-h) + var(--safe-bottom) + 12px);
  }

  @media (min-width: 700px) {
    .study {
      padding-top: 28px;
      padding-bottom: 28px;
    }
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .modes {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    min-width: 0;
  }

  .mode-inline {
    display: none;
  }

  .modes :global(.segmented) {
    width: 270px;
  }

  .mode-hint {
    font-size: 13px;
    line-height: 1.3;
    color: var(--ink-3);
  }

  @media (min-width: 700px) {
    .modes {
      flex-direction: row;
      align-items: center;
      gap: 14px;
    }

    .mode-pick {
      display: none;
    }

    .mode-inline {
      display: block;
    }
  }

  /* The phone's mode menu */
  .mode-pick {
    position: relative;
  }

  .mode-chip {
    gap: 6px;
    font-weight: 700;
  }

  .mode-chip .hanzi {
    font-size: 16px;
  }

  .mode-chip .chevron {
    width: 8px;
    height: 14px;
    margin-left: 2px;
    transition: transform var(--dur-2) var(--ease-out);
  }

  .mode-chip[aria-expanded='true'] .chevron {
    transform: rotate(180deg);
  }

  .mode-scrim {
    position: fixed;
    inset: 0;
    z-index: 29;
    cursor: default;
  }

  .mode-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 30;
    width: min(300px, calc(100vw - 2 * var(--gutter)));
    padding: 6px;
    box-shadow: var(--shadow-3);
  }

  .mode-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 54px;
    padding: 8px 10px;
    border-radius: 12px;
    text-align: left;
    color: var(--ink);
  }

  .mode-item[aria-checked='true'] {
    background: var(--jade-wash);
    color: var(--jade-text);
  }

  .mode-item:active {
    background: var(--fill);
  }

  .mode-zh {
    font-size: 20px;
    flex: none;
  }

  .mode-en {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.2;
  }

  .mode-en small {
    font-size: 12px;
    font-weight: 500;
    color: var(--ink-3);
  }

  .counters {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
  }

  .session-xp,
  .left {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 32px;
    padding: 0 11px;
    border-radius: var(--radius-pill);
    font-size: 14px;
    font-weight: 800;
    white-space: nowrap;
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
    margin: 14px 0 18px;
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
    padding: 18px 24px 22px;
    cursor: pointer;
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

  .card.revealed {
    cursor: default;
    background-image: none;
  }

  .meta {
    align-self: stretch;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 22px;
  }

  /* Which mode the card is in, so an English front is never a surprise. */
  .mode-tag {
    margin-left: auto;
    gap: 4px;
  }

  .mode-tag .hanzi {
    font-size: 13px;
  }

  .mode-tag.recall {
    background: var(--sky-wash);
    color: var(--sky-text);
  }

  .mode-tag.listen {
    background: var(--jade-wash);
    color: var(--jade-text);
  }

  .new {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 9px;
    border-radius: var(--radius-pill);
    background: var(--sky);
    color: var(--sky-ink);
    font-size: 11px;
    font-weight: 800;
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
    font-weight: 800;
    line-height: 1.25;
    text-align: center;
  }

  .prompt-sub {
    margin: 10px 0 0;
    color: var(--ink-2);
    font-size: 14px;
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
    margin: 4px 0 0;
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    line-height: 1.35;
  }

  .cl {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .cl .hanzi {
    font-size: 18px;
    color: var(--ink);
  }

  .example {
    margin: 16px auto 0;
    padding: 12px 16px;
    border-left: 4px solid var(--sky);
    border-radius: 4px var(--radius-sm) var(--radius-sm) 4px;
    background: var(--sky-wash);
    text-align: left;
    cursor: auto;
  }

  .example :global(.example-zh) {
    display: block;
    font-size: 22px;
    line-height: 1.5;
  }

  .example :global(.reading) {
    font-size: 14px;
  }

  .example-en {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .answer-tools {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 14px;
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
    padding: 18px var(--gutter) 8px;
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
    font-size: 17px;
  }

  .ratings {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .rate {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 66px;
    padding: 8px 4px;
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

  .rate-zh {
    font-family: var(--font-kai);
    font-size: 21px;
    line-height: 1.2;
  }

  .rate-label {
    font-size: 12px;
    font-weight: 700;
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
