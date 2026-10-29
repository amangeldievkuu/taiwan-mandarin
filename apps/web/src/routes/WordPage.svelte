<script lang="ts">
  import Loading from '../ui/Loading.svelte';
  import type { Word } from '@taiwan-mandarin/shared';
  import BackButton from '../ui/BackButton.svelte';
  import WordDetail from '../ui/WordDetail.svelte';
  import { content } from '../lib/content.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { store } from '../lib/store.svelte';

  interface Props {
    id: string;
  }

  let { id }: Props = $props();
  let word = $state<Word | undefined>();
  let missing = $state(false);
  let failed = $state(false);

  $effect(() => {
    const level = store.cards[id]?.level ?? store.deck.find((d) => d.id === id)?.level;
    const found = level
      ? content.ensureLevels([level]).then(() => content.word(id))
      : content.findWord(id);
    // A slower answer for a word we've since left must not replace the current one.
    let live = true;
    found.then(
      (w) => {
        if (!live) return;
        word = w;
        // Its level file didn't load (offline): that's not the same as no such word.
        missing = !w && (!level || content.isLoaded(level));
        failed = !w && !missing;
      },
      () => {
        if (live) failed = true;
      },
    );
    return () => {
      live = false;
    };
  });
</script>

<div class="page">
  <BackButton parent={word ? `/path/${word.level}` : '/path'} />
  {#if word}
    <WordDetail {word} />
  {:else if missing}
    <p class="empty">
      <span class="hanzi" lang="zh-Hant-TW">無</span>{t().misc.notInPath}
    </p>
  {:else if failed}
    <p class="empty" role="alert">{t().level.loadFailed}</p>
  {:else}
    <Loading />
  {/if}
</div>
