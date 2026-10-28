<script lang="ts">
  // Progress at a glance (the streak plant, XP, words and retention, the last 30 days), then the
  // way into the account, the settings, the garden, the levels and the credits.
  import { LEVEL_IDS } from '@taiwan-mandarin/shared';
  import Counter from '../ui/Counter.svelte';
  import Icon, { type IconName } from '../ui/Icon.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import ReviewChart from '../ui/ReviewChart.svelte';
  import WeekStrip from '../ui/WeekStrip.svelte';
  import { stageFor } from '../lib/plant-art';
  import { router } from '../lib/router.svelte';
  import {
    cardCounts,
    dailyFromActivity,
    retentionOf,
    windowTotals,
    type DayStats,
  } from '../lib/stats';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  // Practice per day comes from the store (all devices once synced), not the raw review log.
  const days = $derived<DayStats[]>(dailyFromActivity(store.days, store.today, 30));
  const streak = $derived(store.streak);
  const last30 = $derived(windowTotals(store.days, store.today, 30));
  const kept = $derived(retentionOf(last30));
  const counts = $derived(cardCounts(store.cards));
  const minutes = $derived(Math.round(last30.ms / 60_000));

  const levelsStarted = $derived(
    LEVEL_IDS.filter((id) => Object.values(store.cards).some((r) => r.level === id)).length,
  );
  const sealsEarned = $derived(store.seals.filter((s) => s.progress >= 1).length);
  const phonetics = $derived(
    { zhuyin: '注音', pinyin: 'Pinyin', both: '注音 + Pinyin' }[store.settings.phonetics],
  );

  const accountSub = $derived.by(() => {
    if (!account.checked) return 'Checking your session…';
    if (!account.user) return 'Sign in to keep your progress in sync';
    if (account.syncing) return `${account.user.email} · syncing…`;
    if (account.error) return `${account.user.email} · sync failed`;
    if (account.lastSync)
      return `${account.user.email} · synced ${account.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return account.user.email;
  });

  interface Row {
    path: string;
    icon: IconName;
    label: string;
    zh: string;
    sub: string;
  }
  const rows = $derived<Row[]>([
    { path: '/me/account', icon: 'me', label: 'Account', zh: '帳號', sub: accountSub },
    {
      path: '/me/settings',
      icon: 'sliders',
      label: 'Settings',
      zh: '設定',
      sub: `${phonetics} · ${store.settings.newPerDay} new a day · ${Math.round(store.settings.retention * 100)}% memory`,
    },
    {
      path: '/me/garden',
      icon: 'leaf',
      label: 'Garden & seals',
      zh: '花園',
      sub: `${streak.shelf.length} past ${streak.shelf.length === 1 ? 'plant' : 'plants'} · ${sealsEarned} of ${store.seals.length} seals`,
    },
    {
      path: '/me/levels',
      icon: 'path',
      label: 'By level',
      zh: '等級',
      sub: `${counts.learned} words across ${levelsStarted} ${levelsStarted === 1 ? 'level' : 'levels'}`,
    },
    { path: '/me/about', icon: 'info', label: 'About', zh: '關於', sub: 'Sources and licences' },
  ]);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Progress & settings</p>
      <h1 class="title"><span class="zh">我</span>Me</h1>
    </div>
  </header>

  <section class="bowl sheet enter" aria-label="Your streak plant">
    <StreakPlant
      bowl={streak.current}
      crack={streak.crack}
      fresh={streak.mendedToday}
      size={150}
      label="Your streak plant: {streak.count} days, {streak.current?.seams.length ?? 0} gold seams"
    />
    <div class="bowl-body">
      <p class="eyebrow" lang="zh-Hant-TW">
        梅 · {stageFor(streak.current?.days ?? 0).name}
      </p>
      <strong class="big"><Counter value={streak.count} /> <small>day streak</small></strong>
      <span class="bowl-meta">
        Longest {streak.longest} · {streak.seams} gold {streak.seams === 1 ? 'seam' : 'seams'}
      </span>
      <WeekStrip week={streak.week} mending={streak.crack > 0} />
    </div>
  </section>

  <section class="headline">
    <div class="stat sheet enter" style:--i={1}>
      <strong class="big xp"
        ><span aria-hidden="true">✦</span> <Counter value={store.xp.total} /></strong
      >
      <span>XP</span>
      <small>+{store.xp.today} today</small>
    </div>
    <div class="stat sheet enter" style:--i={2}>
      <strong class="big"><Counter value={counts.learned} /></strong>
      <span>words learned</span>
      <small>{counts.mature} well remembered</small>
    </div>
    <div class="stat sheet enter" style:--i={3}>
      <strong class="big tabular">{kept === null ? '—' : `${Math.round(kept * 100)}%`}</strong>
      <span>remembered</span>
      <small>last 30 days</small>
    </div>
  </section>

  <h2 class="section-title">Last 30 days <span class="zh" lang="zh-Hant-TW">複習</span></h2>
  <div class="sheet chart-card">
    <ReviewChart {days} />
    <p class="footnote">{last30.reviews} reviews · about {minutes} minutes of study</p>
  </div>

  <h2 class="section-title">More <span class="zh" lang="zh-Hant-TW">更多</span></h2>
  <ul class="list">
    {#each rows as row (row.path)}
      <li>
        <a class="row" href={router.href(row.path)} onclick={router.link}>
          <span class="row-icon"><Icon name={row.icon} /></span>
          <span class="row-main">
            <span class="row-label"
              >{row.label} <span class="row-zh" lang="zh-Hant-TW">{row.zh}</span></span
            >
            <span class="row-sub">{row.sub}</span>
          </span>
          <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
        </a>
      </li>
    {/each}
  </ul>
</div>

<style>
  .bowl {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 22px 26px;
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-3);
  }

  @media (max-width: 560px) {
    .bowl {
      flex-direction: column;
      text-align: center;
      gap: 12px;
      padding: 22px 18px;
    }
  }

  .bowl-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .bowl-meta {
    margin-bottom: 10px;
    color: var(--ink-2);
    font-size: 14px;
  }

  .big {
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 800;
    line-height: 1.05;
  }

  .big small {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink-2);
  }

  .headline {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 12px;
  }

  @media (max-width: 560px) {
    .headline {
      grid-template-columns: 1fr 1fr;
    }

    .headline > :first-child {
      grid-column: 1 / -1;
    }
  }

  .stat {
    display: flex;
    flex-direction: column;
    padding: 16px 18px;
  }

  .stat span {
    font-size: 14px;
    font-weight: 600;
  }

  .xp {
    color: var(--gold-deep);
  }

  small {
    font-size: 12px;
    color: var(--ink-2);
  }

  .chart-card {
    padding: 18px 18px 12px;
  }

  .row {
    min-height: 64px;
  }

  .row-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex: none;
    border-radius: 12px;
    background: var(--paper-sunken);
    color: var(--ink-2);
  }

  .row-label {
    display: block;
    font-weight: 700;
  }

  .row-zh {
    margin-left: 4px;
    font-family: var(--font-kai);
    font-weight: 400;
    color: var(--ink-3);
  }
</style>
