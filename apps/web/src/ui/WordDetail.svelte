<script lang="ts">
  import { LEVELS, TOPIC_BY_ID, type Word } from '@taiwan-mandarin/shared';
  import HanziText from './HanziText.svelte';
  import Icon from './Icon.svelte';
  import Reading from './Reading.svelte';
  import StrokeWriter from '../components/StrokeWriter.svelte';
  import TaiwanNote from '../components/TaiwanNote.svelte';
  import WordGlyphs, { fitSize } from '../components/WordGlyphs.svelte';
  import Speak from './Speak.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { formatInterval } from '../lib/srs';
  import { store } from '../lib/store.svelte';

  interface Props {
    word: Word;
    /** Inside a side panel: smaller glyphs. */
    compact?: boolean;
  }

  let { word, compact = false }: Props = $props();

  const level = $derived(LEVELS.find((l) => l.id === word.level));
  const topic = $derived(TOPIC_BY_ID.get(word.topic));
  const record = $derived(store.cards[word.id]);
  const inDeck = $derived(store.inDeck(word.id));
  const chars = $derived([...new Set([...word.hanzi].filter((c) => /\p{Script=Han}/u.test(c)))]);
  let strokeChar = $state<string | null>(null);
  const activeChar = $derived(strokeChar && chars.includes(strokeChar) ? strokeChar : chars[0]);
  const size = $derived(
    fitSize(
      [...word.hanzi].length,
      store.settings.phonetics,
      compact ? 88 : 116,
      compact ? '420px' : 'min(100vw - 2 * var(--gutter), 640px) - 24px',
    ),
  );
  const POS: Record<string, string> = {
    N: 'noun', V: 'verb', Vi: 'verb', Vs: 'stative verb', Vst: 'stative verb', Vp: 'process verb', Vpt: 'process verb',
    'V-sep': 'separable verb', 'Vs-sep': 'separable verb', 'Vp-sep': 'separable verb', Vaux: 'auxiliary',
    Adv: 'adverb', Conj: 'conjunction', Prep: 'preposition', Ptc: 'particle', M: 'measure word', Det: 'determiner',
    'Vs-attr': 'attributive', 'Vs-pred': 'predicative',
  }; // prettier-ignore
  const posLabel = $derived(
    word.pos
      ? [...new Set(word.pos.split('/').map((p) => POS[p.trim()] ?? p.trim()))].join(', ')
      : undefined,
  );

  function due(): string {
    if (!record) return '';
    const ms = record.card.due.getTime() - Date.now();
    return ms <= 0 ? 'due now' : `next review in ${formatInterval(ms)}`;
  }
</script>

