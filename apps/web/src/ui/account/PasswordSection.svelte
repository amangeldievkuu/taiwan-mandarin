<script lang="ts">
  // Change the password (with a confirmation field) or sign out on every device.
  import PasswordField from './PasswordField.svelte';
  import { authMessage } from './errors';
  import { t } from '../../lib/i18n/index.svelte';
  import { account } from '../../lib/sync.svelte';

  let changing = $state(false);
  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let passwordBusy = $state(false);
  let passwordMessage = $state<{ text: string; ok: boolean } | null>(null);

  async function changePassword(event: SubmitEvent) {
    event.preventDefault();
    passwordMessage = null;
    if (newPassword !== confirmPassword) {
      passwordMessage = { text: t().auth.mismatch, ok: false };
      return;
    }
    passwordBusy = true;
    try {
      await account.changePassword({ currentPassword, newPassword });
      currentPassword = newPassword = confirmPassword = '';
      changing = false;
      passwordMessage = { text: t().auth.changed, ok: true };
    } catch (e) {
      passwordMessage = { text: authMessage(e, 'password'), ok: false };
    } finally {
      passwordBusy = false;
    }
  }

  let confirmEverywhere = $state(false);
  let everywhereBusy = $state(false);
  let everywhereError = $state<string | null>(null);

  async function logoutEverywhere() {
    everywhereBusy = true;
    everywhereError = null;
    try {
      await account.logoutEverywhere();
    } catch (e) {
      everywhereError = authMessage(e);
    } finally {
      everywhereBusy = false;
    }
  }
</script>

<div class="sheet block">
  {#if changing}
    <form onsubmit={changePassword}>
      <PasswordField
        id="current-password"
        label={t().auth.current}
        autocomplete="current-password"
        bind:value={currentPassword}
      />
      <PasswordField
        id="new-password"
        label={t().auth.new}
        autocomplete="new-password"
        minlength={8}
        hint={t().auth.newHint}
        bind:value={newPassword}
      />
      <PasswordField
        id="confirm-password"
        label={t().auth.again}
        autocomplete="new-password"
        minlength={8}
        bind:value={confirmPassword}
      />
      <p>{t().auth.changeNote}</p>
      <div class="actions">
        <button class="btn primary small" type="submit" disabled={passwordBusy}>
          {passwordBusy ? t().auth.changing : t().auth.change}
        </button>
        <button
          type="button"
          class="btn quiet small"
          disabled={passwordBusy}
          onclick={() => {
            changing = false;
            passwordMessage = null;
          }}>{t().common.cancel}</button
        >
      </div>
    </form>
  {:else if confirmEverywhere}
    <p>{t().auth.everywhereConfirm}</p>
    <div class="actions">
      <button
        type="button"
        class="btn seal small"
        disabled={everywhereBusy}
        onclick={logoutEverywhere}
      >
        {everywhereBusy ? t().account.signingOut : t().auth.everywhere}
      </button>
      <button
        type="button"
        class="btn quiet small"
        disabled={everywhereBusy}
        onclick={() => (confirmEverywhere = false)}>{t().common.cancel}</button
      >
    </div>
  {:else}
    <div class="actions">
      <button
        type="button"
        class="btn quiet small"
        onclick={() => {
          changing = true;
          passwordMessage = null;
        }}>{t().auth.changeMenu}</button
      >
      <button type="button" class="btn quiet small" onclick={() => (confirmEverywhere = true)}
        >{t().auth.everywhereMenu}</button
      >
    </div>
  {/if}
  {#if passwordMessage}
    <p class={passwordMessage.ok ? 'fine' : 'error'} role={passwordMessage.ok ? 'status' : 'alert'}>
      {passwordMessage.text}
    </p>
  {/if}
  {#if everywhereError}<p class="error" role="alert">{everywhereError}</p>{/if}
</div>

<style>
  .block {
    padding: 18px;
  }

  .block p {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--ink-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .error,
  .fine {
    margin: 12px 0 0 !important;
  }

  .error {
    color: var(--seal) !important;
  }
</style>
