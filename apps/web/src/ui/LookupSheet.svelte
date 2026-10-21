<script lang="ts">
  // Dictionary entry for the tapped word: bottom sheet on phones, floating panel on wider screens.
  import { LEVELS, type DictEntry } from '@taiwan-mandarin/shared';
  import Icon from './Icon.svelte';
  import Reading from './Reading.svelte';
  import { content } from '../lib/content.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { router } from '../lib/router.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { store } from '../lib/store.svelte';

  /** Entries grouped by reading, so 和 hé / huò show as separate blocks. */
  const groups = $derived.by(() => {
    const byReading: Record<string, DictEntry[]> = {};
    for (const e of lookup.entries) (byReading[e.p] ??= []).push(e);
    return Object.values(byReading).flatMap((list) => {
      const [head] = list;
      return head ? [{ head, list }] : [];
    });
  });

  const levelLabel = (id: string) => LEVELS.find((l) => l.id === id)?.en ?? id;

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
</script>

<svelte:window onkeydown={onKey} />

{#if lookup.open}
  <button class="scrim" type="button" aria-label="Close" onclick={() => lookup.close()}></button>
  <aside class="panel sheet" aria-label="Dictionary" aria-live="polite">
    <div class="grip" aria-hidden="true"></div>
    <header>
      <span class="word hanzi" lang="zh-Hant-TW">{lookup.word}</span>
      <div class="tools">
        {#if canSpeak}
          <button type="button" class="tool" aria-label="Listen" onclick={() => speak(lookup.word)}>
            <Icon name="speaker" />
          </button>
        {/if}
        <button type="button" class="tool" aria-label="Close" onclick={() => lookup.close()}>
          <Icon name="close" />
        </button>
      </div>
    </header>

    {#if lookup.note}
      <p class="note">{lookup.note}</p>
    {/if}

    {#if lookup.loading}
      <p class="muted">Looking up…</p>
    {:else if groups.length === 0}
      <p class="muted">Not in the dictionary.</p>
    {:else}
      <div class="entries">
        {#each groups as { head, list }, i (i)}
          {@const st = status(head.w)}
          <section class="entry">
            <div class="entry-head">
              <Reading pinyin={head.p} />
              {#if head.l}<span class="level-tag" title="TOCFL path">{levelLabel(head.l)}</span
                >{/if}
            </div>
            <ol>
              {#each list.flatMap((e) => e.d).slice(0, 8) as def, j (j)}
                <li>{def}</li>
              {/each}
            </ol>
            {#if head.c}<p class="cl">
                Measure word <span lang="zh-Hant-TW" class="hanzi">{head.c}</span>
              </p>{/if}
            {#if head.w}
              <div class="actions">
                {#if st === 'new'}
                  <button type="button" class="btn seal small" onclick={() => add(head)}>
                    <Icon name="plus" size={16} /> Add to my deck
                  </button>
                {:else if st === 'deck'}
                  <span class="state"><Icon name="check" size={16} /> In your deck</span>
                {:else}
                  <span class="state"><Icon name="check" size={16} /> Studying</span>
                {/if}
                <a
                  class="btn quiet small"
                  href={router.href(`/word/${encodeURIComponent(head.w)}`)}
                  onclick={(e) => {
                    lookup.close();
                    router.link(e);
                  }}>Details</a
                >
              </div>
            {/if}
          </section>
        {/each}
      </div>
    {/if}
  </aside>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--scrim);
    animation: fade var(--dur) var(--ease);
  }

  .panel {
    position: fixed;
    z-index: 41;
    inset: auto 0 0;
    max-height: min(72dvh, 620px);
    overflow-y: auto;
    padding: 8px 20px calc(var(--safe-bottom) + 20px);
    border-radius: 22px 22px 0 0;
    animation: rise var(--dur) var(--ease);
    overscroll-behavior: contain;
  }

  .grip {
    width: 40px;
    height: 5px;
    margin: 0 auto 8px;
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
      padding: 18px 22px 22px;
      animation: slide var(--dur) var(--ease);
    }

    .grip {
      display: none;
    }
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .word {
    font-size: 44px;
    line-height: 1.2;
  }

  .tools {
    display: flex;
    gap: 4px;
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
    margin: 4px 0 0;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    font-size: 15px;
  }

  .muted {
    color: var(--ink-2);
  }

  .entry {
    padding: 14px 0;
  }

  .entry + .entry {
    border-top: 1px solid var(--rule);
  }

  .entry-head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
  }

  ol {
    margin: 8px 0 0;
    padding-left: 22px;
    font-size: 16px;
    line-height: 1.45;
  }

  li::marker {
    color: var(--ink-3);
    font-size: 13px;
  }

  .cl {
    margin: 8px 0 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .cl .hanzi {
    color: var(--ink);
    font-size: 17px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 14px;
  }

  .state {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 600;
    color: var(--jade);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes rise {
    from {
      transform: translateY(24px);
      opacity: 0;
    }
  }

  @keyframes slide {
    from {
      transform: translateX(16px);
      opacity: 0;
    }
  }
</style>
