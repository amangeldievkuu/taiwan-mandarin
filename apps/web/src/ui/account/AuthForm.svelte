<script lang="ts">
  // Sign in or create an account: one card, two tabs, errors in plain words.
  import Segmented from '../../components/Segmented.svelte';
  import PasswordField from './PasswordField.svelte';
  import { authMessage } from './errors';
  import { t } from '../../lib/i18n/index.svelte';
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
    label={t().auth.mode}
    value={mode}
    onchange={switchTo}
    options={[
      { value: 'login', label: t().auth.signIn },
      { value: 'register', label: t().auth.create },
    ]}
  />
  <p class="lead">{mode === 'login' ? t().auth.leadSignIn : t().auth.leadCreate}</p>
  <label for="auth-email">
    <span>{t().auth.email}</span>
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
      <span>{t().auth.name} <small>{t().auth.optional}</small></span>
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
    label={t().auth.password}
    autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
    minlength={mode === 'register' ? 8 : 1}
    hint={mode === 'register' ? t().auth.passwordHint : undefined}
    bind:value={password}
  />
  {#if formError}<p class="error" role="alert">{formError}</p>{/if}
  <button class="btn primary submit" type="submit" disabled={busy}>
    {#if busy}
      {mode === 'login' ? t().auth.signingIn : t().auth.creating}
    {:else}
      {mode === 'login' ? t().auth.signIn : t().auth.create}
    {/if}
  </button>
  {#if mode === 'login'}
    <p class="fine">
      {t().auth.noAccount}
      <button type="button" class="link" onclick={() => switchTo('register')}
        >{t().auth.createOne}</button
      >. {t().auth.forgotten}
    </p>
  {:else}
    <p class="fine">
      {t().auth.haveAccount}
      <button type="button" class="link" onclick={() => switchTo('login')}>{t().auth.signIn}</button
      >.
    </p>
  {/if}
</form>

<style>
  .auth {
    padding: var(--sp-5);
  }

  .auth :global(.segmented) {
    margin-bottom: var(--sp-4);
  }

  .lead {
    margin: 0 0 var(--sp-4);
    font-size: var(--fs-md);
    line-height: 1.5;
    color: var(--ink-2);
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
    margin-bottom: var(--sp-3);
    font-size: var(--fs-md);
    font-weight: var(--fw-label);
  }

  label small {
    font-weight: var(--fw-text);
    color: var(--ink-3);
  }

  input {
    height: 46px;
    padding: 0 var(--sp-4);
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius-sm);
    background: var(--paper-raised);
    font-size: var(--fs-base);
    font-weight: 400;
    outline: none;
  }

  input:focus {
    border-color: var(--sky);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--sky) 18%, transparent);
  }

  .submit {
    width: 100%;
    margin-top: var(--sp-1);
  }

  .error {
    margin: 0 0 var(--sp-3);
    padding: 10px var(--sp-3);
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    color: var(--seal);
    font-size: var(--fs-md);
    font-weight: var(--fw-label);
  }

  .fine {
    margin: var(--sp-4) 0 0;
    font-size: var(--fs-sm);
    line-height: 1.5;
    color: var(--ink-2);
  }

  .link {
    color: var(--sky-text);
    font-weight: var(--fw-strong);
    text-decoration: underline;
  }
</style>
