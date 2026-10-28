<script lang="ts">
  // The account: sign in or create one, sync, password and sessions, the personal memory model,
  // API access and deleting the account.
  import AccountPanel from '../ui/AccountPanel.svelte';
  import SubpageHead from '../ui/SubpageHead.svelte';
</script>

<div class="page">
  <SubpageHead title="Account" zh="帳號" />
  <AccountPanel />
</div>
