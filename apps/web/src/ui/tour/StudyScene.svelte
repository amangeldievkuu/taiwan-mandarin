<script lang="ts">
  // Tour scene 2, Study: a new card, tapped to show its reading and meaning, graded Good. It goes,
  // the ink and the progress move on, and the next card comes up.
  import { XP } from '@taiwan-mandarin/shared';
  import { formatInterval, t } from '../../lib/i18n/index.svelte';
  import { reached, type Frame } from '../../lib/tour';
  import InkDrop from '../InkDrop.svelte';
  import TapDot from './TapDot.svelte';

  let { frame }: { frame: Frame } = $props();
  const on = (beat: string) => reached(frame, beat);

  const MINUTE = 60_000;
  /** A new card's next reviews, as the app shows them. */
  const GRADES = [
    { key: 'again', zh: '再來', after: MINUTE },
    { key: 'hard', zh: '困難', after: 6 * MINUTE },
    { key: 'good', zh: '記得', after: 10 * MINUTE },
    { key: 'easy', zh: '簡單', after: 4 * 24 * 60 * MINUTE },
  ] as const;
  const GAINED = XP.review + XP.newWord;

  const answered = $derived(on('answer') && !on('next'));
  const done = $derived(on('gone'));
</script>

<div class="scene">
  <div class="top">
    <span class="chip-ish ink" class:bump={done}><InkDrop size={11} /> {done ? GAINED : 0}</span>
    <span class="chip-ish">{t().study.left(done ? 9 : 10)}</span>
  </div>
  <div class="progress"><span style:width={done ? '10%' : '0%'}></span></div>

  <div class="deck">
    {#if !on('next')}
      <div class="card sheet" class:gone={done} class:pressed={on('tap') && !on('answer')}>
        <div class="meta">
          <span class="new">{t().study.new}</span>
          <span class="level-tag">{t().levels.N1}</span>
        </div>
        <div class="face">
          <span class="hanzi word" lang="zh-Hant-TW">謝謝</span>
          <div class="back" class:shown={answered || done}>
            <span class="zhuyin" lang="zh-Hant-TW">ㄒㄧㄝˋ ˙ㄒㄧㄝ</span>
            <span class="pinyin">xièxie</span>
            <strong class="meaning">{t().tour.mock.thanks}</strong>
          </div>
        </div>
      </div>
    {:else}
      <div class="card sheet next">
        <div class="meta">
          <span class="new">{t().study.new}</span>
          <span class="level-tag">{t().levels.N1}</span>
        </div>
        <div class="face"><span class="hanzi word" lang="zh-Hant-TW">你好</span></div>
      </div>
    {/if}
  </div>

  <div class="actions">
    {#if answered}
      <div class="grades">
        {#each GRADES as g (g.key)}
          <span class="grade {g.key}" class:pressed={g.key === 'good' && on('tapGood')}>
            <span class="g-zh hanzi" lang="zh-Hant-TW">{g.zh}</span>
            <small>{t().study.grades[g.key]} · {formatInterval(g.after)}</small>
          </span>
        {/each}
      </div>
    {:else}
      <span class="btn primary show">{t().study.showAnswer}</span>
    {/if}
    {#if done && !on('next')}<span class="float"><InkDrop size={12} /> +{GAINED}</span>{/if}
  </div>

  <TapDot
    x={on('grade') ? 62.5 : 50}
    y={on('grade') ? 89 : 42}
    show={(on('point') && !on('answer')) || (on('grade') && !on('next'))}
    tapping={(on('tap') && !on('answer')) || (on('tapGood') && !on('next'))}
  />
</div>

<style>
  .scene {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--sp-4) var(--sp-4) var(--sp-3);
  }

  .top {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
  }

  .chip-ish {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    height: 26px;
    padding: 0 10px;
    border-radius: var(--radius-pill);
    background: var(--fill);
    font-size: var(--fs-xs);
    font-weight: var(--fw-heading);
    color: var(--ink-2);
    transition: transform var(--dur-3) var(--ease-spring);
  }

  .ink {
    background: var(--gold-wash);
    color: var(--gold-deep);
  }

  .bump {
    transform: scale(1.12);
  }

  .progress {
    height: 6px;
    margin: 10px 0 var(--sp-3);
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    overflow: hidden;
  }

  .progress span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--jade);
    transition: width var(--dur-4) var(--ease-spring-soft);
  }

  .deck {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  .card {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: var(--sp-3) var(--sp-4);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-2);
    transition:
      transform 520ms var(--ease-in),
      opacity 520ms var(--ease-in);
  }

  .card.pressed {
    transform: scale(0.985);
    transition-duration: 120ms;
  }

  .card.gone {
    transform: translateX(70%) rotate(8deg);
    opacity: 0;
  }

  .card.next {
    animation: rise var(--dur-4) var(--ease-spring-soft);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(24px) scale(0.96);
    }
  }

  .meta {
    display: flex;
    gap: 6px;
  }

  .new {
    display: inline-grid;
    place-items: center;
    height: 20px;
    padding: 0 var(--sp-2);
    border-radius: var(--radius-pill);
    background: var(--sky);
    color: var(--sky-ink);
    font-size: var(--fs-2xs);
    font-weight: var(--fw-heading);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .level-tag {
    height: 20px;
    font-size: var(--fs-2xs);
  }

  .face {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .word {
    font-size: 64px;
    line-height: 1;
  }

  .back {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transform: translateY(8px);
    transition:
      opacity var(--dur-3) var(--ease-out),
      transform var(--dur-4) var(--ease-spring-soft);
  }

  .back.shown {
    opacity: 1;
    transform: none;
  }

  .zhuyin {
    font-family: var(--font-kai);
    font-size: var(--fs-lg);
    letter-spacing: 0.06em;
    color: var(--ink-2);
  }

  .pinyin {
    font-size: var(--fs-sm);
    color: var(--ink-3);
  }

  .meaning {
    margin-top: var(--sp-1);
    font-size: var(--fs-lg);
    font-weight: var(--fw-heading);
  }

  .actions {
    position: relative;
    margin-top: var(--sp-3);
    height: 56px;
  }

  .show {
    width: 100%;
    min-height: 48px;
  }

  .grades {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    animation: rise var(--dur-3) var(--ease-spring-soft);
  }

  .grade {
    --c: var(--ink);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 56px;
    border-radius: 12px;
    border: 1.5px solid color-mix(in oklab, var(--c) 35%, transparent);
    background: color-mix(in oklab, var(--c) 7%, var(--paper-raised));
    transition: transform 120ms var(--ease-out);
  }

  .grade.pressed {
    transform: scale(0.94);
    background: color-mix(in oklab, var(--c) 18%, var(--paper-raised));
  }

  .again {
    --c: var(--again);
  }

  .hard {
    --c: var(--hard);
  }

  .good {
    --c: var(--good);
  }

  .easy {
    --c: var(--easy);
  }

  .g-zh {
    font-size: 19px;
    line-height: 1.1;
    color: var(--c);
  }

  .grade small {
    font-size: 9.5px;
    font-weight: var(--fw-strong);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .float {
    position: absolute;
    left: 62.5%;
    top: 0;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--gold-deep);
    font-size: 15px;
    font-weight: var(--fw-heading);
    animation: float-up 900ms var(--ease-out) forwards;
  }

  @keyframes float-up {
    from {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    to {
      opacity: 0;
      transform: translate(-50%, -48px);
    }
  }
</style>
