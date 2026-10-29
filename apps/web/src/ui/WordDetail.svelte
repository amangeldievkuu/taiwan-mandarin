<script lang="ts">
  import { LEVELS, type Word } from '@taiwan-mandarin/shared';
  import HanziText from './HanziText.svelte';
  import Icon from './Icon.svelte';
  import Reading from './Reading.svelte';
  import StrokeWriter from '../components/StrokeWriter.svelte';
  import TaiwanNote from '../components/TaiwanNote.svelte';
  import WordGlyphs, { fitSize } from '../components/WordGlyphs.svelte';
  import HanViet from './HanViet.svelte';
  import Localized from './Localized.svelte';
  import Speak from './Speak.svelte';
  import { glossOf, translationOf } from '../lib/i18n/content';
  import { lookup } from '../lib/lookup.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { formatInterval, t } from '../lib/i18n/index.svelte';
  import { store } from '../lib/store.svelte';

  interface Props {
    word: Word;
    /** Inside a side panel: smaller glyphs. */
    compact?: boolean;
  }

  let { word, compact = false }: Props = $props();

  const level = $derived(LEVELS.find((l) => l.id === word.level));
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
  type Pos = keyof ReturnType<typeof t>['word']['pos'];
  const POS: Record<string, Pos> = {
    N: 'noun', V: 'verb', Vi: 'verb', Vs: 'stative', Vst: 'stative', Vp: 'process', Vpt: 'process',
    'V-sep': 'separable', 'Vs-sep': 'separable', 'Vp-sep': 'separable', Vaux: 'auxiliary',
    Adv: 'adverb', Conj: 'conjunction', Prep: 'preposition', Ptc: 'particle', M: 'measure', Det: 'determiner',
    'Vs-attr': 'attributive', 'Vs-pred': 'predicative',
  }; // prettier-ignore
  const posLabel = $derived.by(() => {
    if (!word.pos) return undefined;
    const names = t().word.pos;
    const labels = word.pos.split('/').map((p) => {
      const tag = POS[p.trim()];
      return tag ? names[tag] : p.trim();
    });
    return [...new Set(labels)].join(', ');
  });

  function due(): string {
    if (!record) return '';
    const ms = record.card.due.getTime() - Date.now();
    return ms <= 0 ? t().word.dueNow : t().word.nextReview(formatInterval(ms));
  }
</script>

<article class="detail" class:compact>
  <header class="hero">
    <div class="glyphs">
      <WordGlyphs {word} {size} phonetics={store.settings.phonetics} />
    </div>
    {#if canSpeak}
      <button
        type="button"
        class="speak"
        aria-label={t().word.listen}
        onclick={() => speak(word.hanzi)}
      >
        <Icon name="speaker" size={22} />
      </button>
    {/if}
  </header>

  <div class="tags">
    {#if level}<span class="level-tag">{t().levels[level.id]} · {level.cefr}</span>{/if}
    {#if posLabel}<span class="tag">{posLabel}</span>{/if}
    {#if word.topic !== 'core'}<span class="tag">{t().topics[word.topic]}</span>{/if}
    {#if word.src === 'tbcl'}<span class="tag" title={t().word.naerTitle}>{t().word.naerList}</span
      >{/if}
  </div>

  <p class="meaning">
    {#if word.en}<Localized value={glossOf(word)} />{:else}—{/if}
  </p>
  <HanViet reading={word.hv} />
  {#if word.cl}<p class="cl">{t().word.measureWord} <HanziText text={word.cl} /></p>{/if}
  {#if word.variants?.length}
    <p class="cl">{t().word.alsoWritten} <HanziText text={word.variants.join('、')} /></p>
  {/if}
  {#if word.readingUnverified}<p class="cl warn">{t().word.unverified}</p>{/if}
  <TaiwanNote {word} />

  <div class="status">
    {#if record}
      <span class="state"><Icon name="check" size={16} /> {t().word.studying} · {due()}</span>
      <button
        type="button"
        class="btn quiet small"
        onclick={() => store.setSuspended(word.id, !record.suspended)}
      >
        {record.suspended ? t().word.resume : t().word.suspend}
      </button>
    {:else if inDeck}
      <span class="state"><Icon name="check" size={16} /> {t().word.inDeck}</span>
      <button type="button" class="btn quiet small" onclick={() => store.removeFromDeck(word.id)}
        >{t().word.remove}</button
      >
    {:else}
      <button type="button" class="btn seal small" onclick={() => store.addToDeck(word)}>
        <Icon name="plus" size={16} />
        {t().word.add}
      </button>
    {/if}
  </div>

  {#if word.examples?.length}
    <h3 class="section-title">
      {t().word.examples} <span class="zh" lang="zh-Hant-TW">例句</span>
    </h3>
    <ul class="examples">
      {#each word.examples as example, i (i)}
        <li>
          <div class="ex-line">
            <HanziText text={example.zh} class="ex-zh" />
            {#if canSpeak}
              <button
                type="button"
                class="mini"
                aria-label={t().word.listenSentence}
                onclick={() => speak(example.zh)}
              >
                <Icon name="speaker" size={18} />
              </button>
            {/if}
          </div>
          <Reading pinyin={example.pinyin} text={example.zh} wordLengths={example.wordLengths} />
          <p class="ex-en"><Localized value={translationOf(example)} /></p>
          <p class="ex-src">
            {#if example.source === 'tatoeba' && example.ref}
              <a
                href="https://tatoeba.org/sentences/show/{example.ref}"
                target="_blank"
                rel="noopener">Tatoeba #{example.ref}</a
              >
            {:else if example.source === 'ai'}{t().word.writtenForApp}{/if}
          </p>
        </li>
      {/each}
    </ul>
  {/if}

  <h3 class="section-title">{t().word.sayIt} <span class="zh" lang="zh-Hant-TW">發音</span></h3>
  <Speak target={word.hanzi} pinyin={word.pinyin} />

  <h3 class="section-title">
    {t().word.characters} <span class="zh" lang="zh-Hant-TW">字</span>
  </h3>
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
