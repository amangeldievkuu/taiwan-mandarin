<script lang="ts">
  // Where the words, dictionary, examples, stroke order and fonts come from.
  import SubpageHead from '../ui/SubpageHead.svelte';
  import { t } from '../lib/i18n/index.svelte';
  import { router } from '../lib/router.svelte';
</script>

<div class="page">
  <SubpageHead title={t().titles['me-about']} zh="關於" />

  <ul class="list">
    <li>
      <a class="row" href={router.href('/welcome')} onclick={router.link}>
        <span class="row-main">
          <span class="row-label">{t().about.tour}</span>
          <span class="row-sub">{t().about.tourSub}</span>
        </span>
        <svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"><path d="M1 1l6 6-6 6" /></svg>
      </a>
    </li>
  </ul>

  <div class="sheet about">
    <h2>{t().about.sources}</h2>
    <p>
      {t().about.wordLists}:
      <a href="https://tocfl.edu.tw" target="_blank" rel="noopener">TOCFL 華語八千詞表</a>
      (SC-TOP) {t().about.and}
      <a href="https://coct.naer.edu.tw" target="_blank" rel="noopener">NAER 臺灣華語文能力基準</a>.
    </p>
    <p>
      {t().about.dictionary}:
      <a href="https://cc-cedict.org" target="_blank" rel="noopener">CC-CEDICT</a> (CC BY-SA 4.0),
      {t().about.taiwanReadings}
    </p>
    <p>
      {t().about.examples}:
      <a href="https://tatoeba.org" target="_blank" rel="noopener">Tatoeba</a> (CC BY 2.0 FR)
      {t().about.ownSentences}
    </p>
    <p>{t().about.strokeOrder}: Make Me a Hanzi (Arphic Public License).</p>
    <p>{t().about.fonts}: LXGW WenKai TC, Nunito (OFL).</p>
  </div>
</div>

<style>
  .list {
    margin-bottom: 14px;
  }

  .row-label {
    display: block;
    font-weight: 700;
  }

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
