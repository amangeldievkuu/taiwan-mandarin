<!--
  墨 on every page. It sits in the bottom-right corner on top of the tab bar (up top on pages
  with controls docked at the bottom, or on whatever a page offers it with `use:perch`), and
  every time the page changes it turns up in a way that fits the move, close to its corner: a few
  steps in from the side the new tab is on, down a short rope into a deeper page, up one when you
  go back. Then it says a word about where you are, or about your day (lib/mo.ts), and dozes off
  if you leave it be. A page can have it cheer as things happen (`companion.say`).
-->
<script lang="ts">
  import { tick, untrack } from 'svelte';
  import InkBlob from '../landing/InkBlob.svelte';
  import { companion, type Cheer } from '../../lib/companion.svelte';
  import { t } from '../../lib/i18n/index.svelte';
  import { arrive, climbAway, stopAll, type Rig } from '../../lib/entrances';
  import { reduced } from '../../lib/motion';
  import { GREETING_ZH, partOfDay } from '../../lib/greeting';
  import { arrivalMood, onceADay, type MoCheer, type MoMood } from '../../lib/mo';
  import { entranceFor, type Entrance } from '../../lib/nav';
  import { router, viewKey, type RouteName } from '../../lib/router.svelte';
  import { store } from '../../lib/store.svelte';

  /** What 墨 says on arriving at each page (and, under it, in the learner's language). */
  const LINES: Record<Exclude<RouteName, 'today'>, string> = {
    welcome: '你好！',
    study: '加油！',
    path: '一步一步',
    level: '爬山囉',
    word: '這個字',
    read: '讀書囉',
    reader: '噓…',
    dict: '查一查',
    talk: '聊聊吧',
    me: '是你！',
    'me-account': '歡迎',
    'me-settings': '調一調',
    'me-garden': '好漂亮',
    'me-ink': '磨墨',
    'me-levels': '好多級',
    'me-about': '我是墨',
  };

  /** What 墨 says about the learner's day, and while studying. */
  const MOOD_ZH: Record<Exclude<MoMood, 'greet'> | MoCheer, (n: number) => string> = {
    back: () => '歡迎回來！',
    mended: () => '補好了！',
    milestone: (n) => `${n}天了！`,
    doneToday: () => '今天完成了！',
    lateNight: () => '早點睡喔',
    combo: (n) => `連對${n}個！`,
    finished: () => '辛苦了！',
  };

  /** Pages with controls docked at the bottom: 墨 sits up top on these instead. */
  const UP_TOP = new Set<RouteName>(['study', 'talk']);
  const SAY_MS = 2600;
  const DOZE_MS = 20_000;
  /** Late at night 墨 is sleepy sooner. */
  const NIGHT_DOZE_MS = 8_000;

  let mover = $state<HTMLElement>();
  let cord = $state<HTMLElement>();
  let body = $state<HTMLElement>();

  let pose = $state<'sitting' | 'walking' | 'hanging' | 'climbing'>('sitting');
  /** Which way 墨 faces: 1 right, -1 left (towards the page, from its corner). */
  let dir = $state(-1);
  let quiet = $state(true);
  let sleepy = $state(false);
  /** Climbed out of sight (a page asked for room). */
  let gone = $state(false);
  /** On the way up the rope, not out of sight yet. */
  let leaving = false;
  /** The line chosen on arriving at this page; null for the page's usual one. */
  let arrived = $state<MoMood | null>(null);
  /** What a page asked 墨 to say just now. */
  let cheering = $state<Cheer | null>(null);
  /** The last cheer heard: older ones (from before 墨 came back on) are not replayed. */
  let heard = companion.cheer?.id ?? 0;
  /** Bumped to make 墨 hop. */
  let bounce = $state(0);
  /** Today's once-a-day lines already said. */
  let said = { day: '', moods: new Set<MoMood>() };

  const place = $derived(
    companion.anchor ? 'anchor' : UP_TOP.has(router.route.name) ? 'top' : 'floor',
  );
  const view = $derived(viewKey(router.route));
  const line = $derived.by(() => {
    const mood = cheering?.mood ?? arrived;
    if (mood && mood !== 'greet') {
      const n = cheering ? cheering.n : store.streak.count;
      const gloss = t().mo[mood];
      return { zh: MOOD_ZH[mood](n), gloss: typeof gloss === 'function' ? gloss(n) : gloss };
    }
    const name = router.route.name;
    if (name !== 'today') return { zh: LINES[name], gloss: t().companion[name] };
    // On Today, 墨 greets by the time of day, as the page does.
    const part = partOfDay(new Date(store.clock).getHours());
    return { zh: `${GREETING_ZH[part]}${part === 'night' ? '～' : '！'}`, gloss: t().greet[part] };
  });

  // On a perch a page offered: follow its top right-hand corner as the page scrolls or resizes.
  let anchorAt = $state<{ x: number; y: number } | null>(null);
  $effect(() => {
    const el = companion.anchor;
    if (!el) {
      anchorAt = null;
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      anchorAt = { x: r.right, y: r.top };
    };
    const queue = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const resized = new ResizeObserver(queue);
    resized.observe(el);
    addEventListener('scroll', queue, { passive: true, capture: true });
    addEventListener('resize', queue);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      removeEventListener('scroll', queue, true);
      removeEventListener('resize', queue);
    };
  });

  let sayTimer: ReturnType<typeof setTimeout> | undefined;
  let dozeTimer: ReturnType<typeof setTimeout> | undefined;

  const hour = () => new Date(store.clock).getHours();

  /** The line for arriving here, from the learner's day; each once-a-day line said only once. */
  function arrival(): MoMood | null {
    if (said.day !== store.today) said = { day: store.today, moods: new Set() };
    const state = { streak: store.streak, queueLeft: store.queue.length, hour: hour() };
    const mood = arrivalMood(router.route.name, state, said.moods);
    if (mood && onceADay(mood)) said.moods.add(mood);
    return mood;
  }

  /** Say the current line for a moment, then doze off later. */
  function speak() {
    sleepy = false;
    quiet = false;
    clearTimeout(sayTimer);
    clearTimeout(dozeTimer);
    sayTimer = setTimeout(() => (quiet = true), SAY_MS);
    const doze = partOfDay(hour()) === 'night' ? NIGHT_DOZE_MS : DOZE_MS;
    dozeTimer = setTimeout(() => (sleepy = true), doze);
  }

  /** At the perch: sit, face the page, say the line for a moment, doze off later. */
  function settle() {
    pose = 'sitting';
    dir = -1;
    cheering = null;
    arrived = arrival();
    speak();
  }

  const rig = (): Rig | null => (mover && cord && body ? { mover, cord, body } : null);

  async function enter(entrance: Entrance) {
    if (companion.away) return;
    gone = false;
    quiet = true;
    sleepy = false;
    clearTimeout(sayTimer);
    clearTimeout(dozeTimer);
    // Let the perch for the new page take its place before measuring from it.
    await tick();
    await new Promise(requestAnimationFrame);
    const parts = rig();
    if (!parts || reduced()) {
      settle();
      return;
    }
    if (entrance.kind === 'walk') {
      pose = 'walking';
      dir = entrance.from === 'left' ? 1 : -1;
    } else {
      pose = entrance.kind === 'climb' ? 'climbing' : 'hanging';
    }
    if (await arrive(parts, entrance)) settle();
  }

  async function leave() {
    quiet = true;
    clearTimeout(sayTimer);
    clearTimeout(dozeTimer);
    const parts = rig();
    if (!parts || reduced()) {
      gone = true;
      return;
    }
    pose = 'climbing';
    leaving = true;
    if (await climbAway(parts)) gone = true;
    leaving = false;
  }

  // A new page: 墨 comes along. (On the first one it just drips in.)
  let shown = '';
  $effect(() => {
    if (view === shown) return;
    const first = shown === '';
    shown = view;
    untrack(() => {
      if (first) settle();
      else void enter(entranceFor(router.from?.name ?? router.route.name, router.route.name));
    });
  });

  // A page cheers (a run of right answers, a session done): 墨 says so, and hops for the big ones.
  $effect(() => {
    const cheer = companion.cheer;
    untrack(() => {
      if (!cheer || cheer.id <= heard) return;
      heard = cheer.id;
      if (gone || leaving || pose !== 'sitting') return;
      cheering = cheer;
      if (cheer.mood === 'finished' || cheer.n >= 10) bounce++;
      speak();
    });
  });

  // A page wants the room: climb away, and come back down the rope once it is gone (even if 墨
  // is still on its way up).
  $effect(() => {
    const away = companion.away;
    untrack(() => {
      if (away) void leave();
      else if (gone || leaving) void enter({ kind: 'rappel' });
    });
  });

  $effect(() => () => {
    clearTimeout(sayTimer);
    clearTimeout(dozeTimer);
    const parts = rig();
    if (parts) stopAll(parts);
  });
