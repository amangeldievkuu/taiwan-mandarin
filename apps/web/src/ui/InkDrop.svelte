<script lang="ts">
  // A drop of gold ink (泥金, the gold ink of sutras and fans): what practice earns, where other
  // apps would show XP. Drawn in the current text color.
  interface Props {
    size?: number;
  }

  let { size = 14 }: Props = $props();
</script>

<svg class="ink-drop" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
  <path d="M8 1.2C6.6 3.4 3.2 7.2 3.2 10.4a4.8 4.8 0 0 0 9.6 0C12.8 7.2 9.4 3.4 8 1.2Z" />
  <path class="shine" d="M5.7 10.3a2.5 2.5 0 0 0 1.8 2.5" />
</svg>

<style>
  .ink-drop {
    display: inline-block;
    flex: none;
    vertical-align: -0.12em;
    fill: currentColor;
  }

  .shine {
    fill: none;
    stroke: var(--paper-raised);
    stroke-width: 1.3;
    stroke-linecap: round;
    opacity: 0.75;
  }
</style>
