<script lang="ts">
  // An on/off switch with a springy knob.
  interface Props {
    checked: boolean;
    label: string;
    onchange: (checked: boolean) => void;
  }

  let { checked, label, onchange }: Props = $props();
</script>

<button
  type="button"
  class="switch"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  onclick={() => onchange(!checked)}
>
  <span class="knob"></span>
</button>

<style>
  .switch {
    position: relative;
    flex: none;
    width: 52px;
    height: 32px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
    box-shadow: inset 0 0 0 1.5px var(--rule-strong);
    transition: background-color var(--dur-2) var(--ease-out);
  }

  .switch[aria-checked='true'] {
    background: var(--jade);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--jade-edge) 40%, transparent);
  }

  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #fff;
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.18),
      0 3px 8px -2px rgb(0 0 0 / 0.2);
    transition: transform var(--dur-4) var(--ease-spring);
  }

  .switch[aria-checked='true'] .knob {
    transform: translateX(20px);
  }

  .switch:active .knob {
    width: 30px;
  }
</style>
