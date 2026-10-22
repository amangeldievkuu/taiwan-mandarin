<script lang="ts">
  // Home: today's practice in a ring, the streak plant with this week, where the learner is on
  // the path, and the other ways to practise.
  import { LEVELS } from '@taiwan-mandarin/shared';
  import Counter from '../ui/Counter.svelte';
  import Icon, { type IconName } from '../ui/Icon.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import Ring from '../ui/Ring.svelte';
  import Seal from '../ui/Seal.svelte';
  import StatChips from '../ui/StatChips.svelte';
  import WeekStrip from '../ui/WeekStrip.svelte';
  import { content } from '../lib/content.svelte';
  import { router } from '../lib/router.svelte';
  import { cardCounts } from '../lib/stats';
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

  const remaining = $derived(store.queue.length);
  // Reviews today on every device (once synced), not only this one.
  const doneToday = $derived(
    Math.max(store.days[store.today]?.reviews ?? 0, store.daily.reviewCount),
  );
  const ringValue = $derived(doneToday + remaining === 0 ? 0 : doneToday / (doneToday + remaining));
  const dueNow = $derived(store.queue.filter((id) => store.cards[id]).length);
  const fresh = $derived(remaining - dueNow);

  const counts = $derived(cardCounts(store.cards));
  const current = $derived(LEVELS.find((l) => l.id === store.settings.levels.at(-1)) ?? LEVELS[0]);
  const levelWords = $derived(current ? content.level(current.id) : []);
  const levelLearned = $derived(levelWords.filter((w) => store.cards[w.id]).length);

  const streak = $derived(store.streak);
  const weekday = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  /** What the plant card says: always an invitation, never a scolding. */
  const bowlText = $derived.by((): { title: string; body: string } => {
    const s = streak;
    const last = s.shelf.at(-1);
    if (!s.current && !last) {
      return {
        title: 'Plant your first seed',
        body: 'Study today and a plum tree (梅) starts to grow. A missed day doesn’t break it: come back within three days and the pot is mended with gold (金繼).',
      };
    }
    if (!s.current) {
      return {
        title: 'Plant a new seed',
        body: `Your ${last?.days}-day plant is in your garden, gold and all. Study today to grow a new one.`,
      };
    }
    if (s.mendedToday) {
      return {
        title: 'Mended with gold',
        body: `You came back and the crack turned to gold. ${s.count} days of growing.`,
      };
    }
    if (s.practicedToday) {
      return {
        title: `${s.count}-day streak`,
        body: s.seams
          ? `Watered for today, with ${s.seams} gold ${s.seams === 1 ? 'seam' : 'seams'} so far.`
          : 'Watered for today. See you tomorrow.',
      };
    }
    if (s.crack && s.mendBy) {
      return s.mendBy === store.today
        ? { title: 'Your plant needs water', body: 'Last day: study today and the crack turns to gold.' }
        : {
            title: 'Your plant needs water',
            body: `Study by ${weekday(s.mendBy)} and the missed ${s.crack === 1 ? 'day turns' : 'days turn'} to gold.`,
          };
    }
    return { title: `${s.count}-day streak`, body: 'Study today to help your plant grow.' };
  });

  interface Tile {
    href: string;
    icon: IconName;
    zh: string;
    title: string;
    text: string;
    tint: string;
  }

  const EXPLORE: Tile[] = [
    {
      href: '/read',
      icon: 'read',
      zh: '讀',
      title: 'Graded reading',
      text: "Short stories about Taiwan life. Tap any word you don't know.",
      tint: 'var(--sky)',
    },
    {
      href: '/talk',
      icon: 'talk',
      zh: '談',
      title: 'Conversation',
      text: 'Chat in Taiwan Mandarin using only words you know.',
      tint: 'var(--jade)',
    },
    {
      href: '/dict?explain=1',
      icon: 'sparkle',
      zh: '解',
      title: 'Explain a sentence',
      text: 'Paste a sign, menu or message and get a word-by-word breakdown.',
      tint: 'var(--gold)',
    },
  ];
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">{dateLabel}</p>
      <h1 class="title"><span class="zh">{greeting.zh}</span>{greeting.en}</h1>
    </div>
    <StatChips />
  </header>

  <section class="hero sheet enter">
    <Ring value={ringValue} size={148} stroke={12} label="{doneToday} done, {remaining} left today">
      <div class="ring-center">
        {#if remaining === 0 && doneToday > 0}
          <span class="ring-done"><Icon name="check" size={36} /></span>
          <small>all done</small>
        {:else}
          <strong><Counter value={remaining} from={0} /></strong>
          <small>{remaining === 1 ? 'card' : 'cards'} left</small>
        {/if}
      </div>
    </Ring>
    <div class="hero-body">
      {#if remaining > 0}
        <h2>Today's practice</h2>
        <p class="hero-sub">
          <span><b class="tabular">{dueNow}</b> to review</span>
          <span><b class="tabular">{fresh}</b> new {fresh === 1 ? 'word' : 'words'}</span>
        </p>
        <a class="btn primary start" href={router.href('/study')} onclick={router.link}>
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
      {#if store.xp.today}
        <span class="xp-today"><span aria-hidden="true">✦</span> +{store.xp.today} XP today</span>
      {/if}
    </div>
  </section>

  <a
    class="bowl-card sheet pressable enter"
    style:--i={1}
    href={router.href('/me')}
    onclick={router.link}
  >
    <StreakPlant
      bowl={streak.current}
      crack={streak.crack}
      fresh={streak.mendedToday}
      size={104}
      label="Your streak plant: {streak.count} days"
    />
    <div class="bowl-body">
      <strong>{bowlText.title}</strong>
      <span class="bowl-text">{bowlText.body}</span>
      <WeekStrip week={streak.week} mending={streak.crack > 0} />
    </div>
  </a>

  <h2 class="section-title">Your path <span class="zh" lang="zh-Hant-TW">學習路徑</span></h2>
  {#if current}
    <a
      class="level sheet pressable enter"
      style:--i={2}
      href={router.href(`/path/${current.id}`)}
      onclick={router.link}
    >
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
          <span
            style:transform="translateX({(levelWords.length
              ? levelLearned / levelWords.length
              : 0) *
              100 -
              100}%)"
          ></span>
        </div>
        <small class="tabular">{levelLearned} of {levelWords.length} words started</small>
      </div>
      <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
    </a>
  {/if}

  <div class="facts">
    <div class="fact enter" style:--i={3}>
      <strong><Counter value={counts.learned} from={0} /></strong>
      <span>words learned</span>
    </div>
    <div class="fact enter" style:--i={4}>
      <strong><Counter value={counts.mature} from={0} /></strong>
      <span>well remembered</span>
    </div>
    <div class="fact enter" style:--i={5}>
      <strong><Counter value={store.deck.length} from={0} /></strong>
      <span>in your deck</span>
    </div>
  </div>

  <h2 class="section-title">Explore <span class="zh" lang="zh-Hant-TW">探索</span></h2>
  <div class="explore">
    {#each EXPLORE as tile, i (tile.href)}
      <a
        class="tile sheet pressable enter"
        style:--i={6 + i}
        style:--tint={tile.tint}
        href={router.href(tile.href)}
        onclick={router.link}
      >
        <span class="tile-icon"><Icon name={tile.icon} size={22} /></span>
        <span class="tile-zh hanzi" lang="zh-Hant-TW">{tile.zh}</span>
        <strong>{tile.title}</strong>
        <span class="tile-text">{tile.text}</span>
      </a>
    {/each}
  </div>
</div>

<style>
  .page-head {
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .hero {
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 26px;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-3);
  }

  @media (max-width: 520px) {
    .hero {
      flex-direction: column;
      text-align: center;
      gap: 18px;
      padding: 24px 20px;
    }

    .hero-sub {
      justify-content: center;
    }

    .start {
      width: 100%;
    }
  }

  .ring-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }

  .ring-center strong {
    font-family: var(--font-display);
    font-size: 42px;
    font-weight: 800;
  }

  .ring-done {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--gold-wash);
    color: var(--gold-deep);
    animation: pop var(--dur-4) var(--ease-spring);
  }

  .ring-center small {
    margin-top: 2px;
    font-size: 12px;
    font-weight: 700;
    color: var(--ink-2);
  }

  .hero-body {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  @media (max-width: 520px) {
    .hero-body {
      align-items: stretch;
    }
  }

  .hero-body h2 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
  }

  .done-zh {
    font-size: 30px !important;
    font-weight: 400 !important;
    color: var(--jade-text);
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

  .xp-today {
    align-self: flex-start;
    margin-top: 14px;
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: var(--gold-wash);
    color: var(--gold-deep);
    font-size: 13px;
    font-weight: 800;
  }

  @media (max-width: 520px) {
    .xp-today {
      align-self: center;
    }
  }

  .bowl-card {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: 14px;
    padding: 16px 20px;
    text-decoration: none;
  }

  .bowl-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .bowl-body strong {
    font-size: 18px;
    font-weight: 800;
  }

  .bowl-text {
    margin-bottom: 10px;
    font-size: 14px;
    color: var(--ink-2);
  }

  @media (max-width: 420px) {
    .bowl-card {
      flex-direction: column;
      align-items: stretch;
      text-align: center;
    }

    .bowl-card :global(.bowl) {
      align-self: center;
    }
  }

  .level {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 20px;
    text-decoration: none;
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

  .level-name strong {
    font-size: 17px;
    font-weight: 800;
  }

  .level-zh {
    font-family: var(--font-kai);
    color: var(--ink-3);
  }

  .bar {
    height: 10px;
    margin: 10px 0 6px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--jade);
    transition: transform 900ms var(--ease-spring-soft);
  }

  .level-body small {
    color: var(--ink-2);
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-top: 14px;
  }

  .fact {
    display: flex;
    flex-direction: column;
    padding: 14px 16px;
    border-radius: var(--radius);
    background: var(--paper-raised);
    border: 1px solid var(--rule);
    box-shadow: var(--shadow-1);
  }

  .fact strong {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 800;
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
    min-height: 160px;
    text-decoration: none;
    overflow: hidden;
  }

  .tile-icon {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-bottom: 8px;
    border-radius: 14px;
    background: color-mix(in oklab, var(--tint) 16%, var(--paper-raised));
    color: color-mix(in oklab, var(--tint) 80%, var(--ink));
  }

  .tile-zh {
    position: absolute;
    right: -6px;
    bottom: -22px;
    font-size: 104px;
    line-height: 1;
    color: var(--tint);
    opacity: 0.1;
    pointer-events: none;
  }

  .tile strong {
    font-size: 17px;
    font-weight: 800;
  }

  .tile-text {
    font-size: 14px;
    color: var(--ink-2);
    max-width: 24ch;
  }

  @keyframes pop {
    from {
      transform: scale(0.5);
    }
  }
</style>
