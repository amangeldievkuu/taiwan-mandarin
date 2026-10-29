<script lang="ts">
  // The account: sign in or create one; signed in, the profile and sync, security, the personal
  // memory model, API access and deleting the account.
  import SubpageHead from '../ui/SubpageHead.svelte';
  import AuthForm from '../ui/account/AuthForm.svelte';
  import PasswordSection from '../ui/account/PasswordSection.svelte';
  import ProfileCard from '../ui/account/ProfileCard.svelte';
  import TokensSection from '../ui/account/TokensSection.svelte';
  import { authMessage } from '../ui/account/errors';
  import { api } from '../lib/api';
  import { formatNumber, t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  /** Where to go after signing in (a sign-in prompt on Talk or Explain sends ?next=). */
  const next = $derived.by(() => {
    const value = router.route.query.get('next') ?? '';
    return value.startsWith('/') && !value.startsWith('//') ? value : null;
  });

  function signedIn() {
    if (next) router.go(next, { replace: true });
  }

  const standalone =
    typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);

  // ---- FSRS ----
  let optimizing = $state(false);
  let fsrsMessage = $state<{ text: string; ok: boolean } | null>(null);
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
      fsrsMessage = { text: t().account.fittedTo(formatNumber(result.reviewCount)), ok: true };
    } catch (e) {
      fsrsMessage = { text: authMessage(e), ok: false };
    } finally {
      optimizing = false;
    }
  }

  // ---- Delete ----
  let confirmDelete = $state(false);
  let deleting = $state(false);
  let deleteError = $state<string | null>(null);
  async function deleteAccount() {
    deleting = true;
    deleteError = null;
    try {
      await account.deleteAccount();
      confirmDelete = false;
    } catch (e) {
      deleteError = authMessage(e);
    } finally {
      deleting = false;
    }
  }
</script>

<div class="page">
  <SubpageHead title={t().titles['me-account']} zh="帳號" />

  {#if !account.checked}
    <p class="muted">{t().account.starting}</p>
  {:else if !account.user}
    <AuthForm onsignedin={signedIn} />
    {#if ios && !standalone}
      <p class="footnote">{t().account.homeScreen}</p>
    {/if}
  {:else}
    <ProfileCard />

    <h2 class="section-title">
      {t().account.security} <span class="zh" lang="zh-Hant-TW">安全</span>
    </h2>
    <PasswordSection />

    <h2 class="section-title">
      {t().account.memoryModel} <span class="zh" lang="zh-Hant-TW">記憶</span>
    </h2>
    <div class="sheet block">
      <p>{store.syncState.fsrsWeights ? t().account.fitted : t().account.notFitted}</p>
      <button type="button" class="btn quiet small" disabled={optimizing} onclick={optimize}>
        {optimizing ? t().account.fitting : t().account.fitNow}
      </button>
      {#if fsrsMessage}
        <p class={fsrsMessage.ok ? 'fine' : 'error'} role={fsrsMessage.ok ? 'status' : 'alert'}>
          {fsrsMessage.text}
        </p>
      {/if}
    </div>

    <h2 class="section-title">
      {t().account.api} <span class="zh" lang="zh-Hant-TW">應用程式</span>
    </h2>
    <TokensSection />

    <div class="danger">
      {#if confirmDelete}
        <span>{t().account.deleteConfirm}</span>
        {#if deleteError}<span class="error" role="alert">{deleteError}</span>{/if}
        <span class="buttons">
          <button
            type="button"
            class="btn quiet small"
            disabled={deleting}
            onclick={() => (confirmDelete = false)}>{t().common.cancel}</button
          >
          <button type="button" class="btn seal small" disabled={deleting} onclick={deleteAccount}
            >{deleting ? t().account.deleting : t().account.delete}</button
          >
        </span>
      {:else}
        <button type="button" class="link" onclick={() => (confirmDelete = true)}
          >{t().account.deleteMenu}</button
        >
      {/if}
    </div>
  {/if}
</div>

<style>
  .muted {
    color: var(--ink-2);
  }

  .block {
    padding: 18px;
  }

  .block p {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--ink-2);
  }

  .block .fine,
  .block .error {
    margin: 12px 0 0;
  }

  .error {
    color: var(--seal);
  }

  .danger {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 28px;
    font-size: 14px;
    color: var(--ink-2);
  }

  .buttons {
    display: flex;
    gap: 8px;
  }

  .link {
    color: var(--seal);
    font-weight: 600;
    font-size: 14px;
  }
</style>
