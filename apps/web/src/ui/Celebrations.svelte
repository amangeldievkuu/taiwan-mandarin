<script lang="ts">
  // Everything celebratory, mounted once in App: toasts, "+10" floats, petal and gold bursts, and
  // the kintsugi moments: the day practice mends a crack with gold, and a new sprout after a plant
  // went to the garden. Each moment is celebrated once per device; on the first run (until the first
  // sync has brought in other devices' practice), what is already true is taken as known.
  import { flip } from 'svelte/animate';
  import Confetti from './Confetti.svelte';
  import StreakPlant from './StreakPlant.svelte';
  import Seal from './Seal.svelte';
  import { celebrate } from '../lib/celebrate.svelte';
  import { once, seeded } from '../lib/celebrated';
  import { feedback } from '../lib/feedback.svelte';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';
  import { toasts } from '../lib/toast.svelte';
  import { fade, rise } from '../lib/transitions';

  $effect(() => {
    if (!store.ready) return;
    const streak = store.streak;
    const seam = streak.mendedToday;
    if (seam && once(`mend:${seam.mendedOn}`)) {
      toasts.show(
        {
          kind: 'mend',
          title: '金繼 · Mended with gold',
          body:
            `You came back, and ${seam.days === 1 ? 'the missed day' : `${seam.days} missed days`} ` +
            `turned to gold. ${streak.count} days of growing.`,
        },
        6500,
      );
      feedback.play('mend');
      feedback.buzz('mend');
      celebrate.burst('gold');
    }
    const bowl = streak.current;
    if (bowl && streak.practicedToday && bowl.days === 1 && streak.shelf.length) {
      if (once(`bowl:${bowl.start}`)) {
        toasts.show({
          kind: 'bowl',
          title: '新芽 · A new sprout',
          body: 'Your last plant is in your garden, gold and all. This one starts today.',
        });
      }
    }
    for (const seal of store.seals) {
      if (seal.progress >= 1 && once(`seal:${seal.id}`)) {
        toasts.show({ kind: 'seal', title: `New seal · ${seal.en}`, seal: seal.zh });
        feedback.play('stamp');
      }
    }
    // Signed in, other devices' practice arrives with the first full sync: until then, what shows
    // up was earned before and is taken as seen, not announced (a new device would toast them all).
    if (account.checked && (!account.user || store.activity.remoteComplete)) seeded();
  });
</script>

<Confetti />

<div class="floats" aria-hidden="true">
  {#each celebrate.floats as f (f.id)}
    <span
      class="float"
      style:left="{f.x}px"
      style:top="{f.y}px"
      onanimationend={() => celebrate.done(f.id)}>{f.text}</span
    >
  {/each}
</div>

<div class="toasts" aria-live="polite">
  {#each toasts.items as toast (toast.id)}
    <div
      class="toast {toast.kind}"
      role="status"
      in:rise={{ y: -16 }}
      out:fade={{ duration: 180 }}
      animate:flip={{ duration: 300 }}
    >
      {#if toast.kind === 'mend'}
        <StreakPlant
          bowl={store.streak.current}
          fresh={store.streak.mendedToday}
          size={64}
          label="Your streak plant"
        />
      {:else if toast.kind === 'seal' && toast.seal}
        <span class="stamp"><Seal text={toast.seal} size={46} /></span>
      {:else if toast.kind === 'bowl'}
        <StreakPlant bowl={store.streak.current} size={56} label="A new sprout" />
      {/if}
      <span class="text">
        <strong lang="zh-Hant-TW">{toast.title}</strong>
        {#if toast.body}<span>{toast.body}</span>{/if}
      </span>
      <button
        type="button"
        class="close"
        aria-label="Dismiss"
        onclick={() => toasts.dismiss(toast.id)}>×</button
      >
    </div>
  {/each}
</div>

<style>
  .float {
    position: fixed;
    z-index: 61;
    pointer-events: none;
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 900;
    color: var(--gold-deep);
    text-shadow:
      0 1px 0 var(--paper-raised),
      0 0 12px color-mix(in oklab, var(--gold) 60%, transparent);
    transform: translate(-50%, -50%);
    animation: float-up 950ms var(--ease-out) forwards;
  }

  @keyframes float-up {
    0% {
      opacity: 0;
      transform: translate(-50%, -30%) scale(0.6);
    }
    20% {
      opacity: 1;
      transform: translate(-50%, -80%) scale(1.15);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -260%) scale(1);
    }
  }

  .toasts {
    position: fixed;
    z-index: 55;
    top: calc(var(--safe-top) + 12px);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: min(440px, calc(100vw - 24px));
    pointer-events: none;
    view-transition-name: toasts;
  }

  @media (min-width: 1100px) {
    .toasts {
      left: auto;
      right: 24px;
      transform: none;
    }
  }

  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius);
    border: 1px solid var(--rule);
    background: var(--paper-raised);
    box-shadow: var(--shadow-3);
    pointer-events: auto;
  }

  .toast.mend {
    border-color: color-mix(in oklab, var(--gold) 60%, transparent);
    background: linear-gradient(135deg, var(--gold-wash), var(--paper-raised) 60%);
  }

  .stamp {
    display: grid;
    animation: stamp 520ms var(--ease-spring) both;
  }

  @keyframes stamp {
    from {
      transform: scale(1.8) rotate(-12deg);
      opacity: 0;
    }
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .text strong {
    font-size: 15px;
    color: var(--ink);
  }

  .close {
    align-self: flex-start;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    font-size: 18px;
    line-height: 1;
    color: var(--ink-3);
  }
</style>
