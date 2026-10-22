<script lang="ts" module>
  const READINGS_KEY = 'taiwan-mandarin:talk-readings';

  function savedReadings(): boolean {
    try {
      return localStorage.getItem(READINGS_KEY) !== 'off';
    } catch {
      return true;
    }
  }
</script>

<script lang="ts">
  // Conversation practice with an AI partner who speaks only with words you know, in Taiwan style.
  // Opening a situation or a saved conversation shows the thread at once, with the partner typing
  // (or the history loading), and every line can show its reading. Ending a conversation brings a
  // goodbye and a summary with its new words; finished ones are read-only and can be deleted.
  import {
    SCENARIOS,
    type ScenarioId,
    type TalkConversation,
    type TalkEndResponse,
    type TalkListItem,
    type TalkMessage,
    type TalkResponse,
    type TalkSummary,
  } from '@taiwan-mandarin/shared/api';
  import HanziText from '../ui/HanziText.svelte';
  import Icon from '../ui/Icon.svelte';
  import Reading from '../ui/Reading.svelte';
  import Seal from '../ui/Seal.svelte';
  import SignInPrompt from '../ui/SignInPrompt.svelte';
  import Skeleton from '../ui/Skeleton.svelte';
  import { api } from '../lib/api';
  import { content } from '../lib/content.svelte';
  import { lookup } from '../lib/lookup.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { store } from '../lib/store.svelte';
  import { account } from '../lib/sync.svelte';

  let status = $state<{ available: boolean; used: number; limit: number } | null>(null);
  let recent = $state<TalkListItem[]>([]);
  const ongoing = $derived(recent.filter((c) => !c.endedAt));
  const finished = $derived(recent.filter((c) => c.endedAt));
  /** The conversation row asking "Delete?". */
  let confirmDelete = $state<string | null>(null);
  let listError = $state<string | null>(null);
  let conversationId = $state<string | null>(null);
  let scenario = $state<ScenarioId>('free');
  let messages = $state<TalkMessage[]>([]);
  let draft = $state('');
  /** In a conversation, or opening one. */
  let open = $state(false);
  let sending = $state(false);
  /** A saved conversation's messages are on their way. */
  let loading = $state(false);
  /** Asking "End this conversation?" in place of the composer. */
  let confirmEnd = $state(false);
  /** Waiting for the partner's goodbye. */
  let ending = $state(false);
  /** Set once the conversation has ended: it is read-only and shows its summary. */
  let endedAt = $state<string | null>(null);
  let summary = $state<TalkSummary | null>(null);
  /** Bumped on every open and leave, so a late answer can't land in another conversation. */
  let session = 0;
  let showReadings = $state(savedReadings());
  let error = $state<string | null>(null);
  let showTranslation = $state<Record<string, boolean>>({});
  let showCorrection = $state<Record<string, boolean>>({});
  let thread = $state<HTMLElement>();

  $effect(() => {
    try {
      localStorage.setItem(READINGS_KEY, showReadings ? 'on' : 'off');
    } catch {
      // per-device preference only
    }
  });

  const readingsLabel = $derived(
    { pinyin: 'Pinyin', zhuyin: '注音', both: '注音 · Pinyin' }[store.settings.phonetics],
  );

  function refresh() {
    void api<typeof status>('/v1/ai/status').then(
      (s) => (status = s),
      () => undefined,
    );
    void api<TalkListItem[]>('/v1/ai/talk').then(
      (r) => (recent = r),
      () => undefined,
    );
  }

  $effect(() => {
    if (account.user) refresh();
  });

  async function scrollDown() {
    await Promise.resolve();
    thread?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function send(message = draft.trim()) {
    const mine = session;
    sending = true;
    error = null;
    const pending: TalkMessage | null = message
      ? { id: `pending-${Date.now()}`, role: 'user', content: message }
      : null;
    if (pending) messages = [...messages, pending];
    draft = '';
    void scrollDown();
    try {
      const res = await api<TalkResponse>('/v1/ai/talk', {
        method: 'POST',
        body: { ...(conversationId ? { conversationId } : {}), scenario, message },
      });
      if (mine !== session) return;
      conversationId = res.conversationId;
      messages = [...messages.filter((m) => m.id !== pending?.id), ...res.messages];
      const reply = res.messages.at(-1);
      if (reply && canSpeak) void speak(reply.content);
      void scrollDown();
    } catch (e) {
      if (mine !== session) return;
      error = e instanceof Error ? e.message : String(e);
      if (pending) {
        messages = messages.filter((m) => m.id !== pending.id);
        draft = message;
      }
    } finally {
      if (mine === session) sending = false;
    }
  }

  function enter(id: ScenarioId, conversation: string | null) {
    session++;
    open = true;
    scenario = id;
    conversationId = conversation;
    messages = [];
    error = null;
    sending = false;
    confirmEnd = false;
    ending = false;
    endedAt = null;
    summary = null;
  }

  async function start(id: ScenarioId) {
    enter(id, null);
    await send('');
  }

  async function resume(item: TalkListItem) {
    enter(item.scenario, item.id);
    const mine = session;
    loading = true;
    try {
      const res = await api<TalkConversation>(`/v1/ai/talk/${item.id}`);
      if (mine !== session) return;
      scenario = res.scenario;
      messages = res.messages;
      endedAt = res.endedAt;
      summary = res.summary;
      void scrollDown();
    } catch (e) {
      if (mine === session) error = e instanceof Error ? e.message : String(e);
    } finally {
      if (mine === session) loading = false;
    }
  }

  async function end() {
    if (!conversationId) return;
    const mine = session;
    confirmEnd = false;
    ending = true;
    error = null;
    void scrollDown();
    try {
      const res = await api<TalkEndResponse>(`/v1/ai/talk/${conversationId}/end`, {
        method: 'POST',
      });
      if (mine !== session) return;
      if (res.message) {
        messages = [...messages, res.message];
        if (canSpeak) void speak(res.message.content);
      }
      endedAt = res.endedAt;
      summary = res.summary;
      refresh();
      void scrollDown();
    } catch (e) {
      if (mine === session) error = e instanceof Error ? e.message : String(e);
    } finally {
      if (mine === session) ending = false;
    }
  }

  async function remove(id: string) {
    confirmDelete = null;
    listError = null;
    const before = recent;
    recent = recent.filter((c) => c.id !== id);
    try {
      await api(`/v1/ai/talk/${id}`, { method: 'DELETE' });
    } catch (e) {
      recent = before;
      listError = e instanceof Error ? e.message : String(e);
    }
  }

  function leave() {
    session++;
    open = false;
    sending = false;
    loading = false;
    ending = false;
    confirmEnd = false;
    error = null;
    conversationId = null;
    messages = [];
    refresh();
  }

  /** A new word's place in the learner's study: already learning it, queued, or not yet. */
  const deckState = (id: string): 'learning' | 'deck' | 'add' =>
    store.cards[id] ? 'learning' : store.inDeck(id) ? 'deck' : 'add';
  const addable = $derived(
    (summary?.newWords ?? []).flatMap((w) =>
      w.wordId && deckState(w.wordId) === 'add' ? [w.wordId] : [],
    ),
  );

  async function addToDeck(ids: string[]) {
    for (const id of ids) {
      const word = await content.findWord(id);
      if (word) store.addToDeck(word);
    }
  }

  const scenarioInfo = $derived(SCENARIOS.find((s) => s.id === scenario));
</script>

<div class="page talk">
  {#if !open}
    <header class="page-head">
      <div>
        <p class="eyebrow">Conversation practice · 會話練習</p>
        <h1 class="title"><span class="zh">對話</span>Talk</h1>
      </div>
    </header>
    <p class="intro">
      Practise real situations in Taiwan. Your partner speaks Taiwan Mandarin using only words
      you've studied, corrects what you write, and marks any new word so you can tap it.
    </p>

    {#if !account.user}
      {#if account.checked}<SignInPrompt seal="談" text="Sign in to practise conversations." />{/if}
    {:else if status && !status.available}
      <p class="empty">Conversation practice isn't set up on this server yet.</p>
    {:else}
      <h2 class="section-title">
        Choose a situation <span class="zh" lang="zh-Hant-TW">情境</span>
      </h2>
      <div class="scenarios">
        {#each SCENARIOS as s (s.id)}
          <button
            type="button"
            class="scenario sheet pressable"
            disabled={sending}
            onclick={() => start(s.id)}
          >
            <span class="s-zh hanzi" lang="zh-Hant-TW">{s.zh}</span>
            <span class="s-en">{s.en}</span>
          </button>
        {/each}
      </div>
      {#snippet conversations(items: TalkListItem[], label: string)}
        <ul class="list" aria-label={label}>
          {#each items as item (item.id)}
            <li class="convo">
              <button type="button" class="row" onclick={() => resume(item)}>
                <span class="row-main">
                  <strong>{SCENARIOS.find((s) => s.id === item.scenario)?.en}</strong>
                  <span class="row-sub hanzi" lang="zh-Hant-TW">{item.last}</span>
                </span>
                <span class="row-value">{new Date(item.updatedAt).toLocaleDateString()}</span>
              </button>
              {#if confirmDelete === item.id}
                <span class="confirm-delete">
                  <button
                    type="button"
                    class="btn small quiet"
                    onclick={() => (confirmDelete = null)}>Cancel</button
                  >
                  <button type="button" class="btn small seal" onclick={() => remove(item.id)}
                    >Delete</button
                  >
                </span>
              {:else}
                <button
                  type="button"
                  class="delete"
                  aria-label="Delete this conversation"
                  onclick={() => (confirmDelete = item.id)}><Icon name="trash" size={18} /></button
                >
              {/if}
            </li>
          {/each}
        </ul>
      {/snippet}
      {#if listError}<p class="error" role="alert">{listError}</p>{/if}
      {#if ongoing.length}
        <h2 class="section-title">Continue <span class="zh" lang="zh-Hant-TW">繼續</span></h2>
        {@render conversations(ongoing, 'Conversations in progress')}
      {/if}
      {#if finished.length}
        <h2 class="section-title">Finished <span class="zh" lang="zh-Hant-TW">完成</span></h2>
        {@render conversations(finished, 'Finished conversations')}
      {/if}
      {#if status}<p class="footnote">
          {status.used} of {status.limit} AI messages used today.
        </p>{/if}
    {/if}
  {:else}
    <header class="chat-head">
      <button type="button" class="back" onclick={leave} aria-label="All conversations"
        ><Icon name="back" /></button
      >
      <Seal text="談" size={34} />
      <div class="chat-title">
        <strong class="hanzi" lang="zh-Hant-TW">{scenarioInfo?.zh}</strong>
        <small>{scenarioInfo?.en}</small>
      </div>
      <button
        type="button"
        class="chip readings-toggle"
        aria-pressed={showReadings}
        onclick={() => (showReadings = !showReadings)}
      >
        {readingsLabel}
      </button>
      {#if conversationId && !endedAt && !loading}
        <button
          type="button"
          class="btn small quiet end-chat"
          disabled={sending || ending}
          onclick={() => (confirmEnd = true)}>End</button
        >
      {/if}
    </header>

    <ol class="thread" bind:this={thread}>
      {#each messages as m (m.id)}
        <li class="msg {m.role}">
          {#if m.role === 'assistant'}
            <div class="bubble">
              <HanziText text={m.content} class="bubble-zh" />
              {#if showReadings && m.reading}
                <p class="reading-line">
                  <Reading
                    pinyin={m.reading.pinyin}
                    text={m.content}
                    wordLengths={m.reading.wordLengths}
                  />
                </p>
              {/if}
              <div class="tools">
                {#if canSpeak}
                  <button type="button" aria-label="Listen" onclick={() => speak(m.content)}
                    ><Icon name="speaker" size={16} /></button
                  >
                {/if}
                <button
                  type="button"
                  onclick={() => (showTranslation[m.id] = !showTranslation[m.id])}
                >
                  {showTranslation[m.id] ? 'Hide' : 'English'}
                </button>
              </div>
              {#if showTranslation[m.id] && m.translation}<p class="translation">
                  {m.translation}
                </p>{/if}
              {#if m.newWords?.length}
                <div class="new">
                  <span>New:</span>
                  {#each m.newWords as w (w.text)}
                    <button type="button" class="chip" onclick={() => lookup.openWord(w.text)}>
                      <span class="hanzi" lang="zh-Hant-TW">{w.text}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <div class="bubble">
              <span class="hanzi" lang="zh-Hant-TW">{m.content}</span>
              {#if m.correction}
                <button
                  type="button"
                  class="fix"
                  onclick={() => (showCorrection[m.id] = !showCorrection[m.id])}
                >
                  <span lang="zh-Hant-TW">修正</span>
                </button>
              {/if}
            </div>
            {#if m.correction && showCorrection[m.id]}
              <div class="correction">
                <HanziText text={m.correction.corrected} class="corr-zh" />
                {#if showReadings && m.correction.reading}
                  <p class="reading-line">
                    <Reading
                      pinyin={m.correction.reading.pinyin}
                      text={m.correction.corrected}
                      wordLengths={m.correction.reading.wordLengths}
                    />
                  </p>
                {/if}
                <p>{m.correction.explanation}</p>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
      {#if loading}
        <li class="history-loading" role="status" aria-label="Loading the conversation">
          <div class="ghost"><Skeleton lines={2} height="18px" /></div>
          <div class="ghost mine"><Skeleton width="70%" height="18px" /></div>
          <div class="ghost"><Skeleton lines={2} height="18px" /></div>
        </li>
      {:else if sending || ending}
        <li class="msg assistant" role="status">
          <div class="bubble typing">
            <span></span><span></span><span></span>
          </div>
          <span class="typing-label"
            >{ending
              ? 'Saying goodbye…'
              : messages.length
                ? 'Typing…'
                : `Starting “${scenarioInfo?.en}”…`}</span
          >
        </li>
      {/if}
    </ol>
    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        {#if !messages.length && !conversationId && !sending}
          <button type="button" class="btn small quiet" onclick={() => start(scenario)}>
            Try again
          </button>
        {/if}
      </div>
    {/if}

    {#if summary}
      <section class="summary sheet enter" aria-label="How the conversation went">
        <header class="summary-head">
          <Seal text="完" size={42} />
          <div>
            <p class="eyebrow" lang="zh-Hant-TW">對話結束 · Conversation finished</p>
            <strong>{summary.sent ? 'Nice work!' : 'See you next time'}</strong>
          </div>
        </header>
        <dl class="facts">
          <div>
            <dt>Messages sent</dt>
            <dd>{summary.sent}</dd>
          </div>
          <div>
            <dt>Corrected</dt>
            <dd>{summary.corrected}<small> of {summary.sent}</small></dd>
          </div>
          <div>
            <dt>New words</dt>
            <dd>{summary.newWords.length}</dd>
          </div>
        </dl>
        {#if summary.newWords.length}
          <div class="words-head">
            <h3>New words <span class="zh" lang="zh-Hant-TW">生詞</span></h3>
            {#if addable.length > 1}
              <button type="button" class="btn small quiet" onclick={() => addToDeck(addable)}>
                <Icon name="plus" size={16} /> Add all {addable.length}
              </button>
            {/if}
          </div>
          <ul class="words">
            {#each summary.newWords as w (w.text)}
              <li>
                <button type="button" class="word" onclick={() => lookup.openWord(w.text)}>
                  <span class="word-zh hanzi" lang="zh-Hant-TW">{w.text}</span>
                  <span class="word-meta">
                    {#if w.pinyin}<Reading pinyin={w.pinyin} />{/if}
                    {#if w.gloss}<span class="gloss">{w.gloss}</span>{/if}
                  </span>
                </button>
                {#if w.wordId}
                  {@const wordId = w.wordId}
                  {@const state = deckState(wordId)}
                  {#if state === 'add'}
                    <button
                      type="button"
                      class="btn small primary"
                      onclick={() => addToDeck([wordId])}><Icon name="plus" size={16} /> Add</button
                    >
                  {:else}
                    <span class="added"
                      ><Icon name="check" size={16} />
                      {state === 'deck' ? 'In deck' : 'Learning'}</span
                    >
                  {/if}
                {/if}
              </li>
            {/each}
          </ul>
          <p class="footnote">Added words come up first in your next study session.</p>
        {/if}
        <div class="summary-actions">
          {#if status}<span class="usage">{status.used} of {status.limit} AI messages today</span
            >{/if}
          <button type="button" class="btn primary" onclick={leave}>New conversation</button>
        </div>
      </section>
    {:else if endedAt}
      <!-- Ended, summary not loaded (shouldn't happen): still read-only. -->
      <p class="footnote">This conversation has ended.</p>
    {:else if confirmEnd}
      <div class="confirm-end sheet" role="alertdialog" aria-labelledby="end-title">
        <p>
          <strong id="end-title">End this conversation?</strong> Your partner will say goodbye and you'll
          see what you practised. It moves to Finished.
        </p>
        <div class="confirm-actions">
          <button type="button" class="btn small quiet" onclick={() => (confirmEnd = false)}
            >Keep talking</button
          >
          <button type="button" class="btn small primary" onclick={end}>End chat</button>
        </div>
      </div>
    {:else if !ending}
      <form
        class="composer"
        onsubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && !sending) void send();
        }}
      >
        <input
          bind:value={draft}
          placeholder="用中文回答… (English is OK too)"
          lang="zh-Hant-TW"
          autocomplete="off"
          enterkeyhint="send"
        />
        <button
          class="send"
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || sending || loading}
        >
          <Icon name="send" />
        </button>
      </form>
      <p class="hint">Tap any word for its reading and meaning.</p>
    {/if}
  {/if}
</div>

<style>
  .intro {
    margin: -8px 0 8px;
    max-width: 60ch;
    color: var(--ink-2);
  }

  .scenarios {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 10px;
  }

  .scenario {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 16px;
    text-align: left;
  }

  .s-zh {
    font-size: 24px;
  }

  .s-en {
    font-size: 14px;
    color: var(--ink-2);
  }

  .chat-head {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 12px;
    margin: calc(-1 * var(--safe-top) - 20px) calc(-1 * var(--gutter)) 0;
    padding: calc(var(--safe-top) + 10px) var(--gutter) 10px;
    background: color-mix(in srgb, var(--paper) 90%, transparent);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--rule);
  }

  .chat-title {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    line-height: 1.2;
  }

  .readings-toggle,
  .end-chat {
    flex: none;
    min-height: 32px;
  }

  .chat-title strong,
  .chat-title small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A conversation row: open it, or delete it (asking first). */
  .convo {
    display: flex;
    align-items: center;
  }

  .convo .row {
    flex: 1;
    min-width: 0;
  }

  .delete {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    margin-right: 4px;
    border-radius: 50%;
    color: var(--ink-3);
    transition:
      color var(--dur) var(--ease),
      background-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .delete:hover {
      color: var(--seal);
      background: var(--seal-wash);
    }
  }

  .confirm-delete {
    display: flex;
    flex: none;
    gap: 6px;
    padding-right: 10px;
  }

  .chat-head strong {
    font-size: 20px;
    font-weight: 400;
  }

  .chat-head small {
    color: var(--ink-2);
  }

  .back {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--ink-2);
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 18px 0;
    padding: 0;
    list-style: none;
  }

  .msg {
    display: flex;
    flex-direction: column;
    max-width: min(560px, 88%);
    animation: bubble var(--dur-4) var(--ease-spring) backwards;
    transform-origin: bottom left;
  }

  @keyframes bubble {
    from {
      opacity: 0;
      transform: translateY(10px) scale(0.92);
    }
  }

  .msg.user {
    align-self: flex-end;
    align-items: flex-end;
    transform-origin: bottom right;
  }

  .bubble {
    position: relative;
    padding: 12px 16px;
    border-radius: 18px;
    font-size: 21px;
    line-height: 1.55;
  }

  .assistant .bubble {
    background: var(--paper-raised);
    border: 1px solid var(--rule);
    border-bottom-left-radius: 6px;
  }

  .user .bubble {
    background: var(--jade);
    color: var(--jade-ink);
    box-shadow: 0 1px 2px color-mix(in oklab, var(--jade-edge) 30%, transparent);
    border-bottom-right-radius: 6px;
  }

  .bubble :global(.bubble-zh) {
    font-size: 21px;
  }

  .tools {
    display: flex;
    gap: 4px;
    margin-top: 6px;
  }

  .tools button {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--ink-2);
  }

  .tools button:hover {
    background: var(--fill);
  }

  .reading-line {
    margin: 2px 0 0;
    font-size: 15px;
    line-height: 1.45;
  }

  /* Wrap between syllables, never inside one: Zhuyin counts as CJK, which may otherwise break
     anywhere, even before a tone mark. */
  .reading-line :global(.reading) {
    overflow-wrap: normal;
    word-break: keep-all;
  }

  .translation {
    margin: 4px 0 0;
    font-family: var(--font-display);
    font-size: 16px;
    color: var(--ink-2);
  }

  .new {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    font-size: 12px;
    color: var(--ink-2);
  }

  .new .chip {
    min-height: 28px;
    border-color: var(--seal);
    color: var(--seal);
  }

  .fix {
    margin-left: 8px;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--seal);
    color: var(--seal-ink);
    font-family: var(--font-kai);
    font-size: 13px;
    vertical-align: middle;
  }

  .correction {
    margin-top: 6px;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    background: var(--seal-wash);
    text-align: left;
  }

  .correction :global(.corr-zh) {
    font-size: 19px;
  }

  .correction p {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--ink-2);
  }

  .typing {
    display: flex;
    align-self: flex-start;
    gap: 5px;
    padding: 18px 18px;
  }

  .typing-label {
    margin: 6px 0 0 4px;
    font-size: 13px;
    color: var(--ink-3);
  }

  .history-loading {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .ghost {
    width: min(420px, 80%);
    padding: 14px 16px;
    border: 1px solid var(--rule);
    border-radius: 18px;
    border-bottom-left-radius: 6px;
    background: var(--paper-raised);
  }

  .ghost.mine {
    align-self: flex-end;
    width: min(260px, 55%);
    border-radius: 18px;
    border-bottom-right-radius: 6px;
  }

  .typing span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ink-3);
    animation: blink 1.2s infinite;
  }

  .typing span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes blink {
    50% {
      opacity: 0.25;
    }
  }

  .composer {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 8px);
    display: flex;
    gap: 8px;
    padding: 8px;
    border: 1px solid var(--rule-strong);
    border-radius: 999px;
    background: var(--paper-raised);
    box-shadow: var(--shadow);
  }

  @media (min-width: 700px) {
    .composer {
      bottom: 16px;
    }
  }

  .composer input {
    flex: 1;
    min-width: 0;
    padding: 0 12px;
    border: 0;
    background: transparent;
    font-size: 18px;
    outline: none;
  }

  .send {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--jade);
    box-shadow:
      inset 0 1px 0 rgb(255 255 255 / 0.18),
      0 1px 2px color-mix(in oklab, var(--jade-edge) 30%, transparent),
      0 4px 10px -4px color-mix(in oklab, var(--jade) 45%, transparent);
    transition:
      transform 160ms var(--ease-out),
      box-shadow 160ms var(--ease-out);
    color: var(--jade-ink);
  }

  .send:active:not(:disabled) {
    transform: scale(0.94);
    box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.14);
    transition-duration: 80ms;
  }

  .send:disabled {
    opacity: 0.35;
  }

  .confirm-end {
    position: sticky;
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 8px);
    padding: 14px 16px;
    box-shadow: var(--shadow-3);
  }

  @media (min-width: 700px) {
    .confirm-end {
      bottom: 16px;
    }
  }

  .confirm-end p {
    margin: 0;
    font-size: 15px;
    color: var(--ink-2);
  }

  .confirm-end strong {
    color: var(--ink);
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  /* The summary of a finished conversation. */
  .summary {
    margin-top: 4px;
    padding: 20px;
  }

  .summary-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .summary-head strong {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 18px 0 0;
  }

  .facts div {
    display: flex;
    flex-direction: column-reverse;
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    background: var(--fill);
  }

  .facts dt {
    font-size: 13px;
    color: var(--ink-2);
  }

  .facts dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    line-height: 1.15;
    font-variant-numeric: tabular-nums;
  }

  .facts small {
    font-size: 14px;
    font-weight: 600;
    color: var(--ink-3);
  }

  .words-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 20px 0 4px;
  }

  .words-head h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 800;
  }

  .words-head .zh {
    margin-left: 6px;
    font-family: var(--font-kai);
    font-weight: 400;
    color: var(--ink-3);
  }

  .words {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .words li {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-top: 1px solid var(--rule);
  }

  .word {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 14px;
    min-width: 0;
    padding: 4px;
    margin-left: -4px;
    border-radius: var(--radius-sm);
    text-align: left;
    transition: background-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .word:hover {
      background: var(--fill);
    }
  }

  .word-zh {
    flex: none;
    font-size: 26px;
    line-height: 1.2;
  }

  .word-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 14px;
  }

  .gloss {
    overflow: hidden;
    color: var(--ink-2);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .added {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: 700;
    color: var(--jade-text);
  }

  .summary-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 18px;
  }

  .usage {
    font-size: 13px;
    color: var(--ink-3);
  }

  .hint {
    margin: 10px 4px 0;
    font-size: 12px;
    color: var(--ink-3);
  }

  .error {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    color: var(--seal);
  }

  .error p {
    margin: 0;
  }
</style>
