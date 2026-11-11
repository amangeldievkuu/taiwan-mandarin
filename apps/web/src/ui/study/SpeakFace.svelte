<script lang="ts">
  // 說話: the word's characters with the reading hidden. Say it: the recording ends the question
  // and the answer opens with the word's voice. Signed in, the recording is checked too (Whisper and
  // pitch, as on the word page), and the result suggests a grade. Otherwise the learner compares
  // their recording with the word by ear.
  import type { Phonetics, Word } from '@taiwan-mandarin/shared';
  import type { PronounceResult as Result } from '@taiwan-mandarin/shared/api';
  import { untrack } from 'svelte';
  import Icon from '../Icon.svelte';
  import PronounceResult from '../PronounceResult.svelte';
  import WordGlyphs from '../../components/WordGlyphs.svelte';
  import { errorText } from '../../lib/i18n/errors';
  import { t } from '../../lib/i18n/index.svelte';
  import { checkPronunciation } from '../../lib/pronounce';
  import { recorder } from '../../lib/recorder.svelte';
  import type { Grade } from '../../lib/srs';
  import { suggestSpeakGrade } from '../../lib/study-modes';
  import { account } from '../../lib/sync.svelte';

  interface Props {
    word: Word;
    phonetics: Phonetics;
    /** CSS length for the hanzi. */
    size: string;
    revealed: boolean;
    /** A recording was made: the answer can open. */
    onanswered: () => void;
    onsuggest: (grade: Grade | undefined) => void;
  }

  let { word, phonetics, size, revealed, onanswered, onsuggest }: Props = $props();

  let audioUrl = $state<string | null>(null);
  let checking = $state(false);
  let result = $state<Result | null>(null);
  let error = $state<string | null>(null);
  /** This card was left, so a check still on its way has nowhere to go. */
  let gone = false;

  /** Starts or stops the recording (the mic button, or M). */
  export async function toggle(): Promise<void> {
    if (untrack(() => revealed) || recorder.starting) return;
    if (!recorder.recording) {
      error = null;
      // At the longest recording the server takes, it stops as if tapped.
      await recorder.start(() => {
        if (recorder.recording) void toggle();
      });
      return;
    }
    const recording = await recorder.stop();
    if (!recording || gone) return;
    audioUrl = URL.createObjectURL(recording.blob);
    onanswered();
    if (account.user) await check(recording.blob);
  }

  async function check(blob: Blob) {
    checking = true;
    try {
      const checked = await checkPronunciation(blob, word.hanzi, word.pinyin);
      if (!gone) result = checked;
    } catch (e) {
      if (!gone) error = errorText(e);
    } finally {
      checking = false;
    }
  }

  function playMine() {
    if (audioUrl) void new Audio(audioUrl).play();
  }

  // The answer opened another way (Show answer): a recording still going would catch the word's
  // own voice, so it is dropped.
  $effect(() => {
    if (revealed && untrack(() => recorder.recording || recorder.starting)) recorder.cancel();
  });

  // Leaving the card: give the microphone back and free the recording.
  $effect(() => () => {
    gone = true;
    recorder.cancel();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  });

  $effect(() => onsuggest(result ? suggestSpeakGrade(result) : undefined));
</script>

<div class="glyphs">
  <WordGlyphs {word} {size} {phonetics} show={revealed} />
</div>

{#if !revealed}
  {#if recorder.supported}
    <button
      type="button"
      class="mic"
      class:recording={recorder.recording}
      aria-pressed={recorder.recording}
      aria-label={recorder.recording ? t().reader.stop : t().speak.record}
      aria-keyshortcuts="M"
      disabled={recorder.starting}
      onclick={(e) => {
        e.stopPropagation();
        void toggle();
      }}
    >
      <Icon name={recorder.recording ? 'pause' : 'mic'} size={34} />
    </button>
    <p class="hint" aria-live="polite">
      {recorder.recording ? t().study.recording : t().study.sayIt}
    </p>
    {#if recorder.error}<p class="hint">{recorder.error} {t().study.sayAloud}</p>{/if}
  {:else}
    <p class="hint">{t().speak.unsupported} {t().study.sayAloud}</p>
  {/if}
{:else if audioUrl}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="heard" onclick={(e) => e.stopPropagation()}>
    {#if checking}<p class="hint" aria-live="polite">{t().speak.listening}</p>{/if}
    {#if result}<PronounceResult {result} centered />{/if}
    {#if error}<p class="hint error">{error}</p>{/if}
    <button type="button" class="btn quiet small" onclick={playMine}>
      <Icon name="play" size={18} />
      {t().speak.playMine}
    </button>
    {#if !account.user && account.checked}
      <p class="hint">{t().study.compare} {t().speak.signIn}</p>
    {/if}
  </div>
{/if}

<style>
  .glyphs {
    display: flex;
    justify-content: center;
  }

  .mic {
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    margin-top: var(--sp-4);
    border-radius: 50%;
    color: var(--jade-ink);
    background: var(--jade);
    box-shadow: var(--shadow-2);
    transition:
      transform 160ms var(--ease-out),
      background-color var(--dur-2) var(--ease-out);
  }

  .mic:active {
    transform: scale(0.95);
    transition-duration: 80ms;
  }

  .mic:disabled {
    opacity: 0.6;
  }

  .mic.recording {
    color: #fff;
    background: var(--seal);
    animation: pulse 1.2s infinite;
  }

  @keyframes pulse {
    50% {
      box-shadow: 0 0 0 10px var(--seal-wash);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .mic.recording {
      animation: none;
    }
  }

  .hint {
    max-width: 34ch;
    margin: 10px 0 0;
    font-size: var(--fs-md);
    text-align: center;
    color: var(--ink-2);
  }

  .error {
    color: var(--seal);
  }

  .heard {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    margin-top: var(--sp-3);
    cursor: auto;
  }
</style>
