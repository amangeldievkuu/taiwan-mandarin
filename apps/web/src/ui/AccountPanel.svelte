<script lang="ts">
  // Sign in / create an account, sync status, personal FSRS parameters and API tokens.
  import type { TokenCreatedDto, TokenDto } from '@taiwan-mandarin/shared/api';
  import Icon from './Icon.svelte';
  import { api, ApiError } from '../lib/api';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  let mode = $state<'login' | 'register'>('login');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let formError = $state<string | null>(null);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    formError = null;
    try {
      if (mode === 'login') await account.login({ email, password });
      else await account.register({ email, password });
      password = '';
    } catch (e) {
      formError =
        e instanceof ApiError && e.status === 0
          ? 'Can’t reach the server.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong';
    } finally {
      busy = false;
    }
  }

  // ---- Tokens ----
  let tokens = $state<TokenDto[]>([]);
  let newToken = $state<TokenCreatedDto | null>(null);
  let tokenName = $state('');
  $effect(() => {
    if (account.user)
      void api<TokenDto[]>('/v1/me/tokens').then(
        (t) => (tokens = t),
        () => undefined,
      );
  });

  async function createToken(event: SubmitEvent) {
    event.preventDefault();
    if (!tokenName.trim()) return;
    newToken = await api<TokenCreatedDto>('/v1/me/tokens', {
      method: 'POST',
      body: { name: tokenName.trim() },
    });
    tokens = [newToken, ...tokens];
    tokenName = '';
  }

  async function revoke(id: string) {
    await api(`/v1/me/tokens/${id}`, { method: 'DELETE' });
    tokens = tokens.filter((t) => t.id !== id);
    if (newToken?.id === id) newToken = null;
  }

  // ---- FSRS ----
  let optimizing = $state(false);
  let fsrsMessage = $state<string | null>(null);
  async function optimize() {
    optimizing = true;
    fsrsMessage = null;
    try {
      await account.sync();
      const result = await api<{ reviewCount: number }>('/v1/me/fsrs/optimize', {
        method: 'POST',
        body: { utcOffsetMinutes: -new Date().getTimezoneOffset() },
      });
      await account.sync();
      fsrsMessage = `Fitted to your ${result.reviewCount.toLocaleString()} reviews.`;
    } catch (e) {
      fsrsMessage = e instanceof Error ? e.message : String(e);
    } finally {
      optimizing = false;
    }
  }

  let confirmDelete = $state(false);
</script>

