<script lang="ts">
  // Personal access tokens for the public API: create, copy once, revoke.
  import type { TokenCreatedDto, TokenDto } from '@taiwan-mandarin/shared/api';
  import Icon from '../Icon.svelte';
  import { authMessage } from './errors';
  import { api } from '../../lib/api';
  import { intlLocale, t } from '../../lib/i18n/index.svelte';
  import { account } from '../../lib/sync.svelte';

  let tokens = $state<TokenDto[]>([]);
  let newToken = $state<TokenCreatedDto | null>(null);
  let tokenName = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let copied = $state(false);

  $effect(() => {
    if (!account.user) return;
    void api<TokenDto[]>('/v1/me/tokens').then(
      (list) => (tokens = list),
      (e: unknown) => (error = authMessage(e)),
    );
  });

  async function createToken(event: SubmitEvent) {
    event.preventDefault();
    if (!tokenName.trim()) return;
    busy = true;
    error = null;
    try {
      newToken = await api<TokenCreatedDto>('/v1/me/tokens', {
        method: 'POST',
        body: { name: tokenName.trim() },
      });
      tokens = [newToken, ...tokens];
      tokenName = '';
      copied = false;
    } catch (e) {
      error = authMessage(e);
    } finally {
      busy = false;
    }
  }

  async function revoke(id: string) {
    error = null;
    try {
      await api(`/v1/me/tokens/${id}`, { method: 'DELETE' });
      tokens = tokens.filter((t) => t.id !== id);
      if (newToken?.id === id) newToken = null;
    } catch (e) {
      error = authMessage(e);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(newToken?.token ?? '');
      copied = true;
    } catch {
      copied = false;
    }
  }
</script>

<div class="sheet block">
  <p>
    {t().tokens.intro}
    <a href="/api/docs" target="_blank" rel="noopener">{t().tokens.publicApi}</a>.
  </p>
  {#if newToken}
    <div class="new-token" role="status">
      <span>{t().tokens.copyNow}</span>
      <code>{newToken.token}</code>
      <button type="button" class="btn quiet small" onclick={copy}>
        {copied ? t().tokens.copied : t().tokens.copy}
      </button>
    </div>
  {/if}
  <form class="token-form" onsubmit={createToken}>
    <input
      aria-label={t().tokens.name}
      placeholder={t().tokens.placeholder}
      bind:value={tokenName}
      maxlength="60"
    />
    <button class="btn quiet small" type="submit" disabled={busy || !tokenName.trim()}
      >{busy ? t().tokens.creating : t().tokens.create}</button
    >
  </form>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if tokens.length}
    <ul class="tokens">
      {#each tokens as token (token.id)}
        <li>
          <span><strong>{token.name}</strong> <code>{token.prefix}…</code></span>
          <small
            >{token.lastUsedAt
              ? t().tokens.used(new Date(token.lastUsedAt).toLocaleDateString(intlLocale()))
              : t().tokens.neverUsed}</small
          >
          <button
            type="button"
            class="icon-btn"
            aria-label={t().tokens.revoke(token.name)}
            onclick={() => revoke(token.id)}
          >
            <Icon name="trash" size={18} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}
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

  a {
    color: var(--sky-text);
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
    min-width: 0;
    height: 38px;
    padding: 0 12px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    background: var(--paper-raised);
    font-size: 15px;
    outline: none;
  }

  .token-form input:focus {
    border-color: var(--sky);
  }

  .error {
    margin: 12px 0 0;
    color: var(--seal);
    font-size: 14px;
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
    min-width: 0;
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
</style>
