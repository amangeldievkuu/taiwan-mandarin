<script lang="ts">
  // A password input with a show/hide toggle, so a long passphrase can be checked before sending.
  interface Props {
    id: string;
    label: string;
    value: string;
    autocomplete: 'current-password' | 'new-password';
    minlength?: number;
    hint?: string;
  }

  let { id, label, value = $bindable(), autocomplete, minlength = 1, hint }: Props = $props();
  let shown = $state(false);
</script>

<label for={id}>
  <span>{label}</span>
  <span class="field">
    <input
      {id}
      name={id}
      type={shown ? 'text' : 'password'}
      {autocomplete}
      {minlength}
      maxlength="200"
      required
      bind:value
    />
    <button
      type="button"
      class="toggle"
      aria-pressed={shown}
      aria-label={shown ? 'Hide password' : 'Show password'}
      onclick={() => (shown = !shown)}>{shown ? 'Hide' : 'Show'}</button
    >
  </span>
  {#if hint}<small>{hint}</small>{/if}
</label>

<style>
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .field {
    position: relative;
    display: flex;
  }

  input {
    flex: 1;
    width: 100%;
    height: 46px;
    padding: 0 68px 0 14px;
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

  .toggle {
    position: absolute;
    top: 7px;
    right: 7px;
    height: 32px;
    padding: 0 10px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--ink-2);
    background: var(--fill);
  }

  small {
    font-weight: 500;
    color: var(--ink-3);
  }
</style>
