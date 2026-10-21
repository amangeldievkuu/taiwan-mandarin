<script lang="ts" generics="T extends string">
  interface Option {
    value: T;
    label: string;
    /** Optional font-family for the label (used to preview Kai / Sans). */
    font?: string;
    /** Language of the label, e.g. "zh-Hant-TW" for Chinese labels. */
    lang?: string;
  }

  interface Props {
    label: string;
    options: Option[];
    value: T;
    onchange: (value: T) => void;
  }

  let { label, options, value, onchange }: Props = $props();
</script>

<div class="segmented" role="radiogroup" aria-label={label}>
  {#each options as option (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      class:active={option.value === value}
      style:font-family={option.font}
      lang={option.lang}
      onclick={() => onchange(option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 2px;
    padding: 2px;
    border-radius: 9px;
    background: var(--fill);
  }

  button {
    min-height: 40px;
    padding: 4px 8px;
    border-radius: 7px;
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    transition:
      background-color var(--dur) var(--ease),
      box-shadow var(--dur) var(--ease);
  }

  .active {
    background: var(--bg);
    box-shadow:
      0 0 0 0.5px rgba(0, 0, 0, 0.04),
      0 2px 6px rgba(0, 0, 0, 0.08);
  }

  @media (prefers-color-scheme: dark) {
    .active {
      background: #636366;
      box-shadow: none;
    }
  }
</style>
