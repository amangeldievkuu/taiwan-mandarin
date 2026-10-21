<script lang="ts">
  import { store } from '../lib/store.svelte';
  import type { GlyphStyle, MeaningLang, Phonetics } from '../lib/storage';
  import { VOCAB, WORD_BY_ID } from '../lib/vocab';
  import Segmented from './Segmented.svelte';
  import WordGlyphs from './WordGlyphs.svelte';

  const sample = WORD_BY_ID.get('ni-hao')!;
  const settings = $derived(store.settings);
  const studied = $derived(Object.keys(store.cards).length);

  let confirming = $state(false);
  let resetDone = $state(false);

  function setNewPerDay(delta: number) {
    const next = Math.min(50, Math.max(1, settings.newPerDay + delta));
    if (next !== settings.newPerDay) store.updateSettings({ newPerDay: next });
  }

  async function reset() {
    await store.resetProgress();
    confirming = false;
    resetDone = true;
  }
</script>

<section class="screen">
  <h1 class="large-title"><span lang="zh-Hant-TW">設定</span><small>Settings</small></h1>

  <h2 class="group-header">Phonetics</h2>
  <div class="group card">
    <div class="preview">
      <WordGlyphs word={sample} size="56px" phonetics={settings.phonetics} />
    </div>
    <Segmented
      label="Phonetics"
      value={settings.phonetics}
      options={[
        { value: 'zhuyin', label: 'Zhuyin' },
        { value: 'pinyin', label: 'Pinyin' },
        { value: 'both', label: 'Both' },
      ]}
      onchange={(phonetics: Phonetics) => store.updateSettings({ phonetics })}
    />
  </div>

  <h2 class="group-header">Meaning language</h2>
  <div class="group card">
    <Segmented
      label="Meaning language"
      value={settings.meaning}
      options={[
        { value: 'ky', label: 'Кыргызча' },
        { value: 'en', label: 'English' },
      ]}
      onchange={(meaning: MeaningLang) => store.updateSettings({ meaning })}
    />
  </div>

  <h2 class="group-header">Character style</h2>
  <div class="group card">
    <Segmented
      label="Character style"
      value={settings.glyphStyle}
      options={[
        { value: 'kai', label: '楷書 Kai', font: 'var(--font-kai)' },
        { value: 'sans', label: '黑體 Sans', font: 'var(--font-ui)' },
      ]}
      onchange={(glyphStyle: GlyphStyle) => store.updateSettings({ glyphStyle })}
    />
  </div>
  <p class="group-footer">Kai matches the handwritten forms in Taiwan textbooks.</p>

  <h2 class="group-header">Study</h2>
  <div class="group">
    <div class="row">
      <span class="label">New cards per day</span>
      <div class="stepper" role="group" aria-label="New cards per day">
        <button
          type="button"
          aria-label="Fewer"
          disabled={settings.newPerDay <= 1}
          onclick={() => setNewPerDay(-1)}>−</button
        >
        <output aria-live="polite">{settings.newPerDay}</output>
        <button
          type="button"
          aria-label="More"
          disabled={settings.newPerDay >= 50}
          onclick={() => setNewPerDay(1)}>+</button
        >
      </div>
    </div>
  </div>
  <p class="group-footer">
    Today: {store.daily.newCount} new · {store.daily.reviewCount} reviews · {studied} of
    {VOCAB.length} words started
  </p>

  <div class="group">
    {#if confirming}
      <div class="confirm">
        <p>Delete all review history? Your settings are kept.</p>
        <div class="confirm-actions">
          <button type="button" class="cancel" onclick={() => (confirming = false)}>Cancel</button>
          <button type="button" class="danger" onclick={reset}>Reset</button>
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="row destructive"
        onclick={() => {
          confirming = true;
          resetDone = false;
        }}
      >
        Reset progress
      </button>
    {/if}
  </div>
  {#if resetDone}<p class="group-footer">Progress reset.</p>{/if}

  <p class="about">
    {VOCAB.length} words · Stroke data from Make Me a Hanzi (Arphic Public License) · Works offline
  </p>
</section>

<style>
  .card {
    padding: 12px;
  }

  .preview {
    display: flex;
    justify-content: center;
    min-height: 96px;
    align-items: center;
    padding-bottom: 8px;
  }

  .label {
    flex: 1;
  }

  .stepper {
    display: flex;
    align-items: center;
    border-radius: 9px;
    background: var(--fill);
  }

  .stepper button {
    width: 44px;
    height: 36px;
    font-size: 20px;
    color: var(--accent);
  }

  .stepper button:disabled {
    color: var(--text-3);
  }

  output {
    min-width: 32px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .destructive {
    justify-content: center;
    color: var(--again);
  }

  .confirm {
    padding: 14px 16px;
    animation: appear var(--dur) var(--ease) both;
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  .confirm p {
    margin: 0 0 12px;
    font-size: 15px;
    color: var(--text-2);
    text-align: center;
  }

  .confirm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .confirm-actions button {
    min-height: 44px;
    border-radius: 10px;
    font-weight: 600;
  }

  .cancel {
    background: var(--fill);
  }

  .danger {
    color: #fff;
    background: var(--again);
  }

  .about {
    margin: 8px 0 0;
    padding: 0 16px;
    font-size: 12px;
    text-align: center;
    color: var(--text-3);
  }
</style>
