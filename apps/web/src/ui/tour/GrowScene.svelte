<script lang="ts">
  // Tour scene 4, the plant: a day of practice waters it. The seed comes up, today's mark in the
  // week fills in and the streak starts.
  import { XP, type Bowl, type WeekDay } from '@taiwan-mandarin/shared';
  import { t } from '../../lib/i18n/index.svelte';
  import { reached, type Frame } from '../../lib/tour';
  import InkDrop from '../InkDrop.svelte';
  import StreakPlant from '../StreakPlant.svelte';
  import WeekStrip from '../WeekStrip.svelte';

  let { frame }: { frame: Frame } = $props();
  const on = (beat: string) => reached(frame, beat);

  const today = new Date();
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  /** Monday to Sunday of this week. */
  const monday = today.getDate() - ((today.getDay() + 6) % 7);
  const dates = Array.from({ length: 7 }, (_, i) =>
    iso(new Date(today.getFullYear(), today.getMonth(), monday + i)),
  );
  const todayIso = iso(today);
  const sprout: Bowl = { start: todayIso, end: todayIso, days: 2, seams: [] };

  const week = $derived(
    dates.map((date): WeekDay => ({
      date,
      today: date === todayIso,
      mark:
        date === todayIso ? (on('day') ? 'done' : 'today') : date < todayIso ? 'empty' : 'future',
    })),
  );
  const days = $derived(on('streak') ? 1 : 0);
  /** The ink from the card graded in the Study scene. */
  const GAINED = XP.review + XP.newWord;
</script>

<div class="scene">
  <p class="eyebrow">{t().me.eyebrow}</p>
  <h3 class="title-ish"><span class="zh" lang="zh-Hant-TW">我</span>{t().titles.me}</h3>

  <div class="card sheet">
    <div class="pot">
      <StreakPlant bowl={on('sprout') ? sprout : null} size={150} label="" glaze="celadon" />
    </div>
    <strong class="count" class:pop={on('streak')}>
      {days} <small>{t().me.dayStreak}</small>
    </strong>
    <WeekStrip {week} />
  </div>

  <div class="ink sheet" class:shown={on('day')}>
    <InkDrop size={18} />
    <strong>{t().today.xpToday(GAINED)}</strong>
  </div>

  <p class="note" class:shown={on('streak')}>{t().tour.mock.mend}</p>
</div>

<style>
  .scene {
    position: relative;
    height: 100%;
    padding: var(--sp-4) var(--sp-4) 0;
  }

  .title-ish {
    margin: 2px 0 var(--sp-3);
    font-size: 22px;
    font-weight: var(--fw-heading);
  }

  .title-ish .zh {
    margin-right: 0.3em;
    font-family: var(--font-kai);
    font-weight: 400;
    color: var(--seal);
  }

  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 6px var(--sp-3) var(--sp-4);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
  }

  .pot {
    display: grid;
    place-items: center;
  }

  .count {
    font-size: 36px;
    font-weight: var(--fw-heading);
    line-height: 1;
    transition: transform var(--dur-4) var(--ease-spring);
  }

  .count.pop {
    animation: pop var(--dur-4) var(--ease-spring);
  }

  @keyframes pop {
    40% {
      transform: scale(1.25);
      color: var(--jade-text);
    }
  }

  .count small {
    font-size: 15px;
    font-weight: var(--fw-strong);
    color: var(--ink-2);
  }

  .ink {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--radius);
    background: var(--gold-wash);
    border-color: transparent;
    box-shadow: none;
    color: var(--gold-deep);
    font-size: var(--fs-md);
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity var(--dur-3) var(--ease-out),
      transform var(--dur-4) var(--ease-spring-soft);
  }

  .ink.shown {
    opacity: 1;
    transform: none;
  }

  .note {
    margin: var(--sp-4) var(--sp-1) 0;
    font-size: var(--fs-sm);
    line-height: 1.45;
    color: var(--ink-2);
    text-align: center;
    opacity: 0;
    transition: opacity var(--dur-4) var(--ease-out);
  }

  .note.shown {
    opacity: 1;
  }
</style>
