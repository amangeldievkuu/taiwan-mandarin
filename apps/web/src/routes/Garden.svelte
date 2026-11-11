<script lang="ts">
  // The garden: past streak plants on their shelf, how the plant grows, and the seal album.
  import SealAlbum from '../ui/SealAlbum.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import SubpageHead from '../ui/SubpageHead.svelte';
  import { intlLocale, t } from '../lib/i18n/index.svelte';
  import { store } from '../lib/store.svelte';

  /** Past plants (the shelf of finished streaks), newest first. */
  const shelf = $derived([...store.streak.shelf].reverse());

  const short = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(intlLocale(), {
      day: 'numeric',
      month: 'short',
    });
</script>

<div class="page">
  <SubpageHead title={t().me.garden} zh="花園" />

  <h2 class="section-title">{t().garden.title} <span class="zh" lang="zh-Hant-TW">花園</span></h2>
  <div class="shelf-card sheet">
    {#if shelf.length}
      <ol class="shelf" aria-label={t().garden.past}>
        {#each shelf as bowl, i (bowl.start)}
          <li class="fired enter" style:--i={i}>
            <StreakPlant {bowl} size={84} label={t().garden.days(bowl.days)} />
            <strong>{t().garden.days(bowl.days)}</strong>
            <small>{short(bowl.start)} – {short(bowl.end)}</small>
            {#if bowl.seams.length}<small class="gold">{t().garden.seams(bowl.seams.length)}</small
              >{/if}
          </li>
        {/each}
      </ol>
    {:else}
      <p class="how empty-shelf">{t().garden.empty}</p>
    {/if}
    <p class="how">
      <strong>{t().garden.howTitle}</strong>
      {t().garden.how}
    </p>
  </div>

  <h2 class="section-title">{t().garden.seals} <span class="zh" lang="zh-Hant-TW">印譜</span></h2>
  <div class="sheet seals-card">
    <SealAlbum seals={store.seals} />
  </div>
</div>

<style>
  .shelf-card {
    padding: var(--sp-4) var(--sp-5);
  }

  .shelf {
    display: flex;
    gap: var(--sp-3);
    margin: 0 0 var(--sp-4);
    padding: var(--sp-1) 2px 10px;
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
    background: var(--paper-sunken);
    scroll-snap-align: start;
    text-align: center;
  }

  .fired strong {
    margin-top: var(--sp-1);
    font-size: var(--fs-md);
  }

  .fired small {
    font-size: var(--fs-xs);
    color: var(--ink-2);
  }

  .fired .gold {
    color: var(--gold-deep);
    font-weight: var(--fw-strong);
  }

  .how {
    margin: 0;
    font-size: var(--fs-md);
    line-height: 1.55;
    color: var(--ink-2);
  }

  .empty-shelf {
    margin-bottom: var(--sp-4);
  }

  .how strong {
    color: var(--ink);
  }

  .seals-card {
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
  }
</style>
