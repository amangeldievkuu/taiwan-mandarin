<script lang="ts">
  import type { LookOf } from '@taiwan-mandarin/shared';
  // A square vermilion name seal (印章) with one or two characters, slightly irregular like a
  // real impression. Used for the streak, the level badge and the app mark. Pressed in the paste
  // chosen at the inkstone (--seal-paste), vermilion by default.
  interface Props {
    text: string;
    size?: number;
    /** Muted outline seal instead of a solid one. */
    outline?: boolean;
    label?: string;
    /** A seal paste to show instead of the learner's (the inkstone's swatches). */
    paste?: LookOf<'paste'>;
  }

  let { text, size = 56, outline = false, label, paste }: Props = $props();
  const chars = $derived([...text]);
</script>

<span
  class="seal {paste ? `paste-${paste}` : ''}"
  class:outline
  style:--s="{size}px"
  role={label ? 'img' : undefined}
  aria-label={label}
  lang="zh-Hant-TW"
>
  <span class="face" class:two={chars.length === 2} class:four={chars.length >= 3}>
    {#each chars as char, i (i)}<span>{char}</span>{/each}
  </span>
</span>

<style>
  .seal {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--s);
    height: var(--s);
    border-radius: calc(var(--s) * 0.12) calc(var(--s) * 0.16) calc(var(--s) * 0.1)
      calc(var(--s) * 0.14);
    --paste: var(--seal-paste, var(--seal));
    --paste-ink: var(--seal-paste-ink, var(--seal-ink));
    background: var(--paste);
    color: var(--paste-ink);
    box-shadow:
      inset 0 0 0 calc(var(--s) * 0.045) color-mix(in srgb, var(--paste-ink) 85%, transparent),
      inset 0 0 0 calc(var(--s) * 0.075) var(--paste);
    font-family: var(--font-kai);
    line-height: 1;
    transform: rotate(-2deg);
  }

  .paste-vermilion {
    --seal-paste: var(--seal);
    --seal-paste-ink: var(--seal-ink);
  }

  .paste-indigo {
    --seal-paste: var(--indigo-paste);
    --seal-paste-ink: var(--indigo-paste-ink);
  }

  .paste-gold {
    --seal-paste: var(--gold);
    --seal-paste-ink: var(--gold-paste-ink);
  }

  .outline {
    background: transparent;
    color: var(--paste);
    box-shadow: inset 0 0 0 calc(var(--s) * 0.045) var(--paste);
    opacity: 0.85;
  }

  .face {
    display: grid;
    place-items: center;
    font-size: calc(var(--s) * 0.56);
  }

  .face.two {
    grid-auto-flow: row;
    font-size: calc(var(--s) * 0.36);
    gap: calc(var(--s) * 0.02);
  }

  .face.four {
    grid-template-columns: 1fr 1fr;
    grid-auto-flow: column;
    grid-template-rows: 1fr 1fr;
    direction: rtl;
    font-size: calc(var(--s) * 0.3);
    gap: calc(var(--s) * 0.03);
  }
</style>
