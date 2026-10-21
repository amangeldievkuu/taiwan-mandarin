<script lang="ts">
  import { canSpeak, speak } from '../lib/speech';
  import { formatInterval } from '../lib/srs';
  import { store } from '../lib/store.svelte';
  import { TOPICS, type Word } from '@taiwan-mandarin/shared';
  import StrokeWriter from './StrokeWriter.svelte';
  import TaiwanNote from './TaiwanNote.svelte';
  import WordGlyphs, { fitSize } from './WordGlyphs.svelte';

  interface Props {
    word: Word | null;
    onclose: () => void;
  }

  let { word, onclose }: Props = $props();

  let dialog: HTMLDialogElement;
  let charIndex = $state(0);

  const settings = $derived(store.settings);
  const other = $derived(settings.meaning === 'ky' ? 'en' : 'ky');
  const chars = $derived(word ? [...word.hanzi] : []);
  const topic = $derived(TOPICS.find((t) => t.id === word?.topic));
  const status = $derived.by(() => {
    const card = word && store.cardFor(word.id);
    if (!card) return 'New · not studied yet';
    const ms = card.due.getTime() - Date.now();
    return ms <= 0 ? 'Due for review' : `Next review in ${formatInterval(ms)}`;
  });

  $effect(() => {
    if (word) {
      charIndex = 0;
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  });

  function onclick(event: MouseEvent) {
    // Clicks on the backdrop land on the <dialog> element itself.
    if (event.target === dialog) onclose();
  }
</script>

<dialog bind:this={dialog} {onclick} onclose={() => word && onclose()} aria-label={word?.hanzi}>
  {#if word}
    <div class="sheet">
      <div class="top">
        <div class="grabber" aria-hidden="true"></div>
        <span class="topic">
          <span lang="zh-Hant-TW">{topic?.zh}</span> · {topic?.[settings.meaning]}
        </span>
        <button type="button" class="close" onclick={onclose}>Done</button>
      </div>

      <div class="hero">
        <WordGlyphs
          {word}
          size={fitSize(chars.length, settings.phonetics, 96, 'min(100vw, 560px) - 64px')}
          phonetics={settings.phonetics}
        />
        {#if canSpeak}
          <button
            type="button"
            class="audio"
            aria-label="Play pronunciation"
            onclick={() => speak(word.hanzi)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
            </svg>
          </button>
        {/if}
      </div>

      <div class="meaning">
        <p class="primary">{word[settings.meaning]}</p>
        <p class="secondary">{word[other]}</p>
      </div>

      {#if word.tw || word.mainland}
        <div class="note">
          <TaiwanNote {word} lang={settings.meaning} />
        </div>
      {/if}

      <p class="status">{status}</p>

      <h2 class="section">Writing</h2>
      {#if chars.length > 1}
        <div class="chars" role="tablist" aria-label="Character">
          {#each chars as char, i (i)}
            <button
              type="button"
              role="tab"
              class="hanzi"
              lang="zh-Hant-TW"
              aria-selected={i === charIndex}
              class:active={i === charIndex}
              onclick={() => (charIndex = i)}
            >
              {char}
            </button>
          {/each}
        </div>
      {/if}
      <StrokeWriter char={chars[charIndex] ?? chars[0] ?? ''} />
    </div>
  {/if}
</dialog>

<style>
  dialog {
    position: fixed;
    inset: auto 0 0;
    width: 100%;
    max-width: var(--content-w);
    max-height: 92dvh;
    margin: 0 auto;
    padding: 0;
    border: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background: var(--bg);
    color: var(--text);
    overflow-y: auto;
    overscroll-behavior: contain;
    transform: translateY(0);
    transition:
      transform calc(var(--dur) * 1.5) var(--ease),
      display calc(var(--dur) * 1.5) allow-discrete,
      overlay calc(var(--dur) * 1.5) allow-discrete;
  }

  dialog:not([open]) {
    transform: translateY(100%);
  }

  @starting-style {
    dialog[open] {
      transform: translateY(100%);
    }
  }

  @media (prefers-color-scheme: dark) {
    dialog {
      background: var(--cell);
    }
  }

  dialog::backdrop {
    background: var(--scrim);
  }

  .sheet {
    padding: 0 20px calc(24px + var(--safe-bottom));
  }

  .grabber {
    position: absolute;
    top: 6px;
    left: calc(50% - 18px);
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--text-3);
    opacity: 0.6;
  }

  .top {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 56px;
    padding-top: 8px;
    margin: 0 -20px;
    padding-inline: 20px;
  }

  dialog .top {
    background: var(--bg);
  }

  @media (prefers-color-scheme: dark) {
    dialog .top {
      background: var(--cell);
    }
  }

  .topic {
    font-size: 13px;
    color: var(--text-2);
  }

  .close {
    min-height: 44px;
    padding: 0 4px;
    font-weight: 600;
    color: var(--accent);
  }

  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 8px 0 4px;
  }

  .audio {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  .audio svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .meaning {
    margin: 16px 0 12px;
    text-align: center;
  }

  .meaning p {
    margin: 0;
  }

  .primary {
    font-size: 22px;
    font-weight: 500;
  }

  .secondary {
    margin-top: 2px;
    font-size: 15px;
    color: var(--text-2);
  }

  .note {
    margin: 0 0 12px;
  }

  @media (prefers-color-scheme: dark) {
    .note {
      --note-bg: #2c2c2e;
    }
  }

  .status {
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: var(--text-2);
  }

  .section {
    margin: 24px 0 12px;
    padding-top: 20px;
    border-top: 1px solid var(--separator);
    font-size: 13px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    color: var(--text-2);
  }

  .chars {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-bottom: 12px;
  }

  .chars button {
    width: 48px;
    height: 48px;
    border-radius: var(--radius);
    font-size: 28px;
    color: var(--text-2);
    background: var(--fill);
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
  }

  .chars button.active {
    color: #fff;
    background: var(--accent);
  }
</style>
