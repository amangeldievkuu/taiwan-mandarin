<script lang="ts">
  // A number that counts to its value, and on to each new value. Screen readers get the final
  // number only, not every step.
  import { untrack } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { Tween } from 'svelte/motion';
  import { reduced } from '../lib/motion';

  interface Props {
    value: number;
    /** Where the first count starts; by default the value itself (no count when first shown). */
    from?: number;
    duration?: number;
    format?: (n: number) => string;
  }

  let {
    value,
    from,
    duration = 700,
    format = (n) => Math.round(n).toLocaleString('en-US'),
  }: Props = $props();

  const tween = new Tween(
    untrack(() => from ?? value),
    { duration: () => (reduced() ? 0 : duration), easing: cubicOut },
  );
  $effect(() => {
    tween.target = value;
  });
</script>

<span class="tabular" aria-hidden="true">{format(tween.current)}</span><span class="visually-hidden"
  >{format(value)}</span
>
