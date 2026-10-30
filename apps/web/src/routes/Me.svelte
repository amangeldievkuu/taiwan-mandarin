<script lang="ts">
  // Progress at a glance (the streak plant, ink, words and retention, the last 30 days), then the
  // way into the account, the settings, the garden, the levels and the credits.
  import InkDrop from '../ui/InkDrop.svelte';
  import { LEVEL_IDS, nextUnlock } from '@taiwan-mandarin/shared';
  import Counter from '../ui/Counter.svelte';
  import Icon, { type IconName } from '../ui/Icon.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import ReviewChart from '../ui/ReviewChart.svelte';
  import WeekStrip from '../ui/WeekStrip.svelte';
  import { intlLocale, t } from '../lib/i18n/index.svelte';
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
  const next = $derived(nextUnlock(store.xp.total));
  const sealsEarned = $derived(store.seals.filter((s) => s.progress >= 1).length);
  const phonetics = $derived(
    { zhuyin: '注音', pinyin: 'Pinyin', both: '注音 + Pinyin' }[store.settings.phonetics],
  );

  const accountSub = $derived.by(() => {
    const say = t().me;
    if (!account.user) return say.signInSub;
    const email = account.user.email;
    if (account.verifying) return say.checking(email);
    if (account.syncing) return say.syncing(email);
    if (account.error) return say.syncFailed(email);
    if (account.lastSync) {
      const time = account.lastSync.toLocaleTimeString(intlLocale(), {
        hour: '2-digit',
        minute: '2-digit',
      });
      return say.synced(email, time);
    }
    return email;
  });

  interface Row {
    path: string;
    icon: IconName;
    label: string;
    zh: string;
    sub: string;
  }
  const rows = $derived.by((): Row[] => {
    const say = t().me;
    const titles = t().titles;
    return [
      { path: '/me/account', icon: 'me', label: titles['me-account'], zh: '帳號', sub: accountSub },
      {
        path: '/me/settings',
        icon: 'sliders',
        label: titles['me-settings'],
        zh: '設定',
        sub: say.settingsSub(
          phonetics,
          store.settings.newPerDay,
          Math.round(store.settings.retention * 100),
        ),
      },
      {
        path: '/me/garden',
        icon: 'leaf',
        label: say.garden,
        zh: '花園',
        sub: say.gardenSub(streak.shelf.length, sealsEarned, store.seals.length),
      },
      {
        path: '/me/levels',
        icon: 'path',
        label: titles['me-levels'],
        zh: '等級',
        sub: say.levelsSub(counts.learned, levelsStarted),
      },
      { path: '/me/about', icon: 'info', label: titles['me-about'], zh: '關於', sub: say.aboutSub },
    ];
  });
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">{t().me.eyebrow}</p>
      <h1 class="title"><span class="zh">我</span>{t().titles.me}</h1>
    </div>
  </header>

  <section class="bowl sheet enter" aria-label={t().celebrate.plant}>
    <StreakPlant
      bowl={streak.current}
      crack={streak.crack}
      fresh={streak.mendedToday}
      size={150}
      label={t().me.plant(streak.count, streak.current?.seams.length ?? 0)}
    />
    <div class="bowl-body">
      <p class="eyebrow" lang="zh-Hant-TW">
        梅 · {stageFor(streak.current?.days ?? 0).name}
      </p>
      <strong class="big"><Counter value={streak.count} /> <small>{t().me.dayStreak}</small></strong
      >
      <span class="bowl-meta">{t().me.longest(streak.longest, streak.seams)}</span>
      <WeekStrip week={streak.week} mending={streak.crack > 0} />
    </div>
  </section>

  <section class="headline">
    <a
      class="stat sheet enter ink-card pressable"
      style:--i={1}
      href={router.href('/me/ink')}
      onclick={router.link}
    >
      <strong class="big xp"><InkDrop size={26} /> <Counter value={store.xp.total} /></strong>
      <span>{t().me.ink}</span>
      <small>{t().me.xpToday(store.xp.today)}</small>
      {#if next}<small class="ink-next"
          >{t().me.inkNext(t().inkstone.names[next.id] ?? next.en, next.at - store.xp.total)}</small
        >{/if}
      <!-- Phones never see the hover lift: the chevron and the pill say this card opens a page. -->
      <span class="ink-open" aria-hidden="true"
        ><span lang="zh-Hant-TW">硯</span> {t().titles['me-ink']}</span
      >
      <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
    </a>
    <div class="stat sheet enter" style:--i={2}>
      <strong class="big"><Counter value={counts.learned} /></strong>
      <span>{t().today.learned}</span>
      <small>{t().me.wellRemembered(counts.mature)}</small>
    </div>
    <div class="stat sheet enter" style:--i={3}>
      <strong class="big tabular">{kept === null ? '—' : `${Math.round(kept * 100)}%`}</strong>
      <span>{t().me.remembered}</span>
      <small>{t().me.last30}</small>
    </div>
  </section>

  <h2 class="section-title">
    {t().me.last30Title} <span class="zh" lang="zh-Hant-TW">複習</span>
  </h2>
  <div class="sheet chart-card">
    <ReviewChart {days} />
    <p class="footnote">{t().me.studied(last30.reviews, minutes)}</p>
  </div>

  <h2 class="section-title">{t().me.more} <span class="zh" lang="zh-Hant-TW">更多</span></h2>
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

  /* Unlike the tiles beside it, this card opens the Inkstone: tinted gold, with a way in. */
  .ink-card {
    position: relative;
    color: inherit;
    text-decoration: none;
    border-color: color-mix(in srgb, var(--gold-deep) 35%, var(--rule));
    background: color-mix(in srgb, var(--gold-wash) 60%, var(--paper-raised));
  }

  .ink-card:active {
    background: var(--gold-wash);
  }

  .ink-card .chevron {
    position: absolute;
    top: 18px;
    right: 16px;
    stroke: var(--gold-deep);
  }

  /* Scoped through .ink-card, so `.stat span` doesn't set its size. */
  .ink-card .ink-open {
    align-self: flex-start;
    margin-top: 10px;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--gold-wash);
    color: var(--gold-deep);
    font-size: 13px;
    font-weight: 700;
  }

  .ink-card .ink-open span {
    font: inherit;
  }

  .ink-next {
    margin-top: 2px;
    font-weight: 700;
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