</script>

<div
  class="companion {place}"
  class:walking={pose === 'walking'}
  class:sitting={pose === 'sitting'}
  class:hanging={pose === 'hanging'}
  class:climbing={pose === 'climbing'}
  class:hush={quiet}
  class:sleepy
  class:gone
  style:--dir={dir}
  style:left={place === 'anchor' && anchorAt ? `${anchorAt.x}px` : null}
  style:top={place === 'anchor' && anchorAt ? `${anchorAt.y}px` : null}
>
  <span class="cord" bind:this={cord}></span>
  <div class="mover" bind:this={mover}>
    <div class="body" bind:this={body}>
      <InkBlob says={line} flip below={place === 'top'} look={store.looks.mo} {bounce} />
    </div>
  </div>
</div>

<style>
  .companion {
    --mo-w: 40px;
    position: fixed;
    z-index: 25;
    width: var(--mo-w);
    pointer-events: none;
  }

  @media (max-width: 699px) {
    .companion {
      --mo-w: 34px;
    }
  }

  /* Bottom right, on top of the tab bar (which steps aside while typing, and 墨 with it). */
  .floor {
    right: var(--gutter);
    bottom: calc(var(--tabbar-h) + var(--safe-bottom) + 2px);
    transition: bottom var(--dur-3) var(--ease-out);
  }

  @media (min-width: 700px) {
    .floor {
      bottom: 18px;
    }
  }

  .top {
    right: var(--gutter);
    top: calc(var(--safe-top) + 12px);
  }

  /* Sitting on the top edge of what the page offered, at its right-hand end: a little smaller,
     to fit the gap above a progress bar. */
  .anchor {
    --mo-w: 26px;
    translate: calc(-100% - 2px) -100%;
  }

  .gone {
    visibility: hidden;
  }

  .mover {
    position: relative;
  }

  .body {
    transform-origin: 50% 100%;
  }

  /* The rope 墨 comes down or climbs up: from the curl on its head at the perch up to where it
     hangs from, fading out towards the top. It stays put while 墨 moves along it. */
  .cord {
    position: absolute;
    left: calc(50% - 1px);
    bottom: calc(100% - 3px);
    display: none;
    width: 2px;
    height: var(--cord, 0px);
    transform-origin: 50% 0;
    border-radius: 1px;
    background: var(--ink-2);
    mask-image: linear-gradient(transparent, #000 32px);
  }

  .cord:global([data-kind='rope']) {
    display: block;
  }
</style>
