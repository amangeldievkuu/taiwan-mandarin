<script lang="ts">
  // The garden: past streak plants on their shelf, how the plant grows, and the seal album.
  import SealAlbum from '../ui/SealAlbum.svelte';
  import StreakPlant from '../ui/StreakPlant.svelte';
  import SubpageHead from '../ui/SubpageHead.svelte';
  import { store } from '../lib/store.svelte';

  /** Past plants (the shelf of finished streaks), newest first. */
  const shelf = $derived([...store.streak.shelf].reverse());

  const short = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
</script>

<div class="page">
  <SubpageHead title="Garden & seals" zh="花園" />

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
    {:else}
      <p class="how empty-shelf">
        Nothing on the shelf yet: your first plant is still growing. Plants come here after a longer
        break, gold seams and all.
      </p>
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
</div>

<style>
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
    background: var(--paper-sunken);
    scroll-snap-align: start;
    text-align: center;
  }

  .fired strong {
    margin-top: 4px;
    font-size: 15px;
  }

  .fired small {
    font-size: 12px;
    color: var(--ink-2);
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

  .empty-shelf {
    margin-bottom: 14px;
  }

  .how strong {
    color: var(--ink);
  }

  .seals-card {
    padding: 16px 18px 20px;
  }
</style>
