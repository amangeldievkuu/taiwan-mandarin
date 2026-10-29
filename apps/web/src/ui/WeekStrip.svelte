<script lang="ts">
  // This week, Monday to Sunday: practiced days in jade, mended days with a gold seam, a crack still
  // waiting to be mended in dashed ochre, today in a pulsing ring. Each state has its own shape,
  // not only its own colour.
  import type { WeekDay } from '@taiwan-mandarin/shared';
  import Icon from './Icon.svelte';
  import { t } from '../lib/i18n/index.svelte';

  interface Props {
    week: WeekDay[];
    /** Today can still mend a crack: its ring turns gold. */
    mending?: boolean;
  }

  let { week, mending = false }: Props = $props();

  const NAMES = ['一', '二', '三', '四', '五', '六', '日'];
</script>

<ol class="week" aria-label={t().week.label}>
  {#each week as day, i (day.date)}
    <li
      class="day is-{day.mark}"
      class:current={day.today}
      aria-label="{t().week.days[i]}: {t().week[day.mark]}"
    >
      <span class="name" lang="zh-Hant-TW" aria-hidden="true">{NAMES[i]}</span>
      <span class="mark" class:mending={day.mark === 'today' && mending} aria-hidden="true">
        {#if day.mark === 'done'}
          <Icon name="check" size={16} />
        {:else if day.mark === 'mended'}
          <svg viewBox="0 0 20 20" class="gold-seam">
            <path d="M7 3 L10 8 L8 11 L12 17" />
          </svg>
        {/if}
      </span>
    </li>
  {/each}
</ol>

<style>
  .week {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .name {
    font-family: var(--font-kai);
    font-size: 13px;
    color: var(--ink-3);
  }

  .current .name {
    color: var(--ink);
    font-weight: 700;
  }

  .mark {
    display: grid;
    place-items: center;
    width: min(32px, 100%);
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid var(--rule);
    color: var(--jade-ink);
  }

  .is-done .mark {
    border-color: var(--jade);
    background: var(--jade);
    box-shadow: 0 1px 2px color-mix(in oklab, var(--jade-edge) 40%, transparent);
    animation: pop var(--dur-4) var(--ease-spring);
  }

  .is-mended .mark {
    border-color: var(--gold);
    background: var(--gold-wash);
  }

  .gold-seam {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: var(--gold-deep);
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .is-crack .mark {
    border: 2px dashed var(--ochre);
  }

  .is-empty .mark {
    border-color: transparent;
    background: var(--fill);
    transform: scale(0.5);
  }

  .is-today .mark {
    border-color: var(--jade);
    animation: breathe 2.4s ease-in-out infinite;
  }

  .is-today .mark.mending {
    border: 2px dashed var(--gold-edge);
    background: var(--gold-wash);
  }

  .is-future .mark {
    border-style: dotted;
    opacity: 0.6;
  }

  @keyframes pop {
    from {
      transform: scale(0.6);
    }
  }

  @keyframes breathe {
    50% {
      box-shadow: 0 0 0 6px color-mix(in oklab, var(--jade) 16%, transparent);
    }
  }
</style>
