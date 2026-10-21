<script lang="ts">
  // Paste a sign, menu or message from Taiwan: tap through it word by word.
  import HanziText from './HanziText.svelte';

  let text = $state('');
</script>

<section class="explain">
  <label class="field">
    <span class="visually-hidden">Text to explain</span>
    <textarea
      bind:value={text}
      rows="4"
      placeholder="Paste Chinese text: a sign, a menu, a LINE message…"
      lang="zh-Hant-TW"></textarea>
  </label>
  {#if text.trim()}
    <div class="sheet result">
      <p class="hint">Tap any character to look up the word that starts there.</p>
      <HanziText text={text.trim()} class="explain-text" />
    </div>
  {/if}
</section>

<style>
  textarea {
    width: 100%;
    padding: 14px 16px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--paper-raised);
    font-size: 20px;
    line-height: 1.6;
    resize: vertical;
    outline: none;
  }

  textarea:focus {
    border-color: var(--ink-2);
  }

  .result {
    margin-top: 16px;
    padding: 16px 18px;
  }

  .hint {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--ink-2);
  }

  .result :global(.explain-text) {
    font-size: 26px;
    line-height: 1.7;
  }
</style>
