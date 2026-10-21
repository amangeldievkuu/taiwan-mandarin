<script lang="ts">
  import { LEVEL_IDS, LEVELS, type Level } from '@taiwan-mandarin/shared';
  import Segmented from '../components/Segmented.svelte';
  import ReviewChart from '../ui/ReviewChart.svelte';
  import Seal from '../ui/Seal.svelte';
  import { content } from '../lib/content.svelte';
  import { cardCounts, dailyReviews, retention, streaks, type DayStats } from '../lib/stats';
  import { store } from '../lib/store.svelte';
  import type { ReviewRecord } from '../lib/storage';

  let reviews = $state<ReviewRecord[]>([]);
  $effect(() => {
    void store.reviewRevision;
    void store.reviews().then((r) => (reviews = r));
  });

  const now = new Date();
  const days = $derived<DayStats[]>(dailyReviews(reviews, now, 30));
  const streak = $derived(streaks(reviews, now));
  const recent = $derived(reviews.filter((r) => r.review >= now.getTime() - 30 * 86_400_000));
  const kept = $derived(retention(recent));
  const counts = $derived(cardCounts(store.cards));
  const minutes = $derived(Math.round(recent.reduce((sum, r) => sum + r.durationMs, 0) / 60_000));

  const perLevel = $derived.by(() => {
    const result = Object.fromEntries(LEVEL_IDS.map((l) => [l, 0])) as Record<Level, number>;
    for (const r of Object.values(store.cards)) if (r.level) result[r.level]++;
    return result;
  });

  let confirmReset = $state(false);
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Progress & settings</p>
      <h1 class="title"><span class="zh">我</span>Me</h1>
    </div>
  </header>

  <section class="headline">
    <div class="streak sheet">
      <Seal text="勤" size={52} outline={streak.current === 0} />
      <div>
        <strong class="big tabular">{streak.current}</strong>
        <span>day streak</span>
        <small>Longest {streak.longest}</small>
      </div>
    </div>
    <div class="stat sheet">
      <strong class="big tabular">{counts.learned}</strong>
      <span>words learned</span>
      <small>{counts.mature} well remembered</small>
    </div>
    <div class="stat sheet">
      <strong class="big tabular">{kept === null ? '—' : `${Math.round(kept * 100)}%`}</strong>
      <span>remembered</span>
      <small>last 30 days</small>
    </div>
  </section>

  <h2 class="section-title">Last 30 days <span class="zh" lang="zh-Hant-TW">複習</span></h2>
  <div class="sheet chart-card">
    <ReviewChart {days} />
    <p class="footnote">{recent.length} reviews · about {minutes} minutes of study</p>
  </div>

  <h2 class="section-title">By level <span class="zh" lang="zh-Hant-TW">等級</span></h2>
  <ul class="list">
    {#each LEVELS as level (level.id)}
      {@const total = content.manifest?.levels.find((l) => l.id === level.id)?.count ?? 0}
      <li class="row level-row">
        <span class="lv">{level.en}</span>
        <span class="lv-bar"
          ><span style:width="{total ? (100 * perLevel[level.id]) / total : 0}%"></span></span
        >
        <span class="row-value">{perLevel[level.id]} / {total.toLocaleString()}</span>
      </li>
    {/each}
  </ul>

  <h2 class="section-title">Settings <span class="zh" lang="zh-Hant-TW">設定</span></h2>
  <div class="settings sheet">
    <div class="setting">
      <span>Phonetics</span>
      <Segmented
        label="Phonetics"
        value={store.settings.phonetics}
        onchange={(phonetics) => store.updateSettings({ phonetics })}
        options={[
          { value: 'zhuyin', label: '注音', lang: 'zh-Hant-TW' },
          { value: 'pinyin', label: 'Pinyin' },
          { value: 'both', label: 'Both' },
        ]}
      />
    </div>
    <div class="setting">
      <span>Characters</span>
      <Segmented
        label="Character style"
        value={store.settings.glyphStyle}
        onchange={(glyphStyle) => store.updateSettings({ glyphStyle })}
        options={[
          { value: 'kai', label: '楷書', lang: 'zh-Hant-TW', font: 'var(--font-kai)' },
          { value: 'sans', label: '黑體', lang: 'zh-Hant-TW', font: 'var(--font-ui)' },
        ]}
      />
    </div>
    <div class="setting">
      <span>Theme</span>
      <Segmented
        label="Theme"
        value={store.settings.theme}
        onchange={(theme) => store.updateSettings({ theme })}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'light', label: 'Paper' },
          { value: 'dark', label: 'Ink' },
        ]}
      />
    </div>
    <label class="setting">
      <span>New words per day <b class="tabular">{store.settings.newPerDay}</b></span>
      <input
        type="range"
        min="0"
        max="50"
        step="1"
        value={store.settings.newPerDay}
        onchange={(e) => store.updateSettings({ newPerDay: Number(e.currentTarget.value) })}
      />
    </label>
    <label class="setting">
      <span>Target memory <b class="tabular">{Math.round(store.settings.retention * 100)}%</b></span
      >
      <input
        type="range"
        min="0.8"
        max="0.97"
        step="0.01"
        value={store.settings.retention}
        onchange={(e) => store.updateSettings({ retention: Number(e.currentTarget.value) })}
      />
      <small>Higher means more reviews and better recall.</small>
    </label>
  </div>

  <h2 class="section-title">Data</h2>
  <div class="sheet data">
    <p>Today: {store.daily.newCount} new · {store.daily.reviewCount} reviews</p>
    {#if confirmReset}
      <p class="warn">This deletes all progress and review history on this device.</p>
      <div class="buttons">
        <button type="button" class="btn quiet small" onclick={() => (confirmReset = false)}
          >Cancel</button
        >
        <button
          type="button"
          class="btn seal small"
          onclick={async () => {
            await store.resetProgress();
            confirmReset = false;
          }}>Delete everything</button
        >
      </div>
    {:else}
      <button type="button" class="btn quiet small" onclick={() => (confirmReset = true)}
        >Reset progress…</button
      >
    {/if}
  </div>

  <h2 class="section-title">About</h2>
  <div class="about">
    <p>
      Word lists: <a href="https://tocfl.edu.tw" target="_blank" rel="noopener"
        >TOCFL 華語八千詞表</a
      >
      (SC-TOP) and
      <a href="https://coct.naer.edu.tw" target="_blank" rel="noopener">NAER 臺灣華語文能力基準</a>.
      Dictionary: <a href="https://cc-cedict.org" target="_blank" rel="noopener">CC-CEDICT</a> (CC
      BY-SA 4.0), with Taiwan readings applied. Examples:
      <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a> (CC BY 2.0 FR) and sentences
      written for this app. Stroke order: Make Me a Hanzi (Arphic Public License). Font: LXGW WenKai TC
      (OFL).
    </p>
  </div>
</div>

<style>
  .headline {
    display: grid;
    grid-template-columns: 1.3fr 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 560px) {
    .headline {
      grid-template-columns: 1fr 1fr;
    }

    .streak {
      grid-column: 1 / -1;
    }
  }

  .streak,
  .stat {
    display: flex;
    flex-direction: column;
    padding: 18px;
  }

  .streak {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }

  .streak div {
    display: flex;
    flex-direction: column;
  }

  .big {
    font-family: var(--font-serif);
    font-size: 34px;
    font-weight: 600;
    line-height: 1.05;
  }

  .stat span,
  .streak span {
    font-size: 14px;
  }

  small {
    font-size: 12px;
    color: var(--ink-2);
  }

  .chart-card {
    padding: 18px 18px 12px;
  }

  .level-row {
    gap: 14px;
  }

  .lv {
    width: 64px;
    flex: none;
    font-size: 15px;
  }

  .lv-bar {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--fill);
    overflow: hidden;
  }

  .lv-bar span {
    display: block;
    height: 100%;
    background: var(--jade);
    min-width: 0;
  }

  .row-value {
    min-width: 92px;
    text-align: right;
    font-size: 14px;
  }

  .settings {
    display: flex;
    flex-direction: column;
    padding: 6px 18px;
  }

  .setting {
    display: grid;
    grid-template-columns: minmax(140px, 1fr) minmax(0, 1.4fr);
    align-items: center;
    gap: 12px;
    padding: 12px 0;
  }

  .setting + .setting {
    border-top: 1px solid var(--rule);
  }

  .setting small {
    grid-column: 2;
    margin-top: -6px;
  }

  @media (max-width: 520px) {
    .setting {
      grid-template-columns: 1fr;
      gap: 8px;
    }

    .setting small {
      grid-column: 1;
    }
  }

  input[type='range'] {
    width: 100%;
    accent-color: var(--seal);
  }

  .data {
    padding: 14px 18px;
  }

  .data p {
    margin: 0 0 10px;
    color: var(--ink-2);
  }

  .warn {
    color: var(--seal) !important;
  }

  .buttons {
    display: flex;
    gap: 8px;
  }

  .about {
    font-size: 13px;
    color: var(--ink-2);
  }
</style>
