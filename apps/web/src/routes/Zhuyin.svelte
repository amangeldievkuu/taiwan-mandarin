<script lang="ts">
  // The Zhuyin course (注音): twelve lessons, each in three parts: meet its letters (heard in a
  // syllable read by the device's voice, and in Novice words), practise them, and a seal at the
  // end. Finished lessons are a synced setting (settings.zhuyin). Data: packages/shared
  // zhuyin-course.ts; the questions: lib/zhuyin/quiz.ts.
  import {
    nextZhuyinLesson,
    TONE_DEMO,
    toToneMarked,
    ZHUYIN_LESSONS,
    ZHUYIN_PINYIN,
    zhuyinString,
    type Word,
    type ZhuyinLesson,
  } from '@taiwan-mandarin/shared';
  import BackButton from '../ui/BackButton.svelte';
  import Icon from '../ui/Icon.svelte';
  import Localized from '../ui/Localized.svelte';
  import Seal from '../ui/Seal.svelte';
  import Speak from '../ui/Speak.svelte';
  import { content } from '../lib/content.svelte';
  import { feedback } from '../lib/feedback.svelte';
  import { glossOf } from '../lib/i18n/content';
  import { t } from '../lib/i18n/index.svelte';
  import { canSpeak, speak, stopSpeaking } from '../lib/speech';
  import { store } from '../lib/store.svelte';
  import { buildQuiz, examplesFor, type Question } from '../lib/zhuyin/quiz';

  /** A question, and whether it is the second go at one answered wrong. */
  type Asked = Question & { retry?: boolean };

  // Examples and questions come from Novice 1 and 2.
  $effect(() => void content.ensureLevels(['N1', 'N2']));
  const words: Word[] = $derived([...content.level('N1'), ...content.level('N2')]);
  const wordsReady = $derived(content.isLoaded('N1'));

  const done = $derived(store.settings.zhuyin ?? []);

  let lesson = $state<ZhuyinLesson | null>(null);
  let step = $state<'meet' | 'quiz' | 'done'>('meet');
  /** The letter card shown while meeting a lesson's letters. */
  let card = $state(0);
  let questions = $state<Asked[]>([]);
  let at = $state(0);
  let chosen = $state<string | null>(null);
  /** Questions answered right the first time, of the lesson's own (retries aside). */
  let firstTime = $state(0);
  let total = $state(0);
  let advance: ReturnType<typeof setTimeout> | undefined;

  const question = $derived(questions[at]);
  const letters = $derived(lesson?.letters ?? []);
  const letter = $derived(letters[card]);

  $effect(() => () => {
    clearTimeout(advance);
    stopSpeaking();
  });

  function open(next: ZhuyinLesson) {
    clearTimeout(advance);
    lesson = next;
    card = 0;
    chosen = null;
    // The words lesson has no letters to meet: it starts with its introduction and a Start button.
    step = 'meet';
    scrollTo({ top: 0 });
    const first = next.letters[0];
    if (first) speak(first.sound.char);
  }

  function leave() {
    clearTimeout(advance);
    stopSpeaking();
    lesson = null;
    scrollTo({ top: 0 });
  }

  function showCard(index: number) {
    card = index;
    const shown = letters[index];
    if (shown) speak(shown.sound.char);
  }

  function practise() {
    if (!lesson) return;
    questions = buildQuiz(lesson, words, Math.random);
    total = questions.length;
    firstTime = 0;
    step = 'quiz';
    ask(0);
  }

  function ask(index: number) {
    clearTimeout(advance);
    at = index;
    chosen = null;
    const q = questions[index];
    if (q) play(q);
  }

  function play(q: Question) {
    if (q.kind === 'letter') speak(q.sound.char);
    else if (q.kind === 'word') speak(q.word.hanzi);
    else if (q.kind === 'tone') speak(q.char);
  }

  function choose(option: string) {
    const q = question;
    if (!q || chosen !== null) return;
    chosen = option;
    const right = option === q.answer;
    feedback.play('grade');
    // The same for right and wrong, as in Study: a wrong answer is never a buzzer.
    feedback.buzz('light');
    if (right && !q.retry) firstTime++;
    // Wrong the first time: once more at the end.
    if (!right && !q.retry) questions = [...questions, { ...q, retry: true }];
    if (right) advance = setTimeout(next, 900);
  }

  function next() {
    if (at + 1 < questions.length) ask(at + 1);
    else finish();
  }

  function finish() {
    clearTimeout(advance);
    if (!lesson) return;
    step = 'done';
    feedback.play('stamp');
    feedback.buzz('success');
    if (!done.includes(lesson.id)) {
      void store.updateSettings({ zhuyin: [...done, lesson.id] });
    }
  }

  /** A word's Zhuyin, split so the lesson's letter can be marked. */
  const marked = (zhuyin: string, mark: string) =>
    [...zhuyin].map((char) => ({ char, on: char === mark }));

  /** What the lessons list shows of each lesson. */
  const preview = (l: ZhuyinLesson) =>
    l.letters.length
      ? l.letters.map((x) => x.letter).join('')
      : l.id === 'tones'
        ? 'ˉ ˊ ˇ ˋ ˙'
        : 'ㄋㄧˇ ㄏㄠˇ';
