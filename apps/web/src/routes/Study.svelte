<script lang="ts" module>
  type Mode = 'recognize' | 'recall' | 'listen';
  const MODE_KEY = 'taiwan-mandarin:study-mode';

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
  import { LEVELS } from '@taiwan-mandarin/shared';
  import HanziText from '../ui/HanziText.svelte';
  import Icon from '../ui/Icon.svelte';
  import Reading from '../ui/Reading.svelte';
  import Seal from '../ui/Seal.svelte';
  import Segmented from '../components/Segmented.svelte';
  import TaiwanNote from '../components/TaiwanNote.svelte';
  import WordGlyphs, { fitSize } from '../components/WordGlyphs.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { router } from '../lib/router.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { formatInterval, GRADES, Rating, type Grade } from '../lib/srs';
  import { store } from '../lib/store.svelte';

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

  // A new card is shown: note the time, and in listening mode play it.
  $effect(() => {
    if (!word) return;
    store.markShown();
    if (mode === 'listen' && !store.revealed) speak(word.hanzi);
  });

  function reveal() {
    if (!word || store.revealed) return;
    store.reveal();
    if (mode !== 'listen') speak(word.hanzi);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || lookup.open) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
    if (!store.revealed && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      reveal();
      return;
    }
    if (event.key === 'r' && word) speak(word.hanzi);
    if (store.revealed) {
      const grade = GRADES.find((g) => GRADE_INFO[g].key === event.key);
      if (grade) store.rate(grade);
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
      <Segmented
        label="Study mode"
        value={mode}
        onchange={(m) => (mode = m)}
        options={[
          { value: 'recognize', label: '認字', lang: 'zh-Hant-TW' },
          { value: 'recall', label: '回想', lang: 'zh-Hant-TW' },
          { value: 'listen', label: '聽力', lang: 'zh-Hant-TW' },
        ]}
      />
      <span class="mode-hint">
        {mode === 'recognize'
          ? 'See the word, recall the meaning'
          : mode === 'recall'
            ? 'See the meaning, recall the word'
            : 'Hear the word, recall it'}
      </span>
    </div>
    {#if word}
      <span class="left tabular" aria-label="{store.queue.length} cards left"
        >{store.queue.length}</span
      >
    {/if}
  </header>

  {#if word}
    <div
      class="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(store.progress * 100)}
    >
      <div style:transform="scaleX({store.progress})"></div>
    </div>

    <!-- Tapping the card also reveals; keyboard users get Space/Enter and the button below. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="card sheet" class:revealed={store.revealed} onclick={reveal}>
      <div class="meta">
        {#if isNew}<span class="new">New</span>{/if}
        {#if level}<span class="level-tag">{level.en}</span>{/if}
        {#if word.tw}<span class="badge-tw" lang="zh-Hant-TW">臺灣</span>{/if}
      </div>

      {#key word.id}
        <div class="face">
          {#if mode === 'recall' && !store.revealed}
            <p class="prompt">{word.en}</p>
            {#if word.cl}<p class="prompt-sub">
                measure word <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
              </p>{/if}
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
          {:else}
            <div class="glyphs">
              <WordGlyphs {word} {size} phonetics={settings.phonetics} show={store.revealed} />
            </div>
          {/if}
        </div>
      {/key}

      {#if store.revealed}
        <div class="answer">
          <p class="meaning">{word.en}</p>
          {#if word.cl}<p class="cl">
              Measure word <span class="hanzi" lang="zh-Hant-TW">{word.cl}</span>
            </p>{/if}
          <TaiwanNote {word} />
          {#if example}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="example" onclick={(e) => e.stopPropagation()}>
              <HanziText text={example.zh} class="example-zh" />
              <Reading pinyin={example.pinyin} />
              <p class="example-en">{example.en}</p>
            </div>
          {/if}
          <div class="answer-tools">
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

    <div class="controls">
      {#if store.revealed && store.intervals}
        <div class="ratings">
          {#each GRADES as grade (grade)}
            <button
              type="button"
              class="rate"
              style:--c={GRADE_INFO[grade].color}
              aria-keyshortcuts={GRADE_INFO[grade].key}
              onclick={() => store.rate(grade)}
            >
              <span class="rate-zh" lang="zh-Hant-TW">{GRADE_INFO[grade].zh}</span>
              <span class="rate-label">{GRADE_INFO[grade].label} · {store.intervals[grade]}</span>
              <kbd class="key">{GRADE_INFO[grade].key}</kbd>
            </button>
          {/each}
        </div>
      {:else}
        <button type="button" class="btn primary show" aria-keyshortcuts="Space" onclick={reveal}>
          Show answer <kbd class="key">Space</kbd>
        </button>
      {/if}
    </div>
  {:else}
    <div class="done">
      <Seal text="完" size={84} />
      <h1 class="hanzi" lang="zh-Hant-TW">今天完成了</h1>
      <p class="sub">
        {store.stats.reviewed ? 'All done for today.' : 'Nothing to study right now.'}
      </p>

      {#if store.stats.reviewed}
        <dl class="stats">
          <div>
            <dt>Reviews</dt>
            <dd class="tabular">{store.stats.reviewed}</dd>
          </div>
          <div>
            <dt>New words</dt>
            <dd class="tabular">{store.stats.learned}</dd>
          </div>
          <div>
            <dt>Again</dt>
            <dd class="tabular again">{store.stats.again}</dd>
          </div>
        </dl>
      {/if}

      {#if store.nextDue}
        <p class="next">
          Next review in {formatInterval(Math.max(0, store.nextDue.getTime() - Date.now()))}
        </p>
      {/if}
      <div class="done-actions">
        <a class="btn quiet" href={router.href('/read')} onclick={router.link}>Read a story</a>
        <a class="btn quiet" href={router.href('/path')} onclick={router.link}>Browse the path</a>
      </div>
    </div>
  {/if}
</section>

<style>
  .study {
    display: flex;
    flex-direction: column;
    max-width: calc(680px + 2 * var(--gutter));
    min-height: calc(100dvh - var(--tabbar-h) - var(--safe-bottom));
    margin: 0 auto;
    padding: calc(var(--safe-top) + 14px) var(--gutter) 16px;
  }

  @media (min-width: 700px) {
    .study {
      min-height: 100dvh;
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
    align-items: center;
    gap: 14px;
  }

  .modes :global(.segmented) {
    width: 220px;
  }

  .mode-hint {
    font-size: 13px;
    color: var(--ink-3);
  }

  @media (max-width: 560px) {
    .mode-hint {
      display: none;
    }
  }

  .left {
    font-family: var(--font-serif);
    font-size: 22px;
    font-weight: 600;
    color: var(--ink-2);
  }

  .progress {
    height: 3px;
    margin: 14px 0 16px;
    border-radius: 2px;
    background: var(--fill);
    overflow: hidden;
  }

  .progress div {
    height: 100%;
    background: var(--seal);
    transform-origin: left;
    transition: transform 400ms var(--ease);
  }

  .card {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 360px;
    padding: 18px 24px 22px;
    cursor: pointer;
    /* 田字格: practice-paper grid */
    background-image:
      linear-gradient(var(--grid-line), var(--grid-line)),
      linear-gradient(var(--grid-line), var(--grid-line));
    background-size:
      1px 100%,
      100% 1px;
    background-position: center;
    background-repeat: no-repeat;
  }

  .card.revealed {
    cursor: default;
    background-image: none;
  }

  .meta {
    align-self: stretch;
    display: flex;
    gap: 6px;
    min-height: 22px;
  }

  .new {
    padding: 1px 8px;
    border-radius: 4px;
    background: var(--ink);
    color: var(--paper);
    font-size: 11px;
    font-weight: 700;
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
    animation: ink 320ms var(--ease);
  }

  @keyframes ink {
    from {
      opacity: 0;
      filter: blur(4px);
    }
  }

  .prompt {
    margin: 0;
    max-width: 22ch;
    font-family: var(--font-serif);
    font-size: clamp(24px, 4vw, 34px);
    line-height: 1.25;
    text-align: center;
  }

  .prompt-sub {
    margin: 10px 0 0;
    color: var(--ink-2);
    font-size: 14px;
  }

  .listen {
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    border-radius: 50%;
    background: var(--seal-wash);
    color: var(--seal);
    transition: transform var(--dur) var(--ease);
  }

  .listen:active {
    transform: scale(0.95);
  }

  .answer {
    width: 100%;
    max-width: 520px;
    text-align: center;
    animation: ink 320ms var(--ease);
  }

  .meaning {
    margin: 4px 0 0;
    font-family: var(--font-serif);
    font-size: 22px;
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
    border-left: 3px solid var(--seal);
    border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    background: var(--paper);
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
    gap: 8px;
    margin-top: 12px;
  }

  .tool {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--ink-2);
    background: var(--fill);
  }

  .controls {
    padding-top: 16px;
  }

  .show {
    width: 100%;
    min-height: 56px;
    border-radius: var(--radius);
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
    min-height: 64px;
    padding: 8px 4px;
    border-radius: var(--radius);
    border: 1px solid color-mix(in srgb, var(--c) 35%, transparent);
    background: color-mix(in srgb, var(--c) 9%, var(--paper-raised));
    color: var(--c);
    transition:
      transform var(--dur) var(--ease),
      background-color var(--dur) var(--ease);
  }

  .rate:active {
    transform: scale(0.96);
  }

  @media (hover: hover) {
    .rate:hover {
      background: color-mix(in srgb, var(--c) 16%, var(--paper-raised));
    }
  }

  .rate-zh {
    font-family: var(--font-kai);
    font-size: 20px;
    line-height: 1.2;
  }

  .rate-label {
    font-size: 12px;
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
      color: color-mix(in srgb, var(--paper) 70%, transparent);
      border-color: color-mix(in srgb, var(--paper) 40%, transparent);
    }
  }

  .done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 0;
  }

  .done h1 {
    margin: 22px 0 4px;
    font-size: 34px;
  }

  .sub {
    margin: 0;
    color: var(--ink-2);
  }

  .stats {
    display: flex;
    gap: 32px;
    margin: 26px 0 0;
  }

  .stats div {
    display: flex;
    flex-direction: column-reverse;
  }

  .stats dt {
    font-size: 13px;
    color: var(--ink-2);
  }

  .stats dd {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 30px;
    font-weight: 600;
  }

  .again {
    color: var(--again);
  }

  .next {
    margin: 22px 0 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .done-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 26px;
  }
</style>
