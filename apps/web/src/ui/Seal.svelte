<script lang="ts">
  // A square vermilion name seal (印章) with one or two characters, slightly irregular like a
  // real impression. Used for the streak, the level badge and the app mark.
  interface Props {
    text: string;
    size?: number;
    /** Muted outline seal instead of a solid one. */
    outline?: boolean;
    label?: string;
  }

  let { text, size = 56, outline = false, label }: Props = $props();
  const chars = $derived([...text]);
</script>

<span
  class="seal"
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
    background: var(--seal);
    color: var(--seal-ink);
    box-shadow:
      inset 0 0 0 calc(var(--s) * 0.045) color-mix(in srgb, var(--seal-ink) 85%, transparent),
      inset 0 0 0 calc(var(--s) * 0.075) var(--seal);
    font-family: var(--font-kai);
    line-height: 1;
    transform: rotate(-2deg);
  }

  .outline {
    background: transparent;
    color: var(--seal);
    box-shadow: inset 0 0 0 calc(var(--s) * 0.045) var(--seal);
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
