<script lang="ts">
  // Pronunciation practice: hear the word, record yourself, compare. With an account, the
  // recording is also checked on the server (speech-to-text plus tone analysis).
  import Icon from './Icon.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { recorder } from '../lib/recorder.svelte';

  interface Props {
    target: string;
  }

  let { target }: Props = $props();
  let audioUrl = $state<string | null>(null);

  async function toggle() {
    if (recorder.recording) {
      const result = await recorder.stop();
      if (!result) return;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(result.blob);
    } else {
      await recorder.start();
    }
  }

  function playMine() {
    if (audioUrl) void new Audio(audioUrl).play();
  }

  $effect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  });
</script>

<div class="speak">
  {#if canSpeak}
    <button type="button" class="btn quiet small" onclick={() => speak(target)}>
      <Icon name="speaker" size={18} /> Listen
    </button>
  {/if}
  {#if recorder.supported}
    <button
      type="button"
      class="btn small {recorder.recording ? 'seal' : 'primary'}"
      onclick={toggle}
    >
      {#if recorder.recording}<Icon name="pause" size={18} /> Stop{:else}<Icon
          name="mic"
          size={18}
        /> Record{/if}
    </button>
    {#if audioUrl && !recorder.recording}
      <button type="button" class="btn quiet small" onclick={playMine}
        ><Icon name="play" size={18} /> Play mine</button
      >
    {/if}
  {:else}
    <span class="hint">Recording isn't available in this browser.</span>
  {/if}
  {#if recorder.error}<p class="hint">{recorder.error}</p>{/if}
</div>

<style>
  .speak {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .hint {
    margin: 0;
    font-size: 14px;
    color: var(--ink-2);
  }
</style>
