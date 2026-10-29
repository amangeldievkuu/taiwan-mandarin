<script lang="ts">
  // A page or list still loading: a few shimmering lines in place of the content.
  import Skeleton from './Skeleton.svelte';
  import { t } from '../lib/i18n/index.svelte';
</script>

<div class="loading" role="status" aria-label={t().misc.loading}>
  <Skeleton width="55%" height="26px" radius="8px" />
  <Skeleton lines={3} height="15px" />
  <Skeleton height="96px" radius="16px" />
</div>

<style>
  .loading {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 24px 4px;
  }
</style>
