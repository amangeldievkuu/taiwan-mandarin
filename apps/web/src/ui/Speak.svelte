<script lang="ts">
  // Pronunciation practice: hear the word, record yourself, compare. Signed in, the recording is
  // checked on the server: syllables by speech-to-text (Whisper), tones from your pitch contour,
  // with your curve drawn over the ideal tone shape.
  import type { PronounceResult as Result } from '@taiwan-mandarin/shared/api';
  import Icon from './Icon.svelte';
  import PronounceResult from './PronounceResult.svelte';
  import { errorText } from '../lib/i18n/errors';
  import { t } from '../lib/i18n/index.svelte';
  import { checkPronunciation } from '../lib/pronounce';
  import { recorder } from '../lib/recorder.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { account } from '../lib/sync.svelte';

  interface Props {
    target: string;
    pinyin?: string;
  }

  let { target, pinyin }: Props = $props();
  let audioUrl = $state<string | null>(null);
  let checking = $state(false);
  let result = $state<Result | null>(null);
  let error = $state<string | null>(null);

  async function toggle() {
    if (recorder.recording) {
      const recording = await recorder.stop();
      if (!recording) return;
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      audioUrl = URL.createObjectURL(recording.blob);
      if (account.user) await check(recording.blob);
    } else {
      result = null;
      error = null;
      // At the longest recording the server takes, it stops and is checked as if tapped.
      await recorder.start(() => {
        if (recorder.recording) void toggle();
      });
    }
  }

  async function check(blob: Blob) {
    checking = true;
    try {
      result = await checkPronunciation(blob, target, pinyin);
    } catch (e) {
      error = errorText(e);
    } finally {
      checking = false;
    }
  }

  function playMine() {
    if (audioUrl) void new Audio(audioUrl).play();
  }

  // Leaving the page: give the microphone back and free the recording.
  $effect(() => () => {
    recorder.cancel();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  });
</script>

<div class="speak">
  <div class="controls">
    {#if canSpeak}
      <button type="button" class="btn quiet small" onclick={() => speak(target)}>
        <Icon name="speaker" size={18} />
        {t().word.listen}
      </button>
    {/if}
    {#if recorder.supported}
      <button
        type="button"
        class="btn small {recorder.recording ? 'seal recording' : 'primary'}"
        disabled={checking || recorder.starting}
        onclick={toggle}
      >
        {#if recorder.recording}<Icon name="pause" size={18} /> {t().reader.stop}{:else}<Icon
            name="mic"
            size={18}
          />
          {t().speak.record}{/if}
      </button>
      {#if audioUrl && !recorder.recording}
        <button type="button" class="btn quiet small" onclick={playMine}>
          <Icon name="play" size={18} />
          {t().speak.playMine}
        </button>
      {/if}
    {:else}
      <span class="hint">{t().speak.unsupported}</span>
    {/if}
  </div>
  {#if recorder.error}<p class="hint">{recorder.error}</p>{/if}
  {#if !account.user && account.checked}
    <p class="hint">{t().speak.signIn}</p>
  {/if}
  {#if checking}<p class="hint">{t().speak.listening}</p>{/if}
  {#if error}<p class="hint error">{error}</p>{/if}

  {#if result}
    <div class="result"><PronounceResult {result} /></div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
  }

  .recording {
    animation: pulse 1.2s infinite;
  }

  @keyframes pulse {
    50% {
      box-shadow: 0 0 0 8px var(--seal-wash);
    }
  }

  .hint {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }

  .error {
    color: var(--seal);
  }

  .result {
    margin-top: var(--sp-4);
  }
</style>
