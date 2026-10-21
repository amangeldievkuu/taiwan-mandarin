<script lang="ts">
  import { LEVELS } from '@taiwan-mandarin/shared';
  import Icon from '../ui/Icon.svelte';
  import Ring from '../ui/Ring.svelte';
  import Seal from '../ui/Seal.svelte';
  import { content } from '../lib/content.svelte';
  import { router } from '../lib/router.svelte';
  import { cardCounts, streaks } from '../lib/stats';
  import { store } from '../lib/store.svelte';

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 11
      ? { zh: '早安', en: 'Good morning' }
      : hour < 18
        ? { zh: '午安', en: 'Good afternoon' }
        : { zh: '晚安', en: 'Good evening' };
  const dateLabel = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  let streak = $state({ current: 0, longest: 0 });
  $effect(() => {
    void store.reviewRevision;
    void store.reviews().then((r) => (streak = streaks(r, new Date())));
  });

  const remaining = $derived(store.queue.length);
  const doneToday = $derived(store.daily.reviewCount);
  const ringValue = $derived(doneToday + remaining === 0 ? 0 : doneToday / (doneToday + remaining));
  const dueNow = $derived(store.queue.filter((id) => store.cards[id]).length);
  const fresh = $derived(remaining - dueNow);

  const counts = $derived(cardCounts(store.cards));
  const current = $derived(LEVELS.find((l) => l.id === store.settings.levels.at(-1)) ?? LEVELS[0]);
  const levelWords = $derived(current ? content.level(current.id) : []);
  const levelLearned = $derived(levelWords.filter((w) => store.cards[w.id]).length);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">{dateLabel}</p>
      <h1 class="title"><span class="zh">{greeting.zh}</span>{greeting.en}</h1>
    </div>
    <div class="streak" title="Longest streak: {streak.longest} days">
      <Seal text={streak.current > 0 ? '勤' : '始'} size={44} outline={streak.current === 0} />
      <span class="streak-text">
        <strong class="tabular">{streak.current}</strong>
        <small>day streak</small>
      </span>
    </div>
  </header>

  <section class="hero sheet">
    <Ring value={ringValue} size={148} stroke={9} label="{doneToday} done, {remaining} left today">
      <div class="ring-center">
        <strong class="tabular">{remaining}</strong>
        <small>{remaining === 1 ? 'card' : 'cards'} left</small>
      </div>
    </Ring>
    <div class="hero-body">
      {#if remaining > 0}
        <h2>Today's practice</h2>
        <p class="hero-sub">
          <span><b class="tabular">{dueNow}</b> to review</span>
          <span><b class="tabular">{fresh}</b> new {fresh === 1 ? 'word' : 'words'}</span>
        </p>
        <a class="btn primary" href={router.href('/study')} onclick={router.link}>
          {doneToday > 0 ? 'Continue' : 'Start studying'}
          <Icon name="forward" size={18} />
        </a>
      {:else}
        <h2 class="hanzi done-zh" lang="zh-Hant-TW">今天完成了</h2>
        <p class="hero-sub">
          All done for today. {doneToday ? `${doneToday} reviews.` : ''} Read something or look around
          the dictionary.
        </p>
        <a class="btn quiet" href={router.href('/read')} onclick={router.link}>Read a story</a>
      {/if}
    </div>
  </section>

  <h2 class="section-title">Your path <span class="zh" lang="zh-Hant-TW">學習路徑</span></h2>
  {#if current}
    <a class="level sheet" href={router.href(`/path/${current.id}`)} onclick={router.link}>
      <Seal text={current.zh.slice(0, 2)} size={54} />
      <div class="level-body">
        <div class="level-name">
          <strong>{current.en}</strong>
          <span class="level-tag">{current.cefr}</span>
          <span class="level-zh" lang="zh-Hant-TW">{current.zh}</span>
        </div>
        <div
          class="bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax={levelWords.length}
          aria-valuenow={levelLearned}
        >
          <span style:width="{levelWords.length ? (100 * levelLearned) / levelWords.length : 0}%"
          ></span>
        </div>
        <small class="tabular">{levelLearned} of {levelWords.length} words started</small>
      </div>
      <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
    </a>
  {/if}

  <div class="facts">
    <div class="fact">
      <strong class="tabular">{counts.learned}</strong>
      <span>words learned</span>
    </div>
    <div class="fact">
      <strong class="tabular">{counts.mature}</strong>
      <span>well remembered</span>
    </div>
    <div class="fact">
      <strong class="tabular">{store.deck.length}</strong>
      <span>in your deck</span>
    </div>
  </div>

  <h2 class="section-title">Explore <span class="zh" lang="zh-Hant-TW">探索</span></h2>
  <div class="explore">
    <a class="tile sheet" href={router.href('/read')} onclick={router.link}>
      <span class="tile-zh hanzi" lang="zh-Hant-TW">讀</span>
      <strong>Graded reading</strong>
      <span>Short stories about Taiwan life. Tap any word you don't know.</span>
    </a>
    <a class="tile sheet" href={router.href('/talk')} onclick={router.link}>
      <span class="tile-zh hanzi" lang="zh-Hant-TW">談</span>
      <strong>Conversation</strong>
      <span>Chat in Taiwan Mandarin using only words you know.</span>
    </a>
    <a class="tile sheet" href={router.href('/dict?explain=1')} onclick={router.link}>
      <span class="tile-zh hanzi" lang="zh-Hant-TW">解</span>
      <strong>Explain a sentence</strong>
      <span>Paste a sign, menu or message and get a word-by-word breakdown.</span>
    </a>
  </div>
</div>

<style>
  .streak {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .streak-text {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .streak-text strong {
    font-size: 22px;
  }

  .streak-text small {
    font-size: 12px;
    color: var(--ink-2);
  }

  .hero {
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 26px;
  }

  @media (max-width: 520px) {
    .hero {
      flex-direction: column;
      text-align: center;
      gap: 18px;
    }

    .hero-sub {
      justify-content: center;
    }
  }

  .ring-center {
    display: flex;
    flex-direction: column;
    line-height: 1.1;
  }

  .ring-center strong {
    font-family: var(--font-serif);
    font-size: 40px;
    font-weight: 600;
  }

  .ring-center small {
    font-size: 12px;
    color: var(--ink-2);
  }

  .hero-body h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 24px;
  }

  .done-zh {
    font-size: 30px !important;
    color: var(--seal);
  }

  .hero-sub {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 6px 0 18px;
    color: var(--ink-2);
  }

  .hero-sub b {
    color: var(--ink);
  }

  .level {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    text-decoration: none;
    transition: transform var(--dur) var(--ease);
  }

  .level:active {
    transform: scale(0.99);
  }

  .level-body {
    flex: 1;
    min-width: 0;
  }

  .level-name {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .level-zh {
    font-family: var(--font-kai);
    color: var(--ink-3);
  }

  .bar {
    height: 6px;
    margin: 10px 0 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--jade);
    transition: width 700ms var(--ease);
  }

  .level-body small {
    color: var(--ink-2);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-top: 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .fact {
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
  }

  .fact + .fact {
    border-left: 1px solid var(--rule);
  }

  .fact strong {
    font-family: var(--font-serif);
    font-size: 26px;
    font-weight: 600;
    line-height: 1.1;
  }

  .fact span {
    font-size: 13px;
    color: var(--ink-2);
  }

  .explore {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 12px;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 18px;
    min-height: 150px;
    text-decoration: none;
    overflow: hidden;
    transition:
      transform var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .tile:hover {
      transform: translateY(-2px);
      border-color: var(--rule-strong);
    }
  }

  .tile-zh {
    position: absolute;
    right: -6px;
    bottom: -22px;
    font-size: 104px;
    line-height: 1;
    color: var(--seal);
    opacity: 0.09;
    pointer-events: none;
  }

  .tile strong {
    font-size: 17px;
  }

  .tile span:not(.tile-zh) {
    font-size: 14px;
    color: var(--ink-2);
    max-width: 22ch;
  }
</style>
