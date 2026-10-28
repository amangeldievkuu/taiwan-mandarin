<script lang="ts">
  // Where the words, dictionary, examples, stroke order and fonts come from.
  import SubpageHead from '../ui/SubpageHead.svelte';
</script>

<div class="page">
  <SubpageHead title="About" zh="關於" />

  <div class="sheet about">
    <h2>Sources</h2>
    <p>
      Word lists: <a href="https://tocfl.edu.tw" target="_blank" rel="noopener"
        >TOCFL 華語八千詞表</a
      >
      (SC-TOP) and
      <a href="https://coct.naer.edu.tw" target="_blank" rel="noopener">NAER 臺灣華語文能力基準</a>.
    </p>
    <p>
      Dictionary: <a href="https://cc-cedict.org" target="_blank" rel="noopener">CC-CEDICT</a> (CC BY-SA
      4.0), with Taiwan readings applied.
    </p>
    <p>
      Examples: <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a> (CC BY 2.0 FR)
      and sentences written for this app.
    </p>
    <p>Stroke order: Make Me a Hanzi (Arphic Public License).</p>
    <p>Fonts: LXGW WenKai TC and Nunito (OFL).</p>
  </div>
</div>

<style>
  .about {
    padding: 16px 18px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--ink-2);
  }

  h2 {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 800;
    color: var(--ink);
  }

  p {
    margin: 0 0 8px;
  }

  a {
    color: var(--sky-text);
  }
</style>
