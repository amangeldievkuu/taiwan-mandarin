<script lang="ts">
  // The signed-in account: who, the sync state in plain words, sync now and sign out.
  import { authMessage } from './errors';
  import { intlLocale, t } from '../../lib/i18n/index.svelte';
  import { account } from '../../lib/sync.svelte';

  let signingOut = $state(false);
  let error = $state<string | null>(null);

  const status = $derived.by(() => {
    const say = t().account;
    if (account.syncing) return say.syncingNow;
    if (account.verifying) return say.checking;
    if (account.error) return say.syncFailed(authMessage(new Error(account.error)));
    if (account.lastSync) {
      const time = account.lastSync.toLocaleTimeString(intlLocale(), {
        hour: '2-digit',
        minute: '2-digit',
      });
      return say.synced(time);
    }
    return say.notSynced;
  });

  async function signOut() {
    signingOut = true;
    error = null;
    try {
      await account.logout();
    } catch (e) {
      error = authMessage(e);
    } finally {
      signingOut = false;
    }
  }
</script>

{#if account.user}
  <div class="sheet card">
    <div class="who">
      <span class="avatar" aria-hidden="true"
        >{(account.user.displayName ?? account.user.email).charAt(0).toUpperCase()}</span
      >
      <div class="text">
        <strong>{account.user.displayName ?? account.user.email}</strong>
        {#if account.user.displayName}<small>{account.user.email}</small>{/if}
        <small class:bad={!!account.error && !account.syncing}>{status}</small>
      </div>
    </div>
    <div class="actions">
      <button
        type="button"
        class="btn quiet small"
        disabled={account.syncing || signingOut}
        onclick={() => account.sync()}
      >
        {t().account.syncNow}
      </button>
      <button type="button" class="btn quiet small" disabled={signingOut} onclick={signOut}>
        {signingOut ? t().account.signingOut : t().account.signOut}
      </button>
    </div>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
{/if}

<style>
  .card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 18px;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .text small {
    color: var(--ink-2);
  }

  .text small.bad {
    color: var(--seal);
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    flex: none;
    border-radius: 50%;
    background: var(--jade);
    color: var(--jade-ink);
    font-weight: 800;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .error {
    flex-basis: 100%;
    margin: 0;
    color: var(--seal);
    font-size: 14px;
  }
</style>
