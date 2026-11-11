<script lang="ts">
  // One row of a settings list: a label (with an optional current value and a hint) and its
  // control. Toggles and short controls sit on the right; `stacked` rows put the control on its
  // own line, for sliders and wide segmented controls.
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    /** The current value, shown bold next to the label. */
    value?: string;
    hint?: string;
    stacked?: boolean;
    children: Snippet;
  }

  let { label, value, hint, stacked = false, children }: Props = $props();
</script>

<div class="setting" class:stacked>
  <div class="text">
    <span class="label"
      >{label}{#if value}<b class="tabular">{value}</b>{/if}</span
    >
    {#if hint}<small>{hint}</small>{/if}
  </div>
  <div class="control">{@render children()}</div>
</div>

<style>
  .setting {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: var(--sp-2) var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
  }

  .setting.stacked {
    grid-template-columns: 1fr;
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .label {
    font-weight: var(--fw-label);
  }

  .label b {
    margin-left: var(--sp-2);
    font-weight: var(--fw-heading);
    color: var(--jade-text);
  }

  small {
    font-size: var(--fs-sm);
    line-height: 1.4;
    color: var(--ink-2);
  }

  .control {
    min-width: 0;
  }

  .stacked .control {
    width: 100%;
  }

  .control :global(input[type='range']) {
    width: 100%;
    margin: var(--sp-1) 0 2px;
    accent-color: var(--jade);
  }
</style>
