<script lang="ts">
  import Seal from './Seal.svelte';
  import { router } from '../lib/router.svelte';

  interface Props {
    seal: string;
    text: string;
  }

  let { seal, text }: Props = $props();
</script>

<div class="prompt sheet">
  <Seal text={seal} size={52} outline />
  <div>
    <p>{text}</p>
    <a class="btn primary small" href={router.href('/me')} onclick={router.link}>Sign in</a>
  </div>
</div>

<style>
  .prompt {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 20px;
  }

  p {
    margin: 0 0 10px;
    color: var(--ink-2);
  }
</style>
