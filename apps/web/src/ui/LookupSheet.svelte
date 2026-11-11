<script lang="ts">
  // Dictionary entry for the tapped word: bottom sheet on phones, floating panel on wider screens.
  import { isLevel, type DictEntry } from '@taiwan-mandarin/shared';
  import { MediaQuery } from 'svelte/reactivity';
  import HanViet from './HanViet.svelte';
  import Icon from './Icon.svelte';
  import Localized from './Localized.svelte';
  import Reading from './Reading.svelte';
  import Skeleton from './Skeleton.svelte';
  import { content } from '../lib/content.svelte';
  import { definitionsOf, type Localized as Text } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { router } from '../lib/router.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { store } from '../lib/store.svelte';
  import { fade, sheet } from '../lib/transitions';

  /** A floating panel beside the text; on phones a bottom sheet over it. */
  const wide = new MediaQuery('min-width: 700px');

  /** Entries grouped by reading, so 和 hé / huò show as separate blocks. */
  const groups = $derived.by(() => {
    const byReading: Record<string, DictEntry[]> = {};
    for (const e of lookup.entries) (byReading[e.p] ??= []).push(e);
    return Object.values(byReading).flatMap((list) => {
      const [head] = list;
      return head ? [{ head, list }] : [];
    });
  });

  const levelLabel = (id: string) => (isLevel(id) ? t().levels[id] : id);

  /** The first definitions of a reading's entries, each in its own language. */
  const definitions = (list: DictEntry[]): Text[] =>
    list
      .flatMap((e) => {
        const { list: defs, lang } = definitionsOf(e);
        return defs.map((text) => ({ text, lang }));
      })
      .slice(0, 8);

  function status(wordId: string | undefined): 'studying' | 'deck' | 'new' | null {
    if (!wordId) return null;
    if (store.cards[wordId]) return 'studying';
    if (store.inDeck(wordId)) return 'deck';
    return 'new';
  }

  async function add(entry: DictEntry) {
    if (!entry.w || !entry.l) return;
    store.addToDeck({ id: entry.w, level: entry.l });
    void content.ensureLevels([entry.l]);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && lookup.open) lookup.close();
  }

  // A dialog for keyboards and screen readers: focus moves in when it opens and goes back to
  // where it was when it closes. On phones it covers the page, so Tab stays inside it.
  let panel = $state<HTMLElement>();
  $effect(() => {
    if (!lookup.open || !panel) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.focus({ preventScroll: true });
    return () => {
      if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    };
  });

  function trapTab(e: KeyboardEvent) {
    if (e.key !== 'Tab' || wide.current || !panel) return;
    const focusable = [
      ...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
    ];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    const at = document.activeElement;
    if (e.shiftKey && (at === first || at === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && at === last) {
      e.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if lookup.open}
  <button
    class="scrim"
    type="button"
    aria-label={t().common.close}
    onclick={() => lookup.close()}
    transition:fade
  ></button>
  <div
    bind:this={panel}
    class="panel sheet"
    role="dialog"
    aria-modal={wide.current ? undefined : 'true'}
    aria-labelledby="lookup-word"
    aria-busy={lookup.loading}
    tabindex="-1"
    onkeydown={trapTab}
    in:sheet={{ wide: wide.current }}
    out:sheet={{ wide: wide.current }}
  >
    <div class="grip" aria-hidden="true"></div>
    <header>
      <span id="lookup-word" class="word hanzi" lang="zh-Hant-TW">{lookup.word}</span>
      <div class="tools">
        {#if canSpeak}
          <button
            type="button"
            class="tool"
            aria-label={t().word.listen}
            onclick={() => speak(lookup.word)}
          >
            <Icon name="speaker" />
          </button>
        {/if}
        <button
          type="button"
          class="tool"
          aria-label={t().common.close}
          onclick={() => lookup.close()}
        >
          <Icon name="close" />
        </button>
      </div>
    </header>

    {#if lookup.note}
      <p class="note">{lookup.note}</p>
    {/if}

    {#if lookup.loading}
      <div class="loading" aria-label={t().lookup.lookingUp}>
        <Skeleton width="40%" height="20px" />
        <Skeleton lines={3} height="14px" />
      </div>
    {:else if groups.length === 0}
      <p class="muted">{t().lookup.notFound}</p>
    {:else}
      <div class="entries">
        {#each groups as { head, list }, i (i)}
          {@const st = status(head.w)}
          <section class="entry">
            <div class="entry-head">
              <Reading pinyin={head.p} />
              {#if head.l}<span class="level-tag" title={t().lookup.tocfl}
                  >{levelLabel(head.l)}</span
                >{/if}
            </div>
            <HanViet reading={head.h} />
            <ol>
              {#each definitions(list) as def, j (j)}
                <li><Localized value={def} /></li>
              {/each}
            </ol>
            {#if head.c}<p class="cl">
                {t().word.measureWord} <span lang="zh-Hant-TW" class="hanzi">{head.c}</span>
              </p>{/if}
            {#if head.w}
              <div class="actions">
                {#if st === 'new'}
                  <button type="button" class="btn seal small" onclick={() => add(head)}>
                    <Icon name="plus" size={16} />
                    {t().word.add}
                  </button>
                {:else if st === 'deck'}
                  <span class="state"><Icon name="check" size={16} /> {t().word.inDeck}</span>
                {:else}
                  <span class="state"><Icon name="check" size={16} /> {t().word.studying}</span>
                {/if}
                <a
                  class="btn quiet small"
                  href={router.href(`/word/${encodeURIComponent(head.w)}`)}
                  onclick={(e) => {
                    lookup.close();
                    router.link(e);
                  }}>{t().lookup.details}</a
                >
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--scrim);
  }

  .panel {
    position: fixed;
    z-index: 41;
    outline: none;
    inset: auto 0 0;
    max-height: min(72dvh, 620px);
    overflow-y: auto;
    padding: var(--sp-2) var(--sp-5) calc(var(--safe-bottom) + var(--sp-5));
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    overscroll-behavior: contain;
  }

  .grip {
    width: 40px;
    height: 5px;
    margin: 0 auto var(--sp-2);
    border-radius: 3px;
    background: var(--rule-strong);
  }

  @media (min-width: 700px) {
    /* A floating panel: the text behind stays tappable, so the next word replaces this one. */
    .scrim {
      display: none;
    }

    .panel {
      inset: 20px 20px auto auto;
      width: 380px;
      max-height: calc(100dvh - 40px);
      border-radius: var(--radius-lg);
      padding: var(--sp-5) var(--sp-6) var(--sp-6);
      box-shadow: var(--shadow-3);
    }

    .grip {
      display: none;
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
  }

  .word {
    font-size: 44px;
    line-height: 1.2;
  }

  .tools {
    display: flex;
    gap: var(--sp-1);
  }

  .tool {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    color: var(--ink-2);
  }

  .tool:hover {
    background: var(--fill);
    color: var(--ink);
  }

  .note {
    margin: var(--sp-1) 0 0;
    padding: var(--sp-2) var(--sp-3);
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    font-size: var(--fs-md);
  }

  .muted {
    color: var(--ink-2);
  }

  .entry {
    padding: var(--sp-4) 0;
  }

  .entry + .entry {
    border-top: 1px solid var(--rule);
  }

  .entry-head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--fs-lg);
  }

  ol {
    margin: var(--sp-2) 0 0;
    padding-left: var(--sp-6);
    font-size: var(--fs-base);
    line-height: 1.45;
  }

  li::marker {
    color: var(--ink-3);
    font-size: var(--fs-sm);
  }

  .cl {
    margin: var(--sp-2) 0 0;
    font-size: var(--fs-md);
    color: var(--ink-2);
  }

  .cl .hanzi {
    color: var(--ink);
    font-size: var(--fs-lg);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--sp-2);
    margin-top: var(--sp-4);
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: var(--sp-1);
    font-size: var(--fs-md);
    font-weight: var(--fw-label);
    color: var(--jade);
  }

  .loading {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    padding: var(--sp-4) 0;
  }
</style>
