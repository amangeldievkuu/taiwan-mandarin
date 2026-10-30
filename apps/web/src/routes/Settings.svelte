<script lang="ts">
  // The app's settings, in short groups: reading, studying, feedback, reminders and data.
  import { LANGS } from '@taiwan-mandarin/shared';
  import Segmented from '../components/Segmented.svelte';
  import SettingRow from '../ui/SettingRow.svelte';
  import SignInPrompt from '../ui/SignInPrompt.svelte';
  import SubpageHead from '../ui/SubpageHead.svelte';
  import Switch from '../ui/Switch.svelte';
  import { api } from '../lib/api';
  import { companion } from '../lib/companion.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { errorText } from '../lib/i18n/errors';
  import { t } from '../lib/i18n/index.svelte';
  import { reminders } from '../lib/reminders.svelte';
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

  let reminderError = $state<string | null>(null);
  let testNote = $state<string | null>(null);
  let testing = $state(false);

  /** Runs straight from the tap: Safari asks for permission only from a gesture. */
  async function toggleReminder(on: boolean) {
    if (reminders.busy || !account.user) return;
    reminderError = null;
    testNote = null;
    try {
      await (on ? reminders.enable(account.user.id) : reminders.disable());
    } catch (e) {
      reminderError = errorText(e);
    }
  }

  async function testReminder() {
    testing = true;
    reminderError = null;
    try {
      const { sent, errors } = await reminders.test();
      if (sent > 0) testNote = t().settings.reminderSent;
      else if (errors.length) reminderError = t().settings.reminderRefused(errors.join('; '));
      else testNote = t().settings.reminderNotSent;
    } catch (e) {
      reminderError = errorText(e);
    } finally {
      testing = false;
    }
  }

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
      resetError = errorText(e);
    } finally {
      resetting = false;
    }
  }
</script>