</script>

<div class="page zhuyin">
  {#if !lesson}
    <header class="page-head">
      <div>
        <BackButton parent="/path" />
        <p class="eyebrow">{t().zhuyin.eyebrow}</p>
        <h1 class="title"><span class="zh">注音</span>{t().titles.zhuyin}</h1>
      </div>
    </header>
    <p class="intro">{t().zhuyin.intro}</p>
    <p class="count tabular">{t().zhuyin.lessonsDone(done.length, ZHUYIN_LESSONS.length)}</p>

    <ol class="lessons">
      {#each ZHUYIN_LESSONS as l, i (l.id)}
        {@const finished = done.includes(l.id)}
        <li class="enter" style:--i={i}>
          <button type="button" class="lesson sheet pressable" onclick={() => open(l)}>
            <Seal text={l.zh} size={48} outline={!finished} />
            <span class="lesson-body">
              <strong>{i + 1}. {t().zhuyin.lessons[l.id].name}</strong>
              <span class="lesson-letters hanzi" lang="zh-Hant-TW">{preview(l)}</span>
            </span>
            {#if finished}<span class="tick"><Icon name="check" size={18} /></span>{/if}
          </button>
        </li>
      {/each}
    </ol>
  {:else}
    {@const info = t().zhuyin.lessons[lesson.id]}
    <header class="lesson-head">
      <button type="button" class="btn quiet small" onclick={leave}>
        <Icon name="back" size={16} />
        {t().zhuyin.allLessons}
      </button>
      <h1 class="lesson-title">
        <span class="zh" lang="zh-Hant-TW">{lesson.zh}</span>
        {info.name}
      </h1>
    </header>

    {#if step === 'meet'}
      <p class="intro">{info.intro}</p>

      {#if letter}
        <article class="meet sheet">
          <p class="of tabular">{t().zhuyin.letterOf(card + 1, letters.length)}</p>
          <div class="big hanzi" lang="zh-Hant-TW">{letter.letter}</div>
          <p class="pinyin">{ZHUYIN_PINYIN[letter.letter]}</p>
          {#if canSpeak}
            <button type="button" class="btn quiet hear" onclick={() => speak(letter.sound.char)}>
              <Icon name="speaker" size={18} />
              {t().zhuyin.hear}
              <span class="hanzi" lang="zh-Hant-TW">{letter.sound.char}</span>
              <span class="hanzi soft" lang="zh-Hant-TW">{zhuyinString(letter.sound.pinyin)}</span>
              <span class="soft">{toToneMarked(letter.sound.pinyin)}</span>
            </button>
          {/if}
          <Speak target={letter.sound.char} pinyin={letter.sound.pinyin} />

          {#if wordsReady}
            {@const examples = examplesFor(letter.letter, words)}
            {#if examples.length}
              <h2 class="section-title">{t().zhuyin.inWords}</h2>
              <ul class="examples">
                {#each examples as w (w.id)}
                  <li>
                    <button type="button" class="example" onclick={() => speak(w.hanzi)}>
                      <span class="ex-hanzi hanzi" lang="zh-Hant-TW">{w.hanzi}</span>
                      <span class="ex-zhuyin hanzi" lang="zh-Hant-TW"
                        >{#each marked(zhuyinString(w.pinyin), letter.letter) as part, j (j)}{#if part.on}<mark
                              >{part.char}</mark
                            >{:else}{part.char}{/if}{/each}</span
                      >
                      <span class="ex-gloss"><Localized value={glossOf(w)} /></span>
                      {#if canSpeak}<Icon name="speaker" size={16} />{/if}
                    </button>
                  </li>
                {/each}
              </ul>
            {/if}
          {:else}
            <p class="soft">{t().zhuyin.loading}</p>
          {/if}
        </article>

        <div class="actions">
          {#if card > 0}
            <button type="button" class="btn quiet" onclick={() => showCard(card - 1)}>
              <Icon name="back" size={16} />
            </button>
          {/if}
          {#if card + 1 < letters.length}
            <button type="button" class="btn primary" onclick={() => showCard(card + 1)}>
              {t().zhuyin.next}
            </button>
          {:else}
            <button type="button" class="btn primary" disabled={!wordsReady} onclick={practise}>
              {t().zhuyin.practise}
            </button>
          {/if}
        </div>
      {:else if lesson.id === 'tones'}
        <ul class="tones sheet">
          {#each TONE_DEMO as tone, i (tone.char)}
            <li>
              <button type="button" class="tone" onclick={() => speak(tone.char)}>
                <span class="tone-mark hanzi" lang="zh-Hant-TW">{tone.mark}</span>
                <span class="tone-char hanzi" lang="zh-Hant-TW">{tone.char}</span>
                <span class="tone-zy hanzi" lang="zh-Hant-TW">{zhuyinString(tone.pinyin)}</span>
                <span class="tone-name">{t().zhuyin.toneNames[i]}</span>
                {#if canSpeak}<Icon name="speaker" size={16} />{/if}
              </button>
            </li>
          {/each}
        </ul>
        <div class="actions">
          <button type="button" class="btn primary" onclick={practise}>{t().zhuyin.practise}</button
          >
        </div>
      {:else}
        <div class="actions">
          <button type="button" class="btn primary" disabled={!wordsReady} onclick={practise}>
            {wordsReady ? t().zhuyin.start : t().zhuyin.loading}
          </button>
        </div>
      {/if}
    {:else if step === 'quiz' && question}
      <div class="bar" aria-hidden="true">
        <span style:transform="translateX({(at / questions.length) * 100 - 100}%)"></span>
      </div>
      <section class="quiz sheet" aria-live="polite">
        <p class="prompt">{t().zhuyin.ask[question.kind]}</p>
        {#if question.kind === 'pinyin'}
          <div class="big hanzi" lang="zh-Hant-TW">{question.letter}</div>
        {:else if canSpeak}
          <button type="button" class="btn quiet play" onclick={() => play(question)}>
            <Icon name="speaker" size={22} />
            {t().zhuyin.playAgain}
          </button>
        {/if}
        <div class="options" class:wide={question.kind === 'word'}>
          {#each question.options as option (option)}
            <button
              type="button"
              class="option"
              class:right={chosen !== null && option === question.answer}
              class:wrong={chosen === option && option !== question.answer}
              disabled={chosen !== null}
              onclick={() => choose(option)}
            >
              {#if question.kind === 'pinyin'}{option}{:else}<span class="hanzi" lang="zh-Hant-TW"
                  >{option}</span
                >{/if}
            </button>
          {/each}
        </div>
        {#if chosen !== null}
          <div class="feedback">
            {#if chosen === question.answer}
              <p class="good">{t().zhuyin.right}</p>
            {:else}
              <p class="bad">
                {t().zhuyin.wrong(question.answer)}
                {#if !question.retry}{t().zhuyin.comesBack}{/if}
              </p>
            {/if}
            {#if question.kind === 'word'}
              <p class="answer-word">
                <span class="hanzi" lang="zh-Hant-TW">{question.word.hanzi}</span>
                <Localized value={glossOf(question.word)} />
              </p>
            {/if}
            <button type="button" class="btn primary" onclick={next}>{t().zhuyin.continue}</button>
          </div>
        {/if}
      </section>
    {:else if step === 'done'}
      {@const after = nextZhuyinLesson(lesson.id)}
      <section class="finished sheet">
        <Seal text={lesson.zh} size={96} />
        <h2>{t().zhuyin.done}</h2>
        <p class="tabular">{t().zhuyin.doneScore(firstTime, total)}</p>
        {#if ZHUYIN_LESSONS.every((l) => done.includes(l.id))}
          <p>{t().zhuyin.finished}</p>
        {/if}
        <div class="actions">
          {#if after}
            <button type="button" class="btn primary" onclick={() => open(after)}>
              {t().zhuyin.nextLesson}
            </button>
          {/if}
          <button type="button" class="btn quiet" onclick={practise}>
            {t().zhuyin.practiseAgain}
          </button>
          <button type="button" class="btn quiet" onclick={leave}>{t().zhuyin.allLessons}</button>
        </div>
      </section>
    {/if}
  {/if}
</div>

<style>
  .count {
    margin: 4px 0 14px;
    color: var(--ink-3);
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .lessons {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .lesson {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 16px;
    text-align: start;
  }
  .lesson-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }
  .lesson-letters {
    font-size: 20px;
    letter-spacing: 0.08em;
    color: var(--ink-3);
  }
  .tick {
    display: inline-flex;
    color: var(--jade-text);
  }

  .lesson-head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }
  .lesson-title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
    font-size: var(--fs-xl);
  }
  .lesson-title .zh {
    font-family: var(--font-kai);
    color: var(--seal);
  }

  .meet,
  .quiz,
  .finished {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px 18px 22px;
    text-align: center;
  }
  .of {
    margin: 0;
    color: var(--ink-3);
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .big {
    font-size: 104px;
    line-height: 1.1;
  }
  .pinyin {
    margin: 0;
    font-size: 26px;
    font-weight: 800;
  }
  .hear {
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
  }
  .soft {
    color: var(--ink-3);
  }

  .examples {
    display: grid;
    gap: 6px;
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .example {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--rule);
    border-radius: var(--radius);
    background: var(--paper-raised);
    text-align: start;
  }
  .ex-hanzi {
    font-size: 24px;
  }
  .ex-zhuyin {
    font-size: 18px;
    color: var(--ink-3);
  }
  .ex-zhuyin mark {
    border-radius: 4px;
    background: var(--gold-wash);
    color: var(--gold-deep);
    font-weight: 700;
  }
  .ex-gloss {
    min-width: 0;
    overflow: hidden;
    font-size: var(--fs-sm);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tones {
    display: grid;
    gap: 2px;
    margin: 0 0 14px;
    padding: 8px;
    list-style: none;
  }
  .tone {
    display: grid;
    grid-template-columns: 2.2em 2.2em 4em 1fr auto;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    text-align: start;
  }
  .tone-mark {
    font-size: 30px;
    color: var(--seal);
    text-align: center;
  }
  .tone-char {
    font-size: 28px;
  }
  .tone-zy {
    font-size: 18px;
    color: var(--ink-3);
  }
  .tone-name {
    font-size: var(--fs-sm);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin: 16px 0;
  }

  .bar {
    overflow: hidden;
    height: 6px;
    margin-bottom: 14px;
    border-radius: var(--radius-pill);
    background: var(--paper-sunken);
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--seal);
    transition: transform var(--dur) var(--ease);
  }
  .prompt {
    margin: 0;
    font-size: var(--fs-lg);
    font-weight: 700;
  }
  .options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
    gap: 10px;
    width: 100%;
    margin-top: 6px;
  }
  .options.wide {
    grid-template-columns: 1fr;
  }
  .option {
    min-height: 58px;
    padding: 8px 12px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--radius);
    background: var(--paper-raised);
    font-size: 26px;
    font-weight: 700;
    transition:
      background-color var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }
  .options.wide .option {
    font-size: 22px;
  }
  .option.right {
    border-color: var(--good);
    background: color-mix(in oklab, var(--paper-raised) 80%, var(--good));
  }
  .option.wrong {
    border-color: var(--again);
    background: color-mix(in oklab, var(--paper-raised) 80%, var(--again));
  }
  .option:disabled {
    cursor: default;
  }
  .feedback {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
  }
  .feedback p {
    margin: 0;
  }
  .good {
    color: var(--jade-text);
    font-weight: 800;
  }
  .bad {
    font-weight: 700;
  }
  .answer-word {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .answer-word .hanzi {
    font-size: 24px;
  }
  .finished h2 {
    margin: 6px 0 0;
  }
  .finished p {
    margin: 0;
  }
</style>
