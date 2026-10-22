<script lang="ts">
  // Progress and settings: the streak plant and the garden of past plants, XP, words and
  // retention, the last 30 days, levels, account and sync, and the app's settings.
  import { LEVEL_IDS, LEVELS, type Level } from '@taiwan-mandarin/shared';
  import Segmented from '../components/Segmented.svelte';
  import AccountPanel from '../ui/AccountPanel.svelte';
  import Counter from '../ui/Counter.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import ReviewChart from '../ui/ReviewChart.svelte';
  import SealAlbum from '../ui/SealAlbum.svelte';
  import Switch from '../ui/Switch.svelte';
  import WeekStrip from '../ui/WeekStrip.svelte';
  import { content } from '../lib/content.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { stageFor } from '../lib/plant-art';
  import {
    cardCounts,
    dailyFromActivity,
    retentionOf,
    windowTotals,
    type DayStats,
  } from '../lib/stats';
  import { store } from '../lib/store.svelte';
  import { api } from '../lib/api';
  import { account } from '../lib/sync.svelte';

  // Practice per day comes from the store (all devices once synced), not the raw review log.
  const days = $derived<DayStats[]>(dailyFromActivity(store.days, store.today, 30));
  const streak = $derived(store.streak);
  const last30 = $derived(windowTotals(store.days, store.today, 30));
  const kept = $derived(retentionOf(last30));
  const counts = $derived(cardCounts(store.cards));
  const minutes = $derived(Math.round(last30.ms / 60_000));
  /** Past plants (the shelf of finished streaks), newest first. */
  const shelf = $derived([...streak.shelf].reverse());

  const perLevel = $derived.by(() => {
    const result = Object.fromEntries(LEVEL_IDS.map((l) => [l, 0])) as Record<Level, number>;
    for (const r of Object.values(store.cards)) if (r.level) result[r.level]++;
    return result;
  });

  const short = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  let confirmReset = $state(false);
  let resetting = $state(false);
  let resetError = $state<string | null>(null);

  /** Signed in, the account's copy goes first, or the next sync would bring everything back. */
  async function reset() {
    resetting = true;
    resetError = null;
    try {
      if (account.user) await api('/v1/me/progress', { method: 'DELETE' });
      await store.resetProgress();
      confirmReset = false;
    } catch (e) {
      resetError = e instanceof Error ? e.message : String(e);
    } finally {
      resetting = false;
    }
  }
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

  <h2 class="section-title">Your garden <span class="zh" lang="zh-Hant-TW">花園</span></h2>
  <div class="shelf-card sheet">
    {#if shelf.length}
      <ol class="shelf" aria-label="Past plants, newest first">
        {#each shelf as bowl, i (bowl.start)}
          <li class="fired enter" style:--i={i}>
            <StreakPlant {bowl} size={84} label="{bowl.days} days" />
            <strong>{bowl.days} {bowl.days === 1 ? 'day' : 'days'}</strong>
            <small>{short(bowl.start)} – {short(bowl.end)}</small>
            {#if bowl.seams.length}<small class="gold"
                >{bowl.seams.length} gold {bowl.seams.length === 1 ? 'seam' : 'seams'}</small
              >{/if}
          </li>
        {/each}
      </ol>
    {/if}
    <p class="how">
      <strong>How your plant grows.</strong> Every day you study waters a plum tree (梅, Taiwan's national
      flower). Miss a day or two and nothing breaks: come back within three days and the crack in its
      pot is mended with gold (金繼, kintsugi), the most beautiful part of the pot. After a longer break
      the plant moves here to your garden, gold and all, and a new seed is planted. It becomes a small
      tree at 7 days, buds at 30 and blooms at 100.
    </p>
  </div>

  <h2 class="section-title">Seals <span class="zh" lang="zh-Hant-TW">印譜</span></h2>
  <div class="sheet seals-card">
    <SealAlbum seals={store.seals} />
  </div>

  <h2 class="section-title">Last 30 days <span class="zh" lang="zh-Hant-TW">複習</span></h2>
  <div class="sheet chart-card">
    <ReviewChart {days} />
    <p class="footnote">{last30.reviews} reviews · about {minutes} minutes of study</p>
  </div>

  <h2 class="section-title">By level <span class="zh" lang="zh-Hant-TW">等級</span></h2>
  <ul class="list">
    {#each LEVELS as level (level.id)}
      {@const total = content.manifest?.levels.find((l) => l.id === level.id)?.count ?? 0}
      <li class="row level-row">
        <span class="lv">{level.en}</span>
        <span class="lv-bar"
          ><span
            style:transform="translateX({(total ? perLevel[level.id] / total : 0) * 100 - 100}%)"
          ></span></span
        >
        <span class="row-value">{perLevel[level.id]} / {total.toLocaleString()}</span>
      </li>
    {/each}
  </ul>

  <h2 class="section-title">Account & sync <span class="zh" lang="zh-Hant-TW">帳號</span></h2>
  <AccountPanel />

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
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    </div>
    <div class="setting toggle">
      <span>Sound effects <small>Chimes when you answer and finish (this device)</small></span>
      <Switch
        checked={feedback.sound}
        label="Sound effects"
        onchange={(on) => feedback.setSound(on)}
      />
    </div>
    {#if feedback.canVibrate}
      <div class="setting toggle">
        <span>Vibration <small>A little buzz on each answer (this device)</small></span>
        <Switch
          checked={feedback.haptics}
          label="Vibration"
          onchange={(on) => feedback.setHaptics(on)}
        />
      </div>
    {/if}
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
    <p>
      Today: {store.days[store.today]?.learned ?? store.daily.newCount} new · {store.days[
        store.today
      ]?.reviews ?? store.daily.reviewCount} reviews
    </p>
    {#if confirmReset}
      <p class="warn">
        {account.user
          ? 'This deletes all progress and review history here and in your account. Other devices keep their copy until you reset them too.'
          : 'This deletes all progress and review history on this device.'}
      </p>
      {#if resetError}<p class="warn" role="alert">{resetError}</p>{/if}
      <div class="buttons">
        <button type="button" class="btn quiet small" onclick={() => (confirmReset = false)}
          >Cancel</button
        >
        <button type="button" class="btn seal small" disabled={resetting} onclick={reset}
          >Delete everything</button
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
      written for this app. Stroke order: Make Me a Hanzi (Arphic Public License). Fonts: LXGW WenKai
      TC and Nunito (OFL).
    </p>
  </div>
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

  .shelf-card {
    padding: 16px 18px;
  }

  .shelf {
    display: flex;
    gap: 14px;
    margin: 0 0 14px;
    padding: 4px 2px 10px;
    list-style: none;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
  }

  .fired {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 108px;
    padding: 10px 6px;
    border-radius: var(--radius);
    background: var(--paper);
    scroll-snap-align: start;
    text-align: center;
  }

  .fired strong {
    margin-top: 4px;
    font-size: 15px;
  }

  .fired .gold {
    color: var(--gold-deep);
    font-weight: 700;
  }

  .how {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-2);
  }

  .how strong {
    color: var(--ink);
  }

  .seals-card {
    padding: 16px 18px 20px;
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
    font-weight: 600;
  }

  .lv-bar {
    flex: 1;
    height: 8px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .lv-bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--jade);
    transition: transform 900ms var(--ease-spring-soft);
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

  .setting.toggle {
    grid-template-columns: 1fr auto;
  }

  .setting.toggle small {
    display: block;
    margin-top: 2px;
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
    accent-color: var(--jade);
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
