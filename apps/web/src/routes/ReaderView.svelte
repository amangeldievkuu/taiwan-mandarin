<script lang="ts">
  import InkDrop from '../ui/InkDrop.svelte';
  import { untrack } from 'svelte';
  import BackButton from '../ui/BackButton.svelte';
  import Loading from '../ui/Loading.svelte';
  import {
    LEVELS,
    XP,
    toToneMarkedSyllables,
    toZhuyin,
    type Reader,
    type ReaderToken,
  } from '@taiwan-mandarin/shared';
  import Icon from '../ui/Icon.svelte';
  import Localized from '../ui/Localized.svelte';
  import { content } from '../lib/content.svelte';
  import { readerTitleOf, readerTranslationOf, tokenGlossOf } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { canSpeak, speak, stopSpeaking } from '../lib/speech';
  import { store } from '../lib/store.svelte';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();
  let reader = $state<Reader | undefined>();
  let missing = $state(false);
  let failed = $state(false);
  let ruby = $state(false);
  let showTranslation = $state<Record<number, boolean>>({});
  let playing = $state<number | null>(null);
  /** The end of the story, watched to count it as read. */
  let end = $state<HTMLElement>();
  /** Read to the end: null before, then whether it earned ink (once a day per story). */
  let finished = $state<{ earned: boolean } | null>(null);
  let openedAt = 0;

  $effect(() => {
    finished = null;
    openedAt = Date.now();
    content
      .readers()
      .then((all) => {
        reader = all.find((r) => r.id === id);
        missing = !reader;
        if (reader) void content.ensureLevels([reader.level]);
      })
      .catch(() => (failed = true));
    return () => stopSpeaking();
  });

  const level = $derived(LEVELS.find((l) => l.id === reader?.level));

  /** Scrolling straight to the bottom isn't reading: the end counts after this long on the page. */
  const readingTime = (r: Reader) =>
    Math.max(15_000, r.paragraphs.flat().reduce((n, t) => n + t.t.length, 0) * 100);

  // Reaching the end of the story, after time enough to read it, counts it for ink.
  $effect(() => {
    const target = end;
    const story = reader;
    if (!target || !story || untrack(() => finished)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const count = () => {
      observer.disconnect();
      void store.practiced('read', story.id).then((earned) => (finished = { earned }));
    };
    const observer = new IntersectionObserver(([entry]) => {
      clearTimeout(timer);
      if (!entry?.isIntersecting) return;
      timer = setTimeout(count, Math.max(0, openedAt + readingTime(story) - Date.now()));
    });
    observer.observe(target);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  });

  /** Per-character readings for ruby text. */
  function annotations(token: ReaderToken): { char: string; rt: string }[] {
    const chars = [...token.t];
    if (!token.p) return chars.map((char) => ({ char, rt: '' }));
    try {
      const zhuyin = toZhuyin(token.p);
      const pinyin = toToneMarkedSyllables(token.p);
      return chars.map((char, i) => {
        const z = zhuyin[i];
        const zy = z ? (z.tone === '˙' ? `˙${z.body}` : z.body + z.tone) : '';
        return { char, rt: store.settings.phonetics === 'pinyin' ? (pinyin[i] ?? '') : zy };
      });
    } catch {
      return chars.map((char) => ({ char, rt: '' }));
    }
  }

  function tokenState(token: ReaderToken): 'known' | 'deck' | 'new' | 'plain' {
    if (!token.w) return 'plain';
    if (store.cards[token.w]) return 'known';
    if (store.inDeck(token.w)) return 'deck';
    return 'new';
  }

  function open(token: ReaderToken) {
    void lookup.openWord(token.t, tokenGlossOf(token)?.text);
  }

  const paragraphText = (p: ReaderToken[]) => p.map((t) => t.t).join('');

  async function play(index: number) {
    if (!reader) return;
    if (playing !== null) {
      stopSpeaking();
      playing = null;
      return;
    }
    for (let i = index; i < reader.paragraphs.length; i++) {
      playing = i;
      const finished = await speak(paragraphText(reader.paragraphs[i] ?? []), { rate: 0.8 });
      if (!finished || playing !== i) break;
    }
    playing = null;
  }
</script>

<div class="page">
  <BackButton parent="/read" />

  {#if reader}
    <header class="head">
      <p class="eyebrow">
        {level ? t().levels[level.id] : ''} · {level?.cefr}
        {#if reader.draft}· <span class="draft">{t().reader.draft}</span>{/if}
      </p>
      <h1 class="r-title hanzi" lang="zh-Hant-TW">{reader.title}</h1>
      <p class="r-sub"><Localized value={readerTitleOf(reader)} /></p>
      <div class="toolbar">
        <button type="button" class="chip" aria-pressed={ruby} onclick={() => (ruby = !ruby)}>
          <span lang="zh-Hant-TW" class="hanzi">注音</span>
          {t().reader.readings}
        </button>
        {#if canSpeak}
          <button
            type="button"
            class="chip"
            aria-pressed={playing !== null}
            onclick={() => play(0)}
          >
            <Icon name={playing !== null ? 'pause' : 'play'} size={16} />
            {playing !== null ? t().reader.stop : t().word.listen}
          </button>
        {/if}
        <span class="legend">
          <span class="sample new"></span>
          {t().reader.newToYou}
          <span class="sample glossed">字</span>
          {t().reader.aboveLevel}
        </span>
      </div>
    </header>

    <article class="text" class:ruby lang="zh-Hant-TW">
      {#each reader.paragraphs as paragraph, i (i)}
        <div class="para" class:playing={playing === i}>
          <p>
            <!-- Inline spans (not buttons) so CJK line breaking keeps punctuation with its word. -->
            {#each paragraph as token, j (j)}{#if token.p}<span
                  role="button"
                  tabindex="0"
                  class="tok {tokenState(token)}"
                  class:glossed={!!token.g}
                  onclick={() => open(token)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      open(token);
                    }
                  }}
                  >{#if ruby}{#each annotations(token) as a, k (k)}<ruby
                        >{a.char}<rt>{a.rt}</rt></ruby
                      >{/each}{:else}{token.t}{/if}</span
                >{:else}{token.t}{/if}{/each}
          </p>
          <div class="para-tools">
            <button
              type="button"
              class="mini"
              onclick={() => (showTranslation[i] = !showTranslation[i])}
            >
              {showTranslation[i] ? t().auth.hide : t().reader.translation}
            </button>
            {#if canSpeak}
              <button
                type="button"
                class="mini"
                aria-label={t().reader.listenParagraph}
                onclick={() => speak(paragraphText(paragraph), { rate: 0.8 })}
              >
                <Icon name="speaker" size={16} />
              </button>
            {/if}
          </div>
          {#if showTranslation[i]}<p class="translation">
              <Localized value={readerTranslationOf(reader, i)} />
            </p>{/if}
        </div>
      {/each}
    </article>
    <p class="end" bind:this={end} aria-live="polite">
      {#if finished}
        <span class="hanzi" lang="zh-Hant-TW">讀完了</span>
        <span class="sub">{t().reader.finished}</span>
        {#if finished.earned}<span class="xp"><InkDrop size={12} /> +{XP.read} {t().ink}</span>{/if}
      {/if}
    </p>
  {:else if missing}
    <p class="empty">{t().reader.missing}</p>
  {:else if failed}
    <p class="empty" role="alert">{t().level.loadFailed}</p>
  {:else}
    <Loading />
  {/if}
</div>

<style>
  .head {
    margin: 10px 0 24px;
  }

  .r-title {
    margin: 4px 0 0;
    font-size: clamp(36px, 6vw, 52px);
    font-weight: 400;
    line-height: 1.15;
  }

  .r-sub {
    margin: 4px 0 0;
    font-family: var(--font-display);
    font-size: 19px;
    color: var(--ink-2);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
  }

  .legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    font-size: 13px;
    color: var(--ink-2);
  }

  .sample {
    display: inline-block;
    width: 18px;
    height: 0;
    border-bottom: 2px dotted var(--seal);
  }

  .draft {
    color: var(--ochre);
  }

  .sample.glossed {
    width: auto;
    height: auto;
    margin-left: 10px;
    border: 0;
    font-family: var(--font-kai);
    font-size: 16px;
    line-height: 1;
    color: var(--sky-text);
  }

  .text {
    font-family: var(--font-hanzi);
    font-size: clamp(22px, 2.6vw, 27px);
    line-height: 2;
  }

  .text.ruby {
    line-height: 2.5;
  }

  .para {
    position: relative;
    margin: 0 0 22px;
    padding-left: 14px;
    border-left: 2px solid transparent;
    transition: border-color var(--dur) var(--ease);
  }

  .para.playing {
    border-color: var(--seal);
  }

  .para p {
    margin: 0;
    text-indent: 2em;
  }

  .tok {
    cursor: pointer;
    border-radius: 3px;
    transition: background-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .tok:hover {
      background: var(--fill);
    }
  }

  .tok.new {
    text-decoration: underline dotted var(--seal);
    text-decoration-thickness: 2px;
    text-underline-offset: 0.28em;
  }

  .tok.deck {
    text-decoration: underline solid color-mix(in srgb, var(--seal) 45%, transparent);
    text-decoration-thickness: 2px;
    text-underline-offset: 0.28em;
  }

  .tok.glossed {
    color: var(--sky-text);
  }

  rt {
    font-family: var(--font-kai);
    font-size: 0.42em;
    color: var(--ink-2);
    letter-spacing: 0;
  }

  .para-tools {
    display: flex;
    gap: 4px;
    margin-top: 2px;
    font-family: var(--font-ui);
    opacity: 0.75;
  }

  .mini {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }

  .mini:hover {
    background: var(--fill);
  }

  .end {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 10px;
    min-height: 32px;
    margin: 8px 0 24px;
  }

  .end .hanzi {
    font-family: var(--font-kai);
    font-size: 20px;
    color: var(--ink);
  }

  .end .sub {
    font-size: 14px;
    color: var(--ink-2);
  }

  .end .xp {
    padding: 4px 10px;
    border-radius: var(--radius-pill);
    background: var(--gold-wash);
    color: var(--gold-deep);
    font-size: 13px;
    font-weight: 800;
  }

  .translation {
    margin: 6px 0 0 !important;
    text-indent: 0 !important;
    font-family: var(--font-display);
    font-size: 17px;
    line-height: 1.55;
    color: var(--ink-2);
  }
</style>
