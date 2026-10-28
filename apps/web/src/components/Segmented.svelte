<script lang="ts" generics="T extends string">
  // A segmented control: a raised thumb slides (with a little spring) to the chosen option.
  interface Option {
    value: T;
    label: string;
    /** Optional font-family for the label (used to preview Kai / Sans). */
    font?: string;
    /** Language of the label, e.g. "zh-Hant-TW" for Chinese labels. */
    lang?: string;
    /** A small second line, e.g. the English for a Chinese label. */
    sub?: string;
  }

  interface Props {
    label: string;
    options: Option[];
    value: T;
    onchange: (value: T) => void;
  }

  let { label, options, value, onchange }: Props = $props();
  const index = $derived(options.findIndex((o) => o.value === value));
  let group = $state<HTMLElement>();

  // The radio-group pattern: one Tab stop (the chosen option), arrow keys move and choose.
  function onKey(e: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const to =
      step !== undefined
        ? (Math.max(0, index) + step + options.length) % options.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? options.length - 1
            : undefined;
    const option = to === undefined ? undefined : options[to];
    if (to === undefined || !option) return;
    e.preventDefault();
    onchange(option.value);
    group?.querySelectorAll<HTMLElement>('[role="radio"]')[to]?.focus();
  }
</script>

<div
  bind:this={group}
  class="segmented"
  role="radiogroup"
  aria-label={label}
  tabindex="-1"
  onkeydown={onKey}
  style:--n={options.length}
  style:--i={Math.max(0, index)}
>
  <span class="thumb" class:hidden={index < 0} aria-hidden="true"></span>
  {#each options as option, i (option.value)}
    <button
      type="button"
      role="radio"
      aria-checked={option.value === value}
      tabindex={i === Math.max(0, index) ? 0 : -1}
      class:active={option.value === value}
      style:font-family={option.font}
      lang={option.lang}
      onclick={() => onchange(option.value)}
    >
      {option.label}
      {#if option.sub}<span class="sub" lang="en">{option.sub}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    position: relative;
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    gap: 2px;
    padding: 3px;
    border-radius: 14px;
    background: var(--paper-sunken);
  }

  /* Columns are equal (1fr), so the thumb is one column wide and moves by whole columns. */
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 6px - (var(--n) - 1) * 2px) / var(--n));
    border-radius: 11px;
    background: var(--paper-raised);
    box-shadow:
      0 0 0 1px var(--rule),
      0 1px 2px rgb(0 0 0 / 0.08),
      0 4px 10px -4px rgb(0 0 0 / 0.12);
    transform: translateX(calc(var(--i) * (100% + 2px)));
    transition: transform var(--dur-4) var(--ease-spring);
  }

  .thumb.hidden {
    opacity: 0;
  }

  button {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 4px 8px;
    border-radius: 11px;
    font-size: 15px;
    font-weight: 700;
    white-space: nowrap;
    color: var(--ink-2);
    transition:
      color var(--dur) var(--ease),
      transform var(--dur-3) var(--ease-spring);
  }

  button:active {
    transform: scale(0.96);
  }

  .active {
    color: var(--ink);
  }

  .sub {
    font-family: var(--font-ui);
    font-size: 11px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--ink-3);
  }

  .active .sub {
    color: var(--ink-2);
  }
</style>