{#if !account.checked}
  <p class="muted">Checking your session…</p>
{:else if !account.user}
  <form class="sheet auth" onsubmit={submit}>
    <p class="lead">
      Sign in to keep your progress in sync between your phone, iPad and laptop, and to use
      conversation practice, sentence explanations and pronunciation checks.
    </p>
    <label>
      <span>Email</span>
      <input type="email" autocomplete="email" required bind:value={email} />
    </label>
    <label>
      <span>Password</span>
      <input
        type="password"
        autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
        minlength={mode === 'register' ? 8 : 1}
        required
        bind:value={password}
      />
    </label>
    {#if formError}<p class="error" role="alert">{formError}</p>{/if}
    <div class="actions">
      <button class="btn primary" type="submit" disabled={busy}>
        {mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      <button
        type="button"
        class="link"
        onclick={() => (mode = mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </div>
    {#if mode === 'register'}
      <p class="fine">Your progress on this device is added to the new account.</p>
    {/if}
  </form>
{:else}
  <div class="sheet signed-in">
    <div class="who">
      <span class="avatar" aria-hidden="true">{account.user.email.charAt(0).toUpperCase()}</span>
      <div>
        <strong>{account.user.email}</strong>
        <small>
          {#if account.syncing}Syncing…{:else if account.error}Sync failed: {account.error}{:else if account.lastSync}Synced
            {account.lastSync.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}{:else}Not synced yet{/if}
        </small>
      </div>
    </div>
    <div class="actions">
      <button
        type="button"
        class="btn quiet small"
        disabled={account.syncing}
        onclick={() => account.sync()}
      >
        Sync now
      </button>
      <button type="button" class="btn quiet small" onclick={() => account.logout()}
        >Sign out</button
      >
    </div>
  </div>

  <h3 class="sub">Personal memory model</h3>
  <div class="sheet block">
    <p>
      {#if store.syncState.fsrsWeights}
        Your scheduler uses FSRS parameters fitted to your own review history.
      {:else}
        After about 400 reviews, the scheduler can be fitted to how you remember. It refits every
        night.
      {/if}
    </p>
    <button type="button" class="btn quiet small" disabled={optimizing} onclick={optimize}>
      {optimizing ? 'Fitting…' : 'Fit to my reviews now'}
    </button>
    {#if fsrsMessage}<p class="fine">{fsrsMessage}</p>{/if}
  </div>

  <h3 class="sub">API access</h3>
  <div class="sheet block">
    <p>
      Personal access tokens let other apps read your words, cards and stats through the
      <a href="/api/docs" target="_blank" rel="noopener">public API</a>.
    </p>
    {#if newToken}
      <div class="new-token">
        <span>Copy it now, it won't be shown again:</span>
        <code>{newToken.token}</code>
        <button
          type="button"
          class="btn quiet small"
          onclick={() => navigator.clipboard?.writeText(newToken?.token ?? '')}
        >
          Copy
        </button>
      </div>
    {/if}
    <form class="token-form" onsubmit={createToken}>
      <input placeholder="Token name, e.g. Anki export" bind:value={tokenName} maxlength="60" />
      <button class="btn quiet small" type="submit" disabled={!tokenName.trim()}>Create</button>
    </form>
    {#if tokens.length}
      <ul class="tokens">
        {#each tokens as t (t.id)}
          <li>
            <span><strong>{t.name}</strong> <code>{t.prefix}…</code></span>
            <small
              >{t.lastUsedAt
                ? `used ${new Date(t.lastUsedAt).toLocaleDateString()}`
                : 'never used'}</small
            >
            <button
              type="button"
              class="icon-btn"
              aria-label="Revoke {t.name}"
              onclick={() => revoke(t.id)}
            >
              <Icon name="trash" size={18} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="danger">
    {#if confirmDelete}
      <span>Delete the account and all synced data? This device keeps its local copy.</span>
      <button type="button" class="btn quiet small" onclick={() => (confirmDelete = false)}
        >Cancel</button
      >
      <button type="button" class="btn seal small" onclick={() => account.deleteAccount()}
        >Delete account</button
      >
    {:else}
      <button type="button" class="link" onclick={() => (confirmDelete = true)}
        >Delete account…</button
      >
    {/if}
  </div>
{/if}

<style>
  .auth,
  .signed-in,
  .block {
    padding: 18px;
  }

  .lead {
    margin: 0 0 14px;
    color: var(--ink-2);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  input {
    height: 46px;
    padding: 0 14px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    background: var(--paper);
    font-size: 16px;
    font-weight: 400;
    outline: none;
  }

  input:focus {
    border-color: var(--ink-2);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .link {
    color: var(--seal);
    font-weight: 600;
    font-size: 14px;
  }

  .error {
    margin: 0 0 12px;
    color: var(--seal);
  }

  .fine,
  .muted {
    margin: 10px 0 0;
    font-size: 13px;
    color: var(--ink-2);
  }

  .signed-in {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .who div {
    display: flex;
    flex-direction: column;
  }

  .who small {
    color: var(--ink-2);
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--ink);
    color: var(--paper);
    font-weight: 700;
  }

  .sub {
    margin: 22px 0 8px;
    font-size: 15px;
  }

  .block p {
    margin: 0 0 12px;
    color: var(--ink-2);
  }

  .new-token {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    font-size: 14px;
  }

  code {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 13px;
    word-break: break-all;
  }

  .token-form {
    display: flex;
    gap: 8px;
  }

  .token-form input {
    flex: 1;
    height: 38px;
  }

  .tokens {
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .tokens li {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-top: 1px solid var(--rule);
  }

  .tokens li span {
    flex: 1;
  }

  .tokens small {
    color: var(--ink-2);
  }

  .icon-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--ink-2);
  }

  .danger {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 16px;
    font-size: 14px;
    color: var(--ink-2);
  }
</style>
