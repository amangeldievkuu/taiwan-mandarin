<script lang="ts">
  // Tour scene 3, Read: a short text with the new words marked; a tap on one opens it in the
  // dictionary sheet, and it goes into the deck.
  import { t } from '../../lib/i18n/index.svelte';
  import { reached, type Frame } from '../../lib/tour';
  import Icon from '../Icon.svelte';
  import Seal from '../Seal.svelte';
  import TapDot from './TapDot.svelte';

  let { frame }: { frame: Frame } = $props();
  const on = (beat: string) => reached(frame, beat);

  /** The text, by word: new words are marked, 喝茶 is the one tapped. */
  const LINES: { zh: string; new?: boolean }[][] = [
    [{ zh: '我' }, { zh: '喜歡', new: true }, { zh: '喝茶', new: true }, { zh: '。' }],
    [
      { zh: '週末', new: true },
      { zh: '我' },
      { zh: '常常', new: true },
      { zh: '去' },
      { zh: '夜市', new: true },
      { zh: '。' },
    ],
    [
      { zh: '夜市' },
      { zh: '的' },
      { zh: '東西' },
      { zh: '很' },
      { zh: '好吃', new: true },
      { zh: '！' },
    ],
  ];
  const open = $derived(on('sheet'));
  const added = $derived(on('added'));
</script>

<div class="scene">
  <span class="back"><Icon name="back" size={14} /> {t().titles.read}</span>
  <div class="head">
    <Seal text="準一" size={30} outline />
    <div>
      <h3 class="hanzi" lang="zh-Hant-TW">我的週末</h3>
      <small>{t().tour.mock.readerTitle}</small>
    </div>
  </div>

  <div class="text hanzi" lang="zh-Hant-TW">
    {#each LINES as line, l (l)}
      <p>
        {#each line as word, w (w)}<span
            class:new={word.new && !(word.zh === '喝茶' && added)}
            class:studying={word.zh === '喝茶' && added}
            class:hit={word.zh === '喝茶' && on('tap')}>{word.zh}</span
          >{/each}
      </p>
    {/each}
  </div>

  <div class="sheet lookup" class:open>
    <span class="grip"></span>
    <div class="entry">
      <span class="hanzi big" lang="zh-Hant-TW">喝茶</span>
      <span class="reading">
        <span class="zhuyin" lang="zh-Hant-TW">ㄏㄜ ㄔㄚˊ</span>
        <span class="pinyin">hē chá</span>
      </span>
    </div>
    <strong class="meaning">{t().tour.mock.drinkTea}</strong>
    <span class="btn add" class:primary={!added} class:pressed={on('tapAdd') && !added}>
      <Icon name={added ? 'check' : 'plus'} size={16} />
      {added ? t().word.inDeck : t().word.add}
    </span>
  </div>

  <TapDot
    x={on('sheet') ? 50 : 68}
    y={on('sheet') ? 89 : 41}
    show={on('point') && !added}
    tapping={(on('tap') && !on('sheet')) || (on('tapAdd') && !added)}
  />
</div>

<style>
  .scene {
    position: relative;
    height: 100%;
    padding: var(--sp-4) var(--sp-4) 0;
    overflow: hidden;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    font-size: var(--fs-sm);
    font-weight: var(--fw-heading);
    color: var(--jade-text);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: var(--sp-3) 0 var(--sp-2);
  }

  .head h3 {
    margin: 0;
    font-size: var(--fs-2xl);
    line-height: 1.15;
  }

  .head small {
    font-size: var(--fs-xs);
    color: var(--ink-2);
  }

  .text p {
    margin: 0 0 6px;
    font-size: 21px;
    line-height: 2;
    text-indent: 2em;
  }

  .text span {
    border-radius: 4px;
    transition:
      background-color var(--dur-2) var(--ease-out),
      color var(--dur-2) var(--ease-out);
  }

  .new {
    text-decoration: underline dotted color-mix(in oklab, var(--seal) 55%, transparent);
    text-decoration-thickness: 2px;
    text-underline-offset: 5px;
  }

  .studying {
    color: var(--jade-text);
  }

  .hit {
    background: var(--sky-wash);
  }

  .lookup {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: 10px var(--sp-4) var(--sp-4);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-3);
    transform: translateY(115%);
    transition: transform var(--dur-4) var(--ease-spring-soft);
  }

  .lookup.open {
    transform: none;
  }

  .grip {
    align-self: center;
    width: 36px;
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--rule-strong);
  }

  .entry {
    display: flex;
    align-items: baseline;
    gap: var(--sp-3);
  }

  .big {
    font-size: 40px;
    line-height: 1.1;
  }

  .reading {
    display: flex;
    flex-direction: column;
    line-height: 1.3;
  }

  .zhuyin {
    font-family: var(--font-kai);
    font-size: var(--fs-base);
    color: var(--ink-2);
  }

  .pinyin {
    font-size: var(--fs-xs);
    color: var(--ink-3);
  }

  .meaning {
    font-size: var(--fs-lg);
    font-weight: var(--fw-heading);
  }

  .add {
    min-height: 42px;
    font-size: var(--fs-md);
  }

  .add:not(.primary) {
    background: var(--jade-wash);
    color: var(--jade-text);
    box-shadow: none;
  }
</style>
