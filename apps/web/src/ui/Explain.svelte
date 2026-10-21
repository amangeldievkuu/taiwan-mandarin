<script lang="ts">
  // Paste a sign, menu or message from Taiwan (or take a photo of it): translation, word-by-word
  // breakdown with Taiwan readings, grammar and usage notes. Signed out, text can still be tapped
  // through word by word.
  import { LEVELS, type Level } from '@taiwan-mandarin/shared';
  import type { ExplainResult } from '@taiwan-mandarin/shared/api';
  import HanziText from './HanziText.svelte';
  import Icon from './Icon.svelte';
  import Reading from './Reading.svelte';
  import SignInPrompt from './SignInPrompt.svelte';
  import { api } from '../lib/api';
  import { photoToBase64 } from '../lib/image';
  import { canSpeak, speak } from '../lib/speech';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  let text = $state('');
  let photo = $state<{ data: string; mediaType: 'image/jpeg'; preview: string } | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let result = $state<ExplainResult | null>(null);
  let fileInput = $state<HTMLInputElement>();

  async function pick(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const { data, mediaType } = await photoToBase64(file);
    photo = { data, mediaType, preview: `data:${mediaType};base64,${data}` };
  }

  async function explain() {
    busy = true;
    error = null;
    try {
      result = await api<ExplainResult>('/v1/ai/explain', {
        method: 'POST',
        body: {
          ...(text.trim() ? { text: text.trim() } : {}),
          ...(photo ? { image: { data: photo.data, mediaType: photo.mediaType } } : {}),
        },
      });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  const levelLabel = (id?: string) => LEVELS.find((l) => l.id === id)?.en;
  const status = (id?: string) =>
    !id ? null : store.cards[id] ? 'studying' : store.inDeck(id) ? 'deck' : 'new';
</script>

<section class="explain">
  <div class="input sheet">
    <textarea
      bind:value={text}
      rows="3"
      placeholder="Paste Chinese text: a sign, a menu, a LINE message…"
      lang="zh-Hant-TW"></textarea>
    {#if photo}
      <div class="photo">
        <img src={photo.preview} alt="Selected sign or menu" />
        <button
          type="button"
          class="remove"
          aria-label="Remove photo"
          onclick={() => (photo = null)}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    {/if}
    <div class="bar">
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onchange={pick}
      />
      <button type="button" class="btn quiet small" onclick={() => fileInput?.click()}>
        <Icon name="camera" size={18} /> Photo
      </button>
      {#if account.user}
        <button
          type="button"
          class="btn seal small"
          disabled={busy || (!text.trim() && !photo)}
          onclick={explain}
        >
          <Icon name="sparkle" size={18} />
          {busy ? 'Reading…' : 'Explain'}
        </button>
      {/if}
    </div>
  </div>

  {#if !account.user && account.checked}
    <SignInPrompt
      seal="解"
      text="Sign in to get an AI breakdown with translation, grammar and notes. Without an account you can still tap through the text word by word."
    />
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if result}
    <article class="result">
      <div class="source sheet">
        <div class="source-line">
          <HanziText text={result.source} class="source-zh" />
          {#if canSpeak}
            <button
              type="button"
              class="tool"
              aria-label="Listen"
              onclick={() => result && speak(result.source)}
            >
              <Icon name="speaker" />
            </button>
          {/if}
        </div>
        <p class="translation">{result.translation}</p>
      </div>

      <h3 class="section-title">Word by word <span class="zh" lang="zh-Hant-TW">逐詞</span></h3>
      <ol class="tokens">
        {#each result.tokens.filter((t) => t.pinyin) as token, i (i)}
          {@const st = status(token.wordId)}
          <li class="token sheet">
            <span class="t-zh hanzi" lang="zh-Hant-TW">{token.text}</span>
            {#if token.pinyin}<Reading pinyin={token.pinyin} />{/if}
            <span class="t-gloss">{token.gloss ?? ''}</span>
            {#if token.note}<span class="t-note">{token.note}</span>{/if}
            <span class="t-foot">
              {#if token.level}<span class="level-tag">{levelLabel(token.level)}</span>{/if}
              {#if token.wordId && token.level}
                {#if st === 'new'}
                  <button
                    type="button"
                    class="add"
                    onclick={() =>
                      token.wordId &&
                      store.addToDeck({ id: token.wordId, level: token.level as Level })}
                  >
                    <Icon name="plus" size={14} /> Deck
                  </button>
                {:else}
                  <span class="have"><Icon name="check" size={14} /></span>
                {/if}
              {/if}
            </span>
          </li>
        {/each}
      </ol>

      {#if result.grammar.length}
        <h3 class="section-title">Grammar <span class="zh" lang="zh-Hant-TW">語法</span></h3>
        <ul class="list notes">
          {#each result.grammar as g, i (i)}
            <li class="row">
              <span class="row-main"
                ><strong lang="zh-Hant-TW" class="hanzi">{g.pattern}</strong>
                <span class="row-sub wrap">{g.explanation}</span></span
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if result.notes.length}
        <h3 class="section-title">Notes <span class="zh" lang="zh-Hant-TW">說明</span></h3>
        <ul class="list notes">
          {#each result.notes as note, i (i)}<li class="row">{note}</li>{/each}
        </ul>
      {/if}
      {#if result.warnings.length}
        <p class="footnote">Taiwan-standard check: {result.warnings.join(' · ')}</p>
      {/if}
      <p class="footnote">
        AI explanation. Readings come from the TOCFL lists and dictionary where possible.
      </p>
    </article>
  {:else if text.trim() && !busy}
    <div class="sheet tap">
      <p class="hint">Tap any character to look up the word that starts there.</p>
      <HanziText text={text.trim()} class="tap-text" />
    </div>
  {/if}
</section>

<style>
  .input {
    padding: 12px;
  }

  textarea {
    width: 100%;
    padding: 6px 8px;
    border: 0;
    background: transparent;
    font-size: 20px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
  }

  .photo {
    position: relative;
    display: inline-block;
    margin: 4px 8px;
  }

  .photo img {
    max-height: 160px;
    border-radius: var(--radius-sm);
  }

  .remove {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--paper);
  }

  .bar {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--rule);
  }

  .explain > :global(.prompt) {
    margin-top: 14px;
  }

  .error {
    color: var(--seal);
  }

  .result {
    margin-top: 18px;
    animation: rise 300ms var(--ease);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  .source {
    padding: 18px 20px;
  }

  .source-line {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .source :global(.source-zh) {
    font-size: 28px;
    line-height: 1.6;
  }

  .translation {
    margin: 8px 0 0;
    font-family: var(--font-serif);
    font-size: 19px;
    line-height: 1.45;
  }

  .tool {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: var(--ink-2);
    background: var(--fill);
  }

  .tokens {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .token {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px 14px;
  }

  .t-zh {
    font-size: 28px;
    line-height: 1.2;
  }

  .token :global(.reading) {
    font-size: 13px;
  }

  .t-gloss {
    font-size: 14px;
  }

  .t-note {
    font-size: 12px;
    color: var(--ink-2);
  }

  .t-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    margin-top: auto;
    padding-top: 6px;
  }

  .add {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--seal-wash);
    color: var(--seal);
    font-size: 12px;
    font-weight: 700;
  }

  .have {
    color: var(--jade);
  }

  .notes .row {
    font-size: 15px;
  }

  .wrap {
    white-space: normal !important;
  }

  .tap {
    margin-top: 16px;
    padding: 16px 18px;
  }

  .hint {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--ink-2);
  }

  .tap :global(.tap-text) {
    font-size: 26px;
    line-height: 1.7;
  }
</style>
