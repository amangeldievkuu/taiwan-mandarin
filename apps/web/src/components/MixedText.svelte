<script lang="ts">
  // Text in the learner's language with Chinese in it: tags each Chinese run as zh-Hant-TW so
  // Taiwan glyph forms render even when the surrounding text is in another language.
  interface Props {
    text: string;
  }

  let { text }: Props = $props();

  const parts = $derived(text.split(/([\u3100-\u312f\u3400-\u9fff\uf900-\ufaff]+)/));
</script>

{#each parts as part, i (i)}{#if i % 2}<span lang="zh-Hant-TW">{part}</span
    >{:else}{part}{/if}{/each}