<article class="detail" class:compact>
  <header class="hero">
    <div class="glyphs">
      <WordGlyphs {word} {size} phonetics={store.settings.phonetics} />
    </div>
    {#if canSpeak}
      <button type="button" class="speak" aria-label="Listen" onclick={() => speak(word.hanzi)}>
        <Icon name="speaker" size={22} />
      </button>
    {/if}
  </header>

  <div class="tags">
    {#if level}<span class="level-tag">{level.en} · {level.cefr}</span>{/if}
    {#if posLabel}<span class="tag">{posLabel}</span>{/if}
    {#if topic && topic.id !== 'core'}<span class="tag">{topic.en}</span>{/if}
    {#if word.src === 'tbcl'}<span class="tag" title="Listed by the NAER 《臺灣華語文能力基準》"
        >NAER list</span
      >{/if}
  </div>

  <p class="meaning">{word.en || '—'}</p>
  {#if word.cl}<p class="cl">Measure word <HanziText text={word.cl} /></p>{/if}
  {#if word.variants?.length}
    <p class="cl">Also written <HanziText text={word.variants.join('、')} /></p>
  {/if}
  {#if word.readingUnverified}<p class="cl warn">
      Reading not yet checked against the MOE dictionary.
    </p>{/if}
  <TaiwanNote {word} />

  <div class="status">
    {#if record}
      <span class="state"><Icon name="check" size={16} /> Studying · {due()}</span>
      <button
        type="button"
        class="btn quiet small"
        onclick={() => store.setSuspended(word.id, !record.suspended)}
      >
        {record.suspended ? 'Resume' : 'Suspend'}
      </button>
    {:else if inDeck}
      <span class="state"><Icon name="check" size={16} /> In your deck</span>
      <button type="button" class="btn quiet small" onclick={() => store.removeFromDeck(word.id)}
        >Remove</button
      >
    {:else}
      <button type="button" class="btn seal small" onclick={() => store.addToDeck(word)}>
        <Icon name="plus" size={16} /> Add to my deck
      </button>
    {/if}
  </div>

  {#if word.examples?.length}
    <h3 class="section-title">Examples <span class="zh" lang="zh-Hant-TW">例句</span></h3>
    <ul class="examples">
      {#each word.examples as example, i (i)}
        <li>
          <div class="ex-line">
            <HanziText text={example.zh} class="ex-zh" />
            {#if canSpeak}
              <button
                type="button"
                class="mini"
                aria-label="Listen to the sentence"
                onclick={() => speak(example.zh)}
              >
                <Icon name="speaker" size={18} />
              </button>
            {/if}
          </div>
          <Reading pinyin={example.pinyin} text={example.zh} wordLengths={example.wordLengths} />
          <p class="ex-en">{example.en}</p>
          <p class="ex-src">
            {#if example.source === 'tatoeba' && example.ref}
              <a
                href="https://tatoeba.org/sentences/show/{example.ref}"
                target="_blank"
                rel="noopener">Tatoeba #{example.ref}</a
              >
            {:else if example.source === 'ai'}Written for this app{/if}
          </p>
        </li>
      {/each}
    </ul>
  {/if}

  <h3 class="section-title">Say it <span class="zh" lang="zh-Hant-TW">發音</span></h3>
  <Speak target={word.hanzi} pinyin={word.pinyin} />

  <h3 class="section-title">Characters <span class="zh" lang="zh-Hant-TW">字</span></h3>
  <div class="chars">
    {#each chars as char (char)}
      <button
        type="button"
        class="char hanzi"
        class:on={char === activeChar}
        lang="zh-Hant-TW"
        onclick={() => {
          strokeChar = char;
          void lookup.openWord(char);
        }}>{char}</button
      >
    {/each}
  </div>
  {#if activeChar}
    {#key activeChar}
      <StrokeWriter char={activeChar} />
    {/key}
  {/if}
</article>

<style>
  .detail {
    display: flex;
    flex-direction: column;
  }

  .hero {
    position: relative;
    display: flex;
    justify-content: center;
    padding: 18px 0 10px;
  }

  .speak {
    position: absolute;
    top: 8px;
    right: 0;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--seal-wash);
    color: var(--seal);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin-top: 6px;
  }

  .tag {
    font-size: 12px;
    color: var(--ink-2);
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--fill);
  }

  .meaning {
    margin: 14px 0 0;
    font-family: var(--font-display);
    font-size: 22px;
    line-height: 1.4;
    text-align: center;
  }

  .compact .meaning {
    font-size: 19px;
  }

  .cl {
    margin: 6px 0 0;
    text-align: center;
    font-size: 14px;
    color: var(--ink-2);
  }

  .cl :global(.hanzi-text) {
    font-size: 18px;
    color: var(--ink);
  }

  .warn {
    color: var(--ochre);
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 18px;
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
    color: var(--jade);
  }

  .examples {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .examples li {
    padding-left: 14px;
    border-left: 2px solid var(--rule-strong);
  }

  .ex-line {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .ex-line :global(.ex-zh) {
    font-size: 21px;
    line-height: 1.5;
  }

  .examples :global(.reading) {
    font-size: 14px;
  }

  .ex-en {
    margin: 2px 0 0;
    color: var(--ink-2);
  }

  .ex-src {
    margin: 2px 0 0;
    font-size: 11px;
    color: var(--ink-3);
  }

  .ex-src a {
    color: inherit;
  }

  .mini {
    display: grid;
    place-items: center;
    flex: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--ink-2);
  }

  .mini:hover {
    background: var(--fill);
  }

  .chars {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .char {
    display: grid;
    place-items: center;
    width: 56px;
    height: 56px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    font-size: 30px;
    background: var(--paper-raised);
  }

  .char.on {
    border-color: var(--seal);
    color: var(--seal);
  }
</style>
