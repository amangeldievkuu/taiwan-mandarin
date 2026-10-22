<script lang="ts">
  import Loading from '../ui/Loading.svelte';
  import type { Word } from '@taiwan-mandarin/shared';
  import Icon from '../ui/Icon.svelte';
  import WordDetail from '../ui/WordDetail.svelte';
  import { content } from '../lib/content.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();
  let word = $state<Word | undefined>();
  let missing = $state(false);

  $effect(() => {
    const level = store.cards[id]?.level ?? store.deck.find((d) => d.id === id)?.level;
    const found = level
      ? content.ensureLevels([level]).then(() => content.word(id))
      : content.findWord(id);
    void found.then((w) => {
      word = w;
      missing = !w;
    });
  });
</script>

<div class="page">
  <button
    type="button"
    class="back"
    onclick={() => router.back(word ? `/path/${word.level}` : '/path')}
  >
    <Icon name="back" size={18} /> Back
  </button>
  {#if word}
    <WordDetail {word} />
  {:else if missing}
    <p class="empty">
      <span class="hanzi" lang="zh-Hant-TW">無</span>This word isn't in the study path.
    </p>
  {:else}
    <Loading />
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
</style>