<div class="page">
  <SubpageHead title={t().titles['me-settings']} zh="設定" />

  <h2 class="section-title">
    {t().settings.language} <span class="zh" lang="zh-Hant-TW">語言</span>
  </h2>
  <div class="sheet group">
    <SettingRow label={t().settings.language} hint={t().settings.languageHint} stacked>
      <Segmented
        label={t().settings.language}
        value={store.settings.language}
        onchange={(language) => store.chooseLanguage(language)}
        options={LANGS.map((l) => ({ value: l.id, label: l.name, lang: l.id }))}
      />
    </SettingRow>
  </div>

  <h2 class="section-title">
    {t().settings.reading} <span class="zh" lang="zh-Hant-TW">閱讀</span>
  </h2>
  <div class="sheet group">
    <SettingRow label={t().settings.phonetics} hint={t().settings.phoneticsHint} stacked>
      <Segmented
        label={t().settings.phonetics}
        value={store.settings.phonetics}
        onchange={(phonetics) => store.updateSettings({ phonetics })}
        options={[
          { value: 'zhuyin', label: '注音', sub: t().settings.zhuyin, lang: 'zh-Hant-TW' },
          { value: 'pinyin', label: 'Pinyin' },
          { value: 'both', label: t().settings.both },
        ]}
      />
    </SettingRow>
    <SettingRow label={t().settings.characters} hint={t().settings.charactersHint} stacked>
      <Segmented
        label={t().settings.characterStyle}
        value={store.settings.glyphStyle}
        onchange={(glyphStyle) => store.updateSettings({ glyphStyle })}
        options={[
          {
            value: 'kai',
            label: '楷書',
            sub: t().settings.kai,
            lang: 'zh-Hant-TW',
            font: 'var(--font-kai)',
          },
          {
            value: 'sans',
            label: '黑體',
            sub: t().settings.sans,
            lang: 'zh-Hant-TW',
            font: 'var(--font-ui)',
          },
        ]}
      />
    </SettingRow>
    {#if store.settings.language === 'vi'}
      <SettingRow label={t().settings.hanViet} hint={t().settings.hanVietHint}>
        <Switch
          checked={store.settings.hanViet}
          label={t().settings.hanViet}
          onchange={(hanViet) => store.updateSettings({ hanViet })}
        />
      </SettingRow>
    {/if}
    <SettingRow label={t().settings.theme} stacked>
      <Segmented
        label={t().settings.theme}
        value={store.settings.theme}
        onchange={(theme) => store.updateSettings({ theme })}
        options={[
          { value: 'auto', label: t().settings.auto },
          { value: 'light', label: t().settings.light },
          { value: 'dark', label: t().settings.dark },
        ]}
      />
    </SettingRow>
  </div>

  <h2 class="section-title">
    {t().settings.studying} <span class="zh" lang="zh-Hant-TW">學習</span>
  </h2>
  <div class="sheet group">
    <SettingRow
      label={t().settings.newPerDay}
      value={String(newPerDay)}
      hint={t().settings.newPerDayHint}
      stacked
    >
      <input
        type="range"
        min="0"
        max="50"
        step="1"
        aria-label={t().settings.newPerDay}
        bind:value={newPerDay}
        onchange={() => store.updateSettings({ newPerDay })}
      />
    </SettingRow>
    <SettingRow
      label={t().settings.memory}
      value="{Math.round(retention * 100)}%"
      hint={t().settings.memoryHint}
      stacked
    >
      <input
        type="range"
        min="0.8"
        max="0.97"
        step="0.01"
        aria-label={t().settings.memory}
        bind:value={retention}
        onchange={() => store.updateSettings({ retention })}
      />
    </SettingRow>
  </div>

  <h2 class="section-title">
    {t().settings.feedback} <span class="zh" lang="zh-Hant-TW">提示</span>
  </h2>
  <div class="sheet group">
    <SettingRow label={t().settings.sound} hint={t().settings.soundHint}>
      <Switch
        checked={feedback.sound}
        label={t().settings.sound}
        onchange={(on) => feedback.setSound(on)}
      />
    </SettingRow>
    {#if feedback.canVibrate}
      <SettingRow label={t().settings.vibration} hint={t().settings.vibrationHint}>
        <Switch
          checked={feedback.haptics}
          label={t().settings.vibration}
          onchange={(on) => feedback.setHaptics(on)}
        />
      </SettingRow>
    {/if}
    <SettingRow label={t().settings.companion} hint={t().settings.companionHint}>
      <Switch
        checked={companion.on}
        label={t().settings.companion}
        onchange={(on) => companion.setOn(on)}
      />
    </SettingRow>
  </div>

  {#if reminders.publicKey}
    <h2 class="section-title">
      {t().settings.reminders} <span class="zh" lang="zh-Hant-TW">提醒</span>
    </h2>
    {#if !account.user}
      {#if account.checked}<SignInPrompt seal="提" text={t().settings.reminderSignIn} />{/if}
    {:else if reminders.support !== 'ok'}
      <div class="sheet data">
        <p>
          {reminders.support === 'install'
            ? t().settings.reminderInstall
            : t().settings.reminderUnsupported}
        </p>
      </div>
    {:else}
      <div class="sheet group">
        <SettingRow
          label={t().settings.reminder}
          hint={reminders.permission === 'denied'
            ? t().settings.reminderBlocked
            : t().settings.reminderHint}
        >
          <Switch checked={reminders.on} label={t().settings.reminder} onchange={toggleReminder} />
        </SettingRow>
        {#if reminders.on}
          <SettingRow label={t().settings.reminderTime} hint={t().settings.reminderTimeHint}>
            <input
              class="time"
              type="time"
              step="900"
              required
              aria-label={t().settings.reminderTime}
              value={store.settings.reminderTime}
              onchange={(e) => {
                const time = e.currentTarget.value;
                if (/^\d\d:\d\d$/.test(time)) void store.updateSettings({ reminderTime: time });
              }}
            />
          </SettingRow>
          <div class="test">
            <button type="button" class="btn quiet small" disabled={testing} onclick={testReminder}
              >{t().settings.reminderTest}</button
            >
            {#if testNote}<small role="status">{testNote}</small>{/if}
          </div>
        {/if}
        {#if reminderError}<p class="warn reminder-error" role="alert">{reminderError}</p>{/if}
      </div>
    {/if}
  {/if}

  <h2 class="section-title">{t().settings.data} <span class="zh" lang="zh-Hant-TW">資料</span></h2>
  <div class="sheet data">
    <p>{t().settings.todayCounts(todayNew, todayReviews)}</p>
    {#if confirmReset}
      <p class="warn">
        {account.user ? t().settings.resetAccount : t().settings.resetDevice}
      </p>
      {#if resetError}<p class="warn" role="alert">{resetError}</p>{/if}
      <div class="buttons">
        <button type="button" class="btn quiet small" onclick={() => (confirmReset = false)}
          >{t().common.cancel}</button
        >
        <button type="button" class="btn seal small" disabled={resetting} onclick={reset}
          >{t().settings.deleteEverything}</button
        >
      </div>
    {:else}
      <button type="button" class="btn quiet small" onclick={() => (confirmReset = true)}
        >{t().settings.reset}</button
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

  .time {
    height: 40px;
    padding: 0 10px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    background: var(--paper-raised);
    font-variant-numeric: tabular-nums;
  }

  .test {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    padding: 12px 16px;
    border-top: 1px solid var(--rule);
  }

  .test small {
    color: var(--ink-2);
  }

  .reminder-error {
    margin: 0;
    padding: 0 16px 12px;
  }

  .buttons {
    display: flex;
    gap: 8px;
  }
</style>
