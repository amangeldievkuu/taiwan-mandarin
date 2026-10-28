<script lang="ts">
  // Sign in or create an account: one card, two tabs, errors in plain words.
  import Segmented from '../../components/Segmented.svelte';
  import PasswordField from './PasswordField.svelte';
  import { authMessage } from './errors';
  import { account } from '../../lib/sync.svelte';

  interface Props {
    /** Called once signed in (e.g. to go back where the learner came from). */
    onsignedin?: () => void;
  }

  let { onsignedin }: Props = $props();

  let mode = $state<'login' | 'register'>('login');
  let email = $state('');
  let password = $state('');
  let displayName = $state('');
  let busy = $state(false);
  let formError = $state<string | null>(null);

  function switchTo(next: 'login' | 'register') {
    mode = next;
    formError = null;
    password = '';
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    formError = null;
    try {
      if (mode === 'login') await account.login({ email: email.trim(), password });
      else {
        const name = displayName.trim();
        await account.register({
          email: email.trim(),
          password,
          ...(name ? { displayName: name } : {}),
        });
      }
      password = '';
      onsignedin?.();
    } catch (e) {
      formError = authMessage(e, mode);
    } finally {
      busy = false;
    }
  }
</script>

<form class="sheet auth" onsubmit={submit} novalidate={false}>
  <Segmented
    label="Sign in or create an account"
    value={mode}
    onchange={switchTo}
    options={[
      { value: 'login', label: 'Sign in' },
      { value: 'register', label: 'Create account' },
    ]}
  />
  <p class="lead">
    {#if mode === 'login'}
      Your progress syncs between your phone, iPad and laptop, and conversation practice, sentence
      explanations and pronunciation checks become available.
    {:else}
      Free. What you have learned on this device is added to the new account.
    {/if}
  </p>
  <label for="auth-email">
    <span>Email</span>
    <input
      id="auth-email"
      name="email"
      type="email"
      inputmode="email"
      autocomplete="username"
      autocapitalize="off"
      spellcheck="false"
      maxlength="254"
      required
      bind:value={email}
    />
  </label>
  {#if mode === 'register'}
    <label for="auth-name">
      <span>Name <small>optional</small></span>
      <input
        id="auth-name"
        name="name"
        type="text"
        autocomplete="nickname"
        maxlength="60"
        bind:value={displayName}
      />
    </label>
  {/if}
  <PasswordField
    id="auth-password"
    label="Password"
    autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
    minlength={mode === 'register' ? 8 : 1}
    hint={mode === 'register' ? 'At least 8 characters. A few words work well.' : undefined}
    bind:value={password}
  />
  {#if formError}<p class="error" role="alert">{formError}</p>{/if}
  <button class="btn primary submit" type="submit" disabled={busy}>
    {#if busy}
      {mode === 'login' ? 'Signing in…' : 'Creating your account…'}
    {:else}
      {mode === 'login' ? 'Sign in' : 'Create account'}
    {/if}
  </button>
  {#if mode === 'login'}
    <p class="fine">
      No account yet? <button type="button" class="link" onclick={() => switchTo('register')}
        >Create one</button
      >. Forgotten your password? There is no reset by email yet: your progress on this device stays
      yours, and a new account can take it over.
    </p>
  {:else}
    <p class="fine">
      Have an account? <button type="button" class="link" onclick={() => switchTo('login')}
        >Sign in</button
      >.
    </p>
  {/if}
</form>

<style>
  .auth {
    padding: 18px;
  }

  .auth :global(.segmented) {
    margin-bottom: 14px;
  }

  .lead {
    margin: 0 0 16px;
    font-size: 14px;
    line-height: 1.5;
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

  label small {
    font-weight: 500;
    color: var(--ink-3);
  }

  input {
    height: 46px;
    padding: 0 14px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    background: var(--paper-raised);
    font-size: 16px;
    font-weight: 400;
    outline: none;
  }

  input:focus {
    border-color: var(--sky);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sky) 18%, transparent);
  }

  .submit {
    width: 100%;
    margin-top: 4px;
  }

  .error {
    margin: 0 0 12px;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    color: var(--seal);
    font-size: 14px;
    font-weight: 600;
  }

  .fine {
    margin: 14px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-2);
  }

  .link {
    color: var(--sky-text);
    font-weight: 700;
    text-decoration: underline;
  }
</style>
