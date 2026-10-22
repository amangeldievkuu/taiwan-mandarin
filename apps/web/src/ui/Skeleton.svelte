<script lang="ts">
  // A placeholder shaped like what is loading, with light passing over it.
  interface Props {
    width?: string;
    height?: string;
    radius?: string;
    /** Several lines of text; the last one shorter. */
    lines?: number;
  }

  let { width = '100%', height = '1em', radius, lines = 1 }: Props = $props();
  const rows = $derived(Array.from({ length: lines }, (_, i) => i));
</script>

{#each rows as i (i)}
  <span
    class="skeleton line"
    style:width={lines > 1 && i === lines - 1 ? '62%' : width}
    style:height
    style:border-radius={radius}
    aria-hidden="true"
  ></span>
{/each}

<style>
  .line {
    display: block;
  }

  .line + .line {
    margin-top: 0.5em;
  }
</style>
