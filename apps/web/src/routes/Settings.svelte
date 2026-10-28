<script lang="ts">
  // The app's settings, in four short groups: reading, studying, feedback and data.
  import Segmented from '../components/Segmented.svelte';
  import SettingRow from '../ui/SettingRow.svelte';
  import SubpageHead from '../ui/SubpageHead.svelte';
  import Switch from '../ui/Switch.svelte';
  import { api } from '../lib/api';
  import { companion } from '../lib/companion.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  // Sliders show their value as they move and save it when let go.
  let newPerDay = $state(store.settings.newPerDay);
  let retention = $state(store.settings.retention);
  $effect(() => {
    newPerDay = store.settings.newPerDay;
    retention = store.settings.retention;
  });

  const todayNew = $derived(store.days[store.today]?.learned ?? store.daily.newCount);
  const todayReviews = $derived(store.days[store.today]?.reviews ?? store.daily.reviewCount);

  let confirmReset = $state(false);
  let resetting = $state(false);
  let resetError = $state<string | null>(null);

  /** Signed in, the account's copy goes first, or the next sync would bring everything back. */
  async function reset() {
    resetting = true;
    resetError = null;
    try {
      if (account.user) await api('/v1/me/progress', { method: 'DELETE' });
      await store.resetProgress();
      confirmReset = false;
    } catch (e) {
      resetError = e instanceof Error ? e.message : String(e);
    } finally {
      resetting = false;
    }
  }
</script>

<div class="page">
  <SubpageHead title="Settings" zh="設定" />

  <h2 class="section-title">Reading <span class="zh" lang="zh-Hant-TW">閱讀</span></h2>
  <div class="sheet group">
    <SettingRow label="Phonetics" hint="Shown beside every character" stacked>
      <Segmented
        label="Phonetics"
        value={store.settings.phonetics}
        onchange={(phonetics) => store.updateSettings({ phonetics })}
        options={[
          { value: 'zhuyin', label: '注音', sub: 'Zhuyin', lang: 'zh-Hant-TW' },
          { value: 'pinyin', label: 'Pinyin' },
          { value: 'both', label: 'Both' },
        ]}
      />
    </SettingRow>
    <SettingRow label="Characters" hint="Brush-style Kai, or a plain sans" stacked>
      <Segmented
        label="Character style"
        value={store.settings.glyphStyle}
        onchange={(glyphStyle) => store.updateSettings({ glyphStyle })}
        options={[
          { value: 'kai', label: '楷書', sub: 'Kai', lang: 'zh-Hant-TW', font: 'var(--font-kai)' },
          { value: 'sans', label: '黑體', sub: 'Sans', lang: 'zh-Hant-TW', font: 'var(--font-ui)' },
        ]}
      />
    </SettingRow>
    <SettingRow label="Theme" stacked>
      <Segmented
        label="Theme"
        value={store.settings.theme}
        onchange={(theme) => store.updateSettings({ theme })}
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    </SettingRow>
  </div>

  <h2 class="section-title">Studying <span class="zh" lang="zh-Hant-TW">學習</span></h2>
  <div class="sheet group">
    <SettingRow
      label="New words per day"
      value={String(newPerDay)}
      hint="Reviews come first; new words are added up to this many. 0 pauses new words."
      stacked
    >
      <input
        type="range"
        min="0"
        max="50"
        step="1"
        aria-label="New words per day"
        bind:value={newPerDay}
        onchange={() => store.updateSettings({ newPerDay })}
      />
    </SettingRow>
    <SettingRow
      label="Target memory"
      value="{Math.round(retention * 100)}%"
      hint="How well you want to remember a word when it comes up. Higher means more reviews."
      stacked
    >
      <input
        type="range"
        min="0.8"
        max="0.97"
        step="0.01"
        aria-label="Target memory"
        bind:value={retention}
        onchange={() => store.updateSettings({ retention })}
      />
    </SettingRow>
  </div>

  <h2 class="section-title">Feedback <span class="zh" lang="zh-Hant-TW">提示</span></h2>
  <div class="sheet group">
    <SettingRow label="Sound effects" hint="Chimes when you answer and finish (this device)">
      <Switch
        checked={feedback.sound}
        label="Sound effects"
        onchange={(on) => feedback.setSound(on)}
      />
    </SettingRow>
    {#if feedback.canVibrate}
      <SettingRow label="Vibration" hint="A little buzz on each answer (this device)">
        <Switch
          checked={feedback.haptics}
          label="Vibration"
          onchange={(on) => feedback.setHaptics(on)}
        />
      </SettingRow>
    {/if}
    <SettingRow
      label="墨 on every page"
      hint="The ink drop that comes along with you (this device)"
    >
      <Switch
        checked={companion.on}
        label="墨 on every page"
        onchange={(on) => companion.setOn(on)}
      />
    </SettingRow>
  </div>

  <h2 class="section-title">Data <span class="zh" lang="zh-Hant-TW">資料</span></h2>
  <div class="sheet data">
    <p>Today: {todayNew} new · {todayReviews} reviews</p>
    {#if confirmReset}
      <p class="warn">
        {account.user
          ? 'This deletes all progress and review history here and in your account. Other devices keep their copy until you reset them too.'
          : 'This deletes all progress and review history on this device.'}
      </p>
      {#if resetError}<p class="warn" role="alert">{resetError}</p>{/if}
      <div class="buttons">
        <button type="button" class="btn quiet small" onclick={() => (confirmReset = false)}
          >Cancel</button
        >
        <button type="button" class="btn seal small" disabled={resetting} onclick={reset}
          >Delete everything</button
        >
      </div>
    {:else}
      <button type="button" class="btn quiet small" onclick={() => (confirmReset = true)}
        >Reset progress…</button
      >
    {/if}
  </div>
</div>

<style>
  .group {
    padding: 2px 0;
  }

  .group > :global(.setting + .setting) {
    border-top: 1px solid var(--rule);
  }

  .group :global(.segmented) {
    width: 100%;
    max-width: 360px;
  }

  .data {
    padding: 14px 16px;
  }

  .data p {
    margin: 0 0 10px;
    color: var(--ink-2);
  }

  .warn {
    color: var(--seal) !important;
  }

  .buttons {
    display: flex;
    gap: 8px;
  }
</style>
