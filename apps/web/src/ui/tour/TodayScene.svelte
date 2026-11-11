<script lang="ts">
  // Tour scene 1, Today: the day's practice in its ring, and a tap on "Start studying".
  import { GREETING_ZH, partOfDay } from '../../lib/greeting';
  import { t } from '../../lib/i18n/index.svelte';
  import { reached, type Frame } from '../../lib/tour';
  import Icon from '../Icon.svelte';
  import Ring from '../Ring.svelte';
  import Seal from '../Seal.svelte';
  import StreakPlant from '../StreakPlant.svelte';
  import TapDot from './TapDot.svelte';

  let { frame }: { frame: Frame } = $props();
  const on = (beat: string) => reached(frame, beat);
  const part = partOfDay(new Date().getHours());
</script>

<div class="scene">
  <p class="eyebrow">{t().titles.today}</p>
  <h3 class="greet">
    <span class="zh" lang="zh-Hant-TW">{GREETING_ZH[part]}</span>{t().today[part]}
  </h3>

  <div class="hero sheet" class:lit={on('ring')}>
    <Ring value={on('ring') ? 0.08 : 0} size={104} stroke={9}>
      <div class="ring-center">
        <strong>10</strong>
        <small>{t().today.cardsLeft(10)}</small>
      </div>
    </Ring>
    <strong class="practice">{t().today.practice}</strong>
    <span class="sub">
      <b>0</b>
      {t().today.toReview} · <b>10</b>
      {t().today.newWords(10)}
    </span>
    <span class="btn primary start" class:pressed={on('tap')}>
      {t().today.start}
      <Icon name="forward" size={16} />
    </span>
  </div>

  <div class="row sheet">
    <StreakPlant bowl={null} size={52} fit />
    <span class="row-text">
      <strong>{t().today.bowl.firstTitle}</strong>
      <small>{t().tour.mock.plantHint}</small>
    </span>
  </div>

  <div class="row sheet">
    <Seal text="準備" size={34} />
    <span class="row-text">
      <strong>{t().levels.N1}</strong>
      <span class="bar"><span></span></span>
    </span>
  </div>

  <TapDot x={50} y={52} show={on('point')} tapping={on('tap') && !on('leave')} />
</div>

<style>
  .scene {
    position: relative;
    height: 100%;
    padding: var(--sp-4) var(--sp-4) 0;
  }

  .greet {
    margin: 2px 0 var(--sp-3);
    font-size: 22px;
    font-weight: var(--fw-heading);
    letter-spacing: -0.01em;
  }

  .greet .zh {
    margin-right: 0.3em;
    font-family: var(--font-kai);
    font-weight: 400;
    color: var(--seal);
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: var(--sp-4) var(--sp-4);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
  }

  .ring-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
  }

  .ring-center strong {
    font-size: 30px;
    font-weight: var(--fw-heading);
  }

  .ring-center small {
    font-size: var(--fs-2xs);
    font-weight: var(--fw-strong);
    color: var(--ink-2);
  }

  .practice {
    margin-top: var(--sp-1);
    font-size: var(--fs-lg);
    font-weight: var(--fw-heading);
  }

  .sub {
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }

  .sub b {
    color: var(--ink);
  }

  .start {
    width: 100%;
    min-height: 42px;
    margin-top: 6px;
    font-size: 15px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-top: 10px;
    padding: 10px var(--sp-4);
    border-radius: var(--radius);
    box-shadow: var(--shadow-1);
  }

  .row-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    gap: 2px;
  }

  .row-text strong {
    font-size: var(--fs-md);
    font-weight: var(--fw-heading);
  }

  .row-text small {
    font-size: var(--fs-xs);
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar {
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .bar span {
    display: block;
    width: 6%;
    height: 100%;
    background: var(--jade);
  }
</style>
