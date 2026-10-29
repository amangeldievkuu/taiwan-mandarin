<script lang="ts">
  // Paste a sign, menu or message from Taiwan (or take a photo of it): translation, word-by-word
  // breakdown with Taiwan readings, grammar and usage notes, streamed in as the AI writes them.
  // Signed out, text can still be tapped through word by word.
  import { isLevel, type Level } from '@taiwan-mandarin/shared';
  import type { ExplainResult, ExplainStreamEvent } from '@taiwan-mandarin/shared/api';
  import HanziText from './HanziText.svelte';
  import Icon from './Icon.svelte';
  import Reading from './Reading.svelte';
  import SignInPrompt from './SignInPrompt.svelte';
  import { ApiError, apiStream } from '../lib/api';
  import { errorText } from '../lib/i18n/errors';
  import { locale, t } from '../lib/i18n/index.svelte';
  import { photoToBase64 } from '../lib/image';
  import { canSpeak, speak } from '../lib/speech';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  /** The explanation as far as it has arrived; `done` once the final result replaced it. */
  type View = ExplainResult & { done: boolean };

  let text = $state('');
  let photo = $state<{ data: string; mediaType: 'image/jpeg'; preview: string } | null>(null);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let view = $state<View | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let controller: AbortController | null = null;

  // Leaving the page stops the answer.
  $effect(() => () => controller?.abort());

  async function pick(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    const { data, mediaType } = await photoToBase64(file);
    photo = { data, mediaType, preview: `data:${mediaType};base64,${data}` };
  }

  async function explain() {
    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    busy = true;
    error = null;
    const typed = text.trim();
    view = {
      source: typed,
      translation: '',
      tokens: [],
      grammar: [],
      notes: [],
      warnings: [],
      done: false,
    };
    try {
      const events = apiStream<ExplainStreamEvent>(
        '/v1/ai/explain/stream',
        {
          ...(typed ? { text: typed } : {}),
          ...(photo ? { image: { data: photo.data, mediaType: photo.mediaType } } : {}),
          lang: locale.lang,
        },
        { signal: mine.signal },
      );
      for await (const event of events) {
        if (!view) break;
        if (event.type === 'source') view.source = event.text;
        else if (event.type === 'translation') view.translation = event.text;
        else if (event.type === 'token') view.tokens.push(event.token);
        else if (event.type === 'done') view = { ...event.result, done: true };
        else if (event.type === 'error')
          throw new ApiError(event.status, event.message, { code: event.code });
      }
      if (view && !view.done && !mine.signal.aborted) error = t().explain.stoppedEarly;
    } catch (e) {
      if (!mine.signal.aborted) error = errorText(e);
    } finally {
      if (controller === mine) {
        controller = null;
        busy = false;
      }
    }
  }

  function stop() {
    controller?.abort();
    controller = null;
    busy = false;
  }

  const levelLabel = (id?: string) => (isLevel(id) ? t().levels[id] : undefined);
  const status = (id?: string) =>
    !id ? null : store.cards[id] ? 'studying' : store.inDeck(id) ? 'deck' : 'new';
</script>

<section class="explain">
  <div class="input sheet">
    <textarea
      bind:value={text}
      rows="3"
      aria-label={t().explain.label}
      placeholder={t().explain.placeholder}
      lang="zh-Hant-TW"></textarea>
    {#if photo}
      <div class="photo">
        <img src={photo.preview} alt={t().explain.photoAlt} />
        <button
          type="button"
          class="remove"
          aria-label={t().explain.removePhoto}
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
        <Icon name="camera" size={18} />
        {t().explain.photo}
      </button>
      {#if account.user}
        {#if busy}
          <button type="button" class="btn quiet small" onclick={stop}>
            <Icon name="close" size={18} />
            {t().reader.stop}
          </button>
        {:else}
          <button
            type="button"
            class="btn seal small"
            disabled={!text.trim() && !photo}
            onclick={explain}
          >
            <Icon name="sparkle" size={18} />
            {t().explain.explain}
          </button>
        {/if}
      {/if}
    </div>
  </div>

  {#if !account.user && account.checked}
    <SignInPrompt seal="解" text={t().explain.signIn} />
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if view}
    {@const words = view.tokens.filter((t) => t.pinyin)}
    <article class="result" aria-busy={!view.done}>
      <div class="source sheet">
        <div class="source-line">
          {#if view.source}
            <HanziText text={view.source} class="source-zh" />
          {:else}
            <p class="waiting">{t().explain.readingPhoto}</p>
          {/if}
          {#if canSpeak && view.source}
            <button
              type="button"
              class="tool"
              aria-label={t().word.listen}
              onclick={() => view && speak(view.source)}
            >
              <Icon name="speaker" />
            </button>
          {/if}
        </div>
        {#if view.translation}
          <p class="translation">{view.translation}</p>
        {:else if busy}
          <p class="translation waiting">{t().explain.translating}</p>
        {/if}
      </div>

      {#if words.length || busy}
        <h3 class="section-title">
          {t().explain.wordByWord} <span class="zh" lang="zh-Hant-TW">逐詞</span>
        </h3>
      {/if}
      <ol class="tokens">
        {#each words as token, i (i)}
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
                    <Icon name="plus" size={14} />
                    {t().explain.deck}
                  </button>
                {:else}
                  <span class="have"><Icon name="check" size={14} /></span>
                {/if}
              {/if}
            </span>
          </li>
        {/each}
        {#if busy && !view.done}
          {#each [0, 1, 2] as i (i)}<li
              class="token sheet placeholder"
              aria-hidden="true"
            ></li>{/each}
        {/if}
      </ol>

      {#if view.grammar.length}
        <h3 class="section-title">
          {t().explain.grammar} <span class="zh" lang="zh-Hant-TW">語法</span>
        </h3>
        <ul class="list notes">
          {#each view.grammar as g, i (i)}
            <li class="row">
              <span class="row-main"
                ><strong lang="zh-Hant-TW" class="hanzi">{g.pattern}</strong>
                <span class="row-sub wrap">{g.explanation}</span></span
              >
            </li>
          {/each}
        </ul>
      {/if}
      {#if view.notes.length}
        <h3 class="section-title">
          {t().explain.notes} <span class="zh" lang="zh-Hant-TW">說明</span>
        </h3>
        <ul class="list notes">
          {#each view.notes as note, i (i)}<li class="row">{note}</li>{/each}
        </ul>
      {/if}
      {#if view.warnings.length}
        <p class="footnote">{t().explain.check(view.warnings.join(' · '))}</p>
      {/if}
      {#if view.done}
        <p class="footnote">{t().explain.footnote}</p>
      {/if}
    </article>
  {:else if text.trim() && !busy}
    <div class="sheet tap">
      <p class="hint">{t().dict.tapHint}</p>
      <HanziText text={text.trim()} class="tap-text" />
    </div>
  {/if}
</section>

<style>
  .input {
    padding: 12px;
  }

  /* The textarea has no outline of its own; the card shows where typing goes. */
  .input:focus-within {
    outline: 2px solid var(--sky);
    outline-offset: 2px;
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
    font-family: var(--font-display);
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
    animation: rise 300ms var(--ease) both;
  }

  .placeholder {
    min-height: 118px;
    background: linear-gradient(100deg, var(--fill) 30%, var(--paper-raised) 50%, var(--fill) 70%) 0
      0 / 300% 100%;
    animation: shimmer 1.4s linear infinite;
  }

  @keyframes shimmer {
    to {
      background-position: -150% 0;
    }
  }

  .waiting {
    margin: 0;
    color: var(--ink-3);
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
