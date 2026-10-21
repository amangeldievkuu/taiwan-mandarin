<script lang="ts">
  import {
    LEVELS,
    toToneMarkedSyllables,
    toZhuyin,
    type Reader,
    type ReaderToken,
  } from '@taiwan-mandarin/shared';
  import Icon from '../ui/Icon.svelte';
  import { content } from '../lib/content.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { router } from '../lib/router.svelte';
  import { canSpeak, speak, stopSpeaking } from '../lib/speech';
  import { store } from '../lib/store.svelte';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();
  let reader = $state<Reader | undefined>();
  let missing = $state(false);
  let ruby = $state(false);
  let showTranslation = $state<Record<number, boolean>>({});
  let playing = $state<number | null>(null);

  $effect(() => {
    content.readers().then((all) => {
      reader = all.find((r) => r.id === id);
      missing = !reader;
      if (reader) void content.ensureLevels([reader.level]);
    });
    return () => stopSpeaking();
  });

  const level = $derived(LEVELS.find((l) => l.id === reader?.level));

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
    void lookup.openWord(token.t, token.g);
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
  <button type="button" class="back" onclick={() => router.back('/read')}
    ><Icon name="back" size={18} /> Readers</button
  >

  {#if reader}
    <header class="head">
      <p class="eyebrow">
        {level?.en} · {level?.cefr}
        {#if reader.draft}· <span class="draft">Draft, not yet reviewed</span>{/if}
      </p>
      <h1 class="r-title hanzi" lang="zh-Hant-TW">{reader.title}</h1>
      <p class="r-sub">{reader.titleEn}</p>
      <div class="toolbar">
        <button type="button" class="chip" aria-pressed={ruby} onclick={() => (ruby = !ruby)}>
          <span lang="zh-Hant-TW" class="hanzi">注音</span> Readings
        </button>
        {#if canSpeak}
          <button
            type="button"
            class="chip"
            aria-pressed={playing !== null}
            onclick={() => play(0)}
          >
            <Icon name={playing !== null ? 'pause' : 'play'} size={16} />
            {playing !== null ? 'Stop' : 'Listen'}
          </button>
        {/if}
        <span class="legend">
          <span class="sample new"></span> new to you
          <span class="sample glossed">字</span> above this level
        </span>
      </div>
    </header>

    <article class="text" class:ruby lang="zh-Hant-TW">
      {#each reader.paragraphs as paragraph, i (i)}
        <div class="para" class:playing={playing === i}>
          <p>
            {#each paragraph as token, j (j)}{#if token.p}<button
                  type="button"
                  class="tok {tokenState(token)}"
                  class:glossed={!!token.g}
                  onclick={() => open(token)}
                  >{#if ruby}{#each annotations(token) as a, k (k)}<ruby
                        >{a.char}<rt>{a.rt}</rt></ruby
                      >{/each}{:else}{token.t}{/if}</button
                >{:else}{token.t}{/if}{/each}
          </p>
          <div class="para-tools" lang="en">
            <button
              type="button"
              class="mini"
              onclick={() => (showTranslation[i] = !showTranslation[i])}
            >
              {showTranslation[i] ? 'Hide' : 'English'}
            </button>
            {#if canSpeak}
              <button
                type="button"
                class="mini"
                aria-label="Listen to this paragraph"
                onclick={() => speak(paragraphText(paragraph), { rate: 0.8 })}
              >
                <Icon name="speaker" size={16} />
              </button>
            {/if}
          </div>
          {#if showTranslation[i]}<p class="translation" lang="en">{reader.translation[i]}</p>{/if}
        </div>
      {/each}
    </article>
  {:else if missing}
    <p class="empty">This reader doesn't exist.</p>
  {:else}
    <p class="empty">Loading…</p>
  {/if}
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    margin-left: -6px;
    padding: 6px;
    color: var(--ink-2);
    font-weight: 500;
  }

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
    font-family: var(--font-serif);
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
    width: 18px;
    height: 0;
    border-bottom: 2px dotted var(--seal);
  }

  .draft {
    color: var(--ochre);
  }

  .sample.glossed {
    width: auto;
    border: 0;
    font-family: var(--font-kai);
    color: var(--indigo);
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
    font: inherit;
    line-height: inherit;
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
    color: var(--indigo);
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

  .translation {
    margin: 6px 0 0 !important;
    text-indent: 0 !important;
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.55;
    color: var(--ink-2);
  }
</style>
