<script lang="ts">
  // A fingertip in the tour: it glides to (x, y) on the screen when shown, presses down when
  // tapping, and sends out a ring. Positions are in % of the tour's screen.
  interface Props {
    x: number;
    y: number;
    show: boolean;
    tapping?: boolean;
  }

  let { x, y, show, tapping = false }: Props = $props();
</script>

<span class="tap" class:show class:tapping style:--x="{x}%" style:--y="{y}%" aria-hidden="true">
  <span class="ring"></span>
</span>

<style>
  .tap {
    position: absolute;
    left: var(--x);
    top: var(--y);
    z-index: 30;
    width: 38px;
    height: 38px;
    margin: -19px 0 0 -19px;
    border-radius: 50%;
    background: rgb(26 28 30 / 0.22);
    border: 2px solid rgb(255 255 255 / 0.9);
    box-shadow: 0 6px 16px -4px rgb(26 28 30 / 0.35);
    opacity: 0;
    transform: translate(18px, 26px) scale(0.9);
    transition:
      left 700ms var(--ease-in-out),
      top 700ms var(--ease-in-out),
      opacity var(--dur-3) var(--ease-out),
      transform var(--dur-3) var(--ease-out);
    pointer-events: none;
  }

  .show {
    opacity: 1;
    transform: none;
  }

  .tapping {
    transform: scale(0.82);
    background: rgb(26 28 30 / 0.32);
  }

  .ring {
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 2px solid var(--jade);
    opacity: 0;
  }

  .tapping .ring {
    animation: ripple 620ms var(--ease-out);
  }

  @keyframes ripple {
    from {
      opacity: 0.9;
      transform: scale(0.8);
    }
    to {
      opacity: 0;
      transform: scale(2.2);
    }
  }
</style>
