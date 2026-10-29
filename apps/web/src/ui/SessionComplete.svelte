<script lang="ts">
  // The end of a study session: the 完 seal stamped, the XP earned counting up, what was done,
  // and the streak plant with this week. Petals, a chime and a buzz when the queue was just finished.
  import type { Kintsugi } from '@taiwan-mandarin/shared';
  import { onMount } from 'svelte';
  import Counter from './Counter.svelte';
  import StreakPlant from './StreakPlant.svelte';
  import Seal from './Seal.svelte';
  import WeekStrip from './WeekStrip.svelte';
  import { celebrate as party } from '../lib/celebrate.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { router } from '../lib/router.svelte';
  import { formatInterval, t } from '../lib/i18n/index.svelte';
  import type { SessionStats } from '../lib/store.svelte';

  interface Props {
    stats: SessionStats;
    xp: number;
    streak: Kintsugi;
    nextDue: Date | null;
    /** The queue was emptied during this visit (not just opened with nothing to do). */
    celebrate: boolean;
  }

  let { stats, xp, streak, nextDue, celebrate }: Props = $props();
  const remembered = $derived(
    stats.reviewed ? Math.round((100 * (stats.reviewed - stats.again)) / stats.reviewed) : 0,
  );

  let seal = $state<HTMLElement>();
  onMount(() => {
    if (!celebrate) return;
    feedback.play('complete');
    feedback.buzz('success');
    const timer = setTimeout(() => party.burst('party', seal?.getBoundingClientRect()), 250);
    return () => clearTimeout(timer);
  });
</script>

<div class="done">
  <span class="stamp" class:celebrate bind:this={seal}><Seal text="完" size={92} /></span>
  <h1 class="hanzi" lang="zh-Hant-TW">今天完成了</h1>
  <p class="sub">
    {stats.reviewed ? t().session.done : t().session.nothing}
  </p>

  {#if stats.reviewed}
    <p class="xp enter" style:--i={1}>
      <span class="spark" aria-hidden="true">✦</span>
      <Counter value={xp} from={0} duration={1200} format={(n) => `+${Math.round(n)}`} /> XP
    </p>
    <dl class="tiles">
      <div class="tile enter" style:--i={2}>
        <dt>{t().session.reviews}</dt>
        <dd><Counter value={stats.reviewed} from={0} /></dd>
      </div>
      <div class="tile enter" style:--i={3}>
        <dt>{t().session.newWords}</dt>
        <dd><Counter value={stats.learned} from={0} /></dd>
      </div>
      <div class="tile enter" style:--i={4}>
        <dt>{t().session.remembered}</dt>
        <dd><Counter value={remembered} from={0} />%</dd>
      </div>
    </dl>
  {/if}

  <section class="bowl sheet enter" style:--i={5} aria-label={t().session.streak}>
    <StreakPlant
      bowl={streak.current}
      crack={streak.crack}
      fresh={streak.mendedToday}
      size={92}
      label={t().today.plant(streak.count)}
    />
    <div class="bowl-body">
      <strong>{t().today.bowl.streak(streak.count)}</strong>
      <span
        >{streak.mendedToday
          ? t().session.mendedToday
          : streak.seams
            ? t().session.seams(streak.seams)
            : t().session.comeBack}</span
      >
      <WeekStrip week={streak.week} />
    </div>
  </section>

  {#if nextDue}
    <p class="next">
      {t().session.nextReview(formatInterval(Math.max(0, nextDue.getTime() - Date.now())))}
    </p>
  {/if}
  <div class="actions enter" style:--i={6}>
    <a class="btn primary" href={router.href('/read')} onclick={router.link}
      >{t().today.readStory}</a
    >
    <a class="btn quiet" href={router.href('/path')} onclick={router.link}>{t().session.browse}</a>
  </div>
</div>

<style>
  .done {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 28px 0;
  }

  .stamp {
    display: grid;
  }

  .stamp.celebrate {
    animation: stamp 620ms var(--ease-spring) both;
  }

  @keyframes stamp {
    0% {
      transform: scale(2.2) rotate(-14deg);
      opacity: 0;
    }
    60% {
      opacity: 1;
    }
  }

  h1 {
    margin: 20px 0 4px;
    font-size: 36px;
  }

  .sub {
    margin: 0;
    color: var(--ink-2);
  }

  .xp {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 20px 0 0;
    padding: 8px 18px;
    border-radius: var(--radius-pill);
    background: var(--gold-wash);
    border: 1.5px solid color-mix(in oklab, var(--gold) 50%, transparent);
    color: var(--gold-deep);
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 900;
  }

  .spark {
    color: var(--gold);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    width: min(420px, 100%);
    margin: 16px 0 0;
  }

  .tile {
    display: flex;
    flex-direction: column-reverse;
    padding: 12px 8px;
    border-radius: var(--radius);
    background: var(--paper-raised);
    border: 1px solid var(--rule);
    box-shadow: var(--shadow-1);
  }

  .tile dt {
    font-size: 13px;
    color: var(--ink-2);
  }

  .tile dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 800;
  }

  .bowl {
    display: flex;
    align-items: center;
    gap: 16px;
    width: min(460px, 100%);
    margin-top: 18px;
    padding: 14px 16px;
    text-align: left;
  }

  .bowl-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .bowl-body strong {
    font-size: 17px;
  }

  .bowl-body > span {
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--ink-2);
  }

  .next {
    margin: 18px 0 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px 10px;
    margin-top: 22px;
  }
</style>
