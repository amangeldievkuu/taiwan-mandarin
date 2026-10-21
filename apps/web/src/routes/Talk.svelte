<script lang="ts">
  // Conversation practice with an AI partner who speaks only with words you know, in Taiwan style.
  import {
    SCENARIOS,
    type ScenarioId,
    type TalkMessage,
    type TalkResponse,
  } from '@taiwan-mandarin/shared/api';
  import HanziText from '../ui/HanziText.svelte';
  import Icon from '../ui/Icon.svelte';
  import Seal from '../ui/Seal.svelte';
  import SignInPrompt from '../ui/SignInPrompt.svelte';
  import { api } from '../lib/api';
  import { lookup } from '../lib/lookup.svelte';
  import { canSpeak, speak } from '../lib/speech';
  import { account } from '../lib/sync.svelte';

  interface Recent {
    id: string;
    scenario: ScenarioId;
    updatedAt: string;
    last: string;
  }

  let status = $state<{ available: boolean; used: number; limit: number } | null>(null);
  let recent = $state<Recent[]>([]);
  let conversationId = $state<string | null>(null);
  let scenario = $state<ScenarioId>('free');
  let messages = $state<TalkMessage[]>([]);
  let draft = $state('');
  let sending = $state(false);
  let error = $state<string | null>(null);
  let showTranslation = $state<Record<string, boolean>>({});
  let showCorrection = $state<Record<string, boolean>>({});
  let thread = $state<HTMLElement>();

  $effect(() => {
    if (!account.user) return;
    void api<typeof status>('/v1/ai/status').then(
      (s) => (status = s),
      () => undefined,
    );
    void api<Recent[]>('/v1/ai/talk').then(
      (r) => (recent = r),
      () => undefined,
    );
  });

  async function scrollDown() {
    await Promise.resolve();
    thread?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  async function send(message = draft.trim()) {
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
      conversationId = res.conversationId;
      messages = [...messages.filter((m) => m.id !== pending?.id), ...res.messages];
      const reply = res.messages.at(-1);
      if (reply && canSpeak) void speak(reply.content);
      void scrollDown();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      if (pending) {
        messages = messages.filter((m) => m.id !== pending.id);
        draft = message;
      }
    } finally {
      sending = false;
    }
  }

  async function start(id: ScenarioId) {
    scenario = id;
    conversationId = null;
    messages = [];
    await send('');
  }

  async function resume(item: Recent) {
    const res = await api<{ scenario: ScenarioId; messages: TalkMessage[] }>(
      `/v1/ai/talk/${item.id}`,
    );
    conversationId = item.id;
    scenario = res.scenario;
    messages = res.messages;
    void scrollDown();
  }

  function leave() {
    conversationId = null;
    messages = [];
    void api<Recent[]>('/v1/ai/talk').then(
      (r) => (recent = r),
      () => undefined,
    );
  }

  const scenarioInfo = $derived(SCENARIOS.find((s) => s.id === scenario));
</script>

<div class="page talk">
  {#if !conversationId && messages.length === 0}
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
            class="scenario sheet"
            disabled={sending}
            onclick={() => start(s.id)}
          >
            <span class="s-zh hanzi" lang="zh-Hant-TW">{s.zh}</span>
            <span class="s-en">{s.en}</span>
          </button>
        {/each}
      </div>
      {#if recent.length}
        <h2 class="section-title">Continue <span class="zh" lang="zh-Hant-TW">繼續</span></h2>
        <ul class="list">
          {#each recent as item (item.id)}
            <li>
              <button type="button" class="row" onclick={() => resume(item)}>
                <span class="row-main">
                  <strong>{SCENARIOS.find((s) => s.id === item.scenario)?.en}</strong>
                  <span class="row-sub hanzi" lang="zh-Hant-TW">{item.last}</span>
                </span>
                <span class="row-value">{new Date(item.updatedAt).toLocaleDateString()}</span>
              </button>
            </li>
          {/each}
        </ul>
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
      <div>
        <strong class="hanzi" lang="zh-Hant-TW">{scenarioInfo?.zh}</strong>
        <small>{scenarioInfo?.en}</small>
      </div>
    </header>

    <ol class="thread" bind:this={thread}>
      {#each messages as m (m.id)}
        <li class="msg {m.role}">
          {#if m.role === 'assistant'}
            <div class="bubble">
              <HanziText text={m.content} class="bubble-zh" />
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
                <p>{m.correction.explanation}</p>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
      {#if sending}
        <li class="msg assistant">
          <div class="bubble typing" aria-label="Typing">
            <span></span><span></span><span></span>
          </div>
        </li>
      {/if}
    </ol>
    {#if error}<p class="error" role="alert">{error}</p>{/if}

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
      <button class="send" type="submit" aria-label="Send" disabled={!draft.trim() || sending}>
        <Icon name="send" />
      </button>
    </form>
    <p class="hint">Tap any word for its reading and meaning.</p>
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
    transition:
      transform var(--dur) var(--ease),
      border-color var(--dur) var(--ease);
  }

  @media (hover: hover) {
    .scenario:hover {
      transform: translateY(-2px);
      border-color: var(--rule-strong);
    }
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

  .chat-head div {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
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
  }

  .msg.user {
    align-self: flex-end;
    align-items: flex-end;
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
    background: var(--ink);
    color: var(--paper);
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

  .translation {
    margin: 4px 0 0;
    font-family: var(--font-serif);
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
    gap: 5px;
    padding: 18px 18px;
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
    background: var(--seal);
    color: var(--seal-ink);
  }

  .send:disabled {
    opacity: 0.35;
  }

  .hint {
    margin: 10px 4px 0;
    font-size: 12px;
    color: var(--ink-3);
  }

  .error {
    color: var(--seal);
  }
</style>
