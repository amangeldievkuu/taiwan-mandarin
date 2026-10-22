<script lang="ts">
  // Offers the new version once it is downloaded; stays until the learner reloads or says later.
  import { pwa } from '../lib/pwa.svelte';
  import { rise } from '../lib/transitions';
</script>

{#if pwa.needRefresh}
  <div class="update" role="status" in:rise={{ y: 16 }}>
    <span>A new version of the app is ready.</span>
    <button type="button" class="btn primary small" onclick={() => pwa.reload()}>Reload</button>
    <button type="button" class="btn quiet small" onclick={() => pwa.later()}>Later</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    z-index: 56;
    left: 50%;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 12px);
    transform: translateX(-50%);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    width: min(440px, calc(100vw - 24px));
    padding: 12px 14px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper-raised);
    box-shadow: var(--shadow-3);
    font-size: 14px;
  }

  .update span {
    flex: 1;
    min-width: 12ch;
  }

  /* No tab bar beside the rail. */
  @media (min-width: 700px) {
    .update {
      left: calc(50% + var(--rail-w) / 2);
      bottom: calc(var(--safe-bottom) + 24px);
    }
  }
</style>
