<script lang="ts">
  import { canSpeak, speak } from '../lib/speech';
  import { formatInterval, GRADES, Rating, type Grade } from '../lib/srs';
  import { store } from '../lib/store.svelte';
  import WordGlyphs, { fitSize } from './WordGlyphs.svelte';

  const GRADE_INFO: Record<Grade, { label: string; color: string; key: string }> = {
    [Rating.Again]: { label: 'Again', color: 'var(--again)', key: '1' },
    [Rating.Hard]: { label: 'Hard', color: 'var(--hard)', key: '2' },
    [Rating.Good]: { label: 'Good', color: 'var(--good)', key: '3' },
    [Rating.Easy]: { label: 'Easy', color: 'var(--easy)', key: '4' },
  };

  const word = $derived(store.current);
  const settings = $derived(store.settings);
  const size = $derived(
    word
      ? fitSize([...word.hanzi].length, settings.phonetics, 120, 'min(100vw, 560px) - 48px')
      : '',
  );

  function reveal() {
    if (!word || store.revealed) return;
    store.reveal();
    speak(word.hanzi);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea')) return;
    if (!store.revealed && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      reveal();
      return;
    }
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
    const timer = setTimeout(() => store.refreshQueue(), Math.max(wait, 0) + 1000);
    return () => clearTimeout(timer);
  });
</script>

<svelte:window {onkeydown} />

<section class="study">
  {#if word}
    <header>
      <div class="bar">
        <h1 class="title" lang="zh-Hant-TW">學習</h1>
        <span class="count">{store.queue.length} left</span>
      </div>
      <div
        class="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(store.progress * 100)}
      >
        <div style:transform="scaleX({store.progress})"></div>
      </div>
    </header>

    <!-- Tapping the card also reveals; keyboard users get Space/Enter and the button below. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="stage" onclick={reveal}>
      <div class="glyphs">
        {#key word.id}
          <WordGlyphs {word} {size} phonetics={settings.phonetics} show={store.revealed} />
        {/key}
      </div>
      {#if store.revealed}
        <div class="answer">
          <p class="meaning">{word[settings.meaning]}</p>
          {#if word.tw}
            <p class="note"><span class="badge-tw">台灣</span>{word.tw[settings.meaning]}</p>
          {/if}
          {#if canSpeak}
            <button
              type="button"
              class="audio"
              aria-label="Play pronunciation"
              onclick={(e) => {
                e.stopPropagation();
                speak(word.hanzi);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
                <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
              </svg>
            </button>
          {/if}
        </div>
      {/if}
    </div>

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
              <span class="label">{GRADE_INFO[grade].label}</span>
              <span class="interval">{store.intervals[grade]}</span>
            </button>
          {/each}
        </div>
      {:else}
        <button type="button" class="show" aria-keyshortcuts="Space" onclick={reveal}>
          Show answer
        </button>
      {/if}
    </div>
  {:else}
    <div class="done">
      <div class="check" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9" /></svg>
      </div>
      <h1 class="hanzi" lang="zh-Hant-TW">今天完成了</h1>
      <p class="sub">
        {store.stats.reviewed ? 'All done for today.' : 'Nothing to study right now.'}
      </p>

      {#if store.stats.reviewed}
        <dl class="stats">
          <div>
            <dt>Reviews</dt>
            <dd>{store.stats.reviewed}</dd>
          </div>
          <div>
            <dt>New words</dt>
            <dd>{store.stats.learned}</dd>
          </div>
          <div>
            <dt>Again</dt>
            <dd class="again">{store.stats.again}</dd>
          </div>
        </dl>
      {/if}

      {#if store.nextDue}
        <p class="next">
          Next review in {formatInterval(Math.max(0, store.nextDue.getTime() - Date.now()))}
        </p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .study {
    display: flex;
    flex-direction: column;
    max-width: var(--content-w);
    height: calc(100dvh - var(--tabbar-h) - var(--safe-bottom));
    margin: 0 auto;
    padding: env(safe-area-inset-top, 0px) 16px 0;
  }

  header {
    padding: 12px 4px 0;
  }

  .bar {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    height: 32px;
  }

  .title {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }

  .count {
    font-size: 15px;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }

  .progress {
    height: 3px;
    border-radius: 2px;
    background: var(--fill);
    overflow: hidden;
  }

  .progress div {
    height: 100%;
    background: var(--accent);
    transform-origin: left;
    transition: transform var(--dur) var(--ease);
  }

  /* Hanzi stays centered; the answer fills the space below without moving it */
  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    justify-items: center;
    overflow-y: auto;
    cursor: default;
  }

  .glyphs {
    grid-row: 2;
    padding: 8px 0;
  }

  .answer {
    grid-row: 3;
    align-self: start;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 420px;
    padding: 8px 8px 16px;
    text-align: center;
    animation: appear var(--dur) var(--ease) both;
  }

  @keyframes appear {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  .meaning {
    margin: 0;
    font-size: 22px;
    font-weight: 500;
    line-height: 1.3;
  }

  .note {
    display: flex;
    gap: 8px;
    align-items: baseline;
    margin: 0;
    padding: 10px 14px;
    border-radius: var(--radius);
    background: var(--grouped);
    font-size: 15px;
    line-height: 1.4;
    color: var(--text-2);
    text-align: left;
  }

  @media (prefers-color-scheme: dark) {
    .note {
      background: var(--cell);
    }
  }

  .audio {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .audio svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .controls {
    padding: 12px 0 16px;
  }

  .show {
    width: 100%;
    min-height: 52px;
    border-radius: 14px;
    background: var(--accent);
    color: #fff;
    font-size: 17px;
    font-weight: 600;
    transition: opacity var(--dur) var(--ease);
  }

  .show:active {
    opacity: 0.8;
  }

  .ratings {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    animation: appear var(--dur) var(--ease) both;
  }

  .rate {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    min-height: 52px;
    border-radius: 14px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    transition: background-color var(--dur) var(--ease);
  }

  .rate:active {
    background: color-mix(in srgb, var(--c) 22%, transparent);
  }

  .label {
    font-size: 16px;
    font-weight: 600;
  }

  .interval {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.8;
    font-variant-numeric: tabular-nums;
  }

  .done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding-bottom: 40px;
    animation: appear var(--dur) var(--ease) both;
  }

  .check {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    margin-bottom: 20px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--good) 14%, transparent);
    color: var(--good);
  }

  .check svg {
    width: 32px;
    height: 32px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .done h1 {
    margin: 0;
    font-size: 40px;
    line-height: 1.2;
  }

  .sub {
    margin: 8px 0 28px;
    color: var(--text-2);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    max-width: 360px;
    margin: 0 0 20px;
    padding: 14px 0;
    border-radius: var(--radius);
    background: var(--grouped);
  }

  @media (prefers-color-scheme: dark) {
    .stats {
      background: var(--cell);
    }
  }

  .stats div + div {
    border-left: 1px solid var(--separator);
  }

  .stats dt {
    font-size: 13px;
    color: var(--text-2);
  }

  .stats dd {
    margin: 2px 0 0;
    font-size: 28px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .stats .again {
    color: var(--again);
  }

  .next {
    margin: 0;
    font-size: 15px;
    color: var(--text-2);
  }
</style>
