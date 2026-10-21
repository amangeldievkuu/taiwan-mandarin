<script lang="ts">
  import Seal from '../ui/Seal.svelte';
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">AI conversation</p>
      <h1 class="title"><span class="zh">對話</span>Talk</h1>
    </div>
  </header>
  <div class="empty">
    <Seal text="談" size={64} outline />
    <p>Conversation practice needs an account. It arrives with sync.</p>
  </div>
</div>
