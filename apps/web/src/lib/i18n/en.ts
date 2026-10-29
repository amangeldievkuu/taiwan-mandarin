// The app's words in English: the catalog every other language follows (vi.ts must have the same
// keys, which svelte-check enforces). Strings with numbers are functions, so each language says
// plurals its own way. Chinese stays in the components: it is what the learner learns.

import { LEVELS, TOPICS, type Level, type TopicId } from '@taiwan-mandarin/shared';
import { SCENARIOS, type ScenarioId } from '@taiwan-mandarin/shared/api';
import type { RouteName } from '../router.svelte';

const byId = <K extends string>(rows: readonly { id: K; en: string }[]) =>
  Object.fromEntries(rows.map((r) => [r.id, r.en])) as Record<K, string>;

export const en = {
  app: {
    name: 'Taiwan Mandarin',
    offlineReady: 'Ready to work offline',
    offlineReadyBody: 'Words you open from now on stay available without a connection.',
    loadFailed: "Couldn't load the word lists.",
    tryAgain: 'Try again',
    dismiss: 'Dismiss',
  },

  /** Page names, for navigation and back buttons. */
  titles: {
    today: 'Today',
    study: 'Study',
    path: 'Path',
    read: 'Read',
    dict: 'Dictionary',
    talk: 'Talk',
    me: 'Me',
    'me-account': 'Account',
    'me-settings': 'Settings',
    'me-garden': 'Garden',
    'me-levels': 'By level',
    'me-about': 'About',
    welcome: 'Welcome',
    level: 'Level',
    word: 'Word',
    reader: 'Reading',
  } satisfies Record<RouteName, string>,

  nav: {
    main: 'Main',
    home: '臺灣華語 home',
    due: (n: number) => `${n} due`,
  },

  levels: byId<Level>(LEVELS),
  topics: byId<TopicId>(TOPICS),
  scenarios: byId<ScenarioId>(SCENARIOS),

  /** What 墨 says on arriving at each page, under its Chinese line. */
  companion: {
    welcome: 'hello!',
    today: 'morning!',
    study: "you've got this",
    path: 'step by step',
    level: 'up we go',
    word: 'this one',
    read: 'reading time',
    reader: 'shh…',
    dict: 'look it up',
    talk: "let's talk",
    me: "it's you!",
    'me-account': 'welcome',
    'me-settings': 'tweak away',
    'me-garden': 'how pretty',
    'me-levels': 'so many levels',
    'me-about': "I'm Mo",
  } satisfies Record<RouteName, string>,
  /** What 墨 says when tapped (嘿！ 哈哈 咚！ 再來！ 好癢), in turn. */
  taps: ['hey!', 'haha', 'boing', 'again!', 'that tickles'],

  week: {
    label: 'This week',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    done: 'practiced',
    mended: 'mended with gold',
    crack: 'missed, can still be mended',
    empty: 'no practice',
    today: 'today, not practiced yet',
    future: 'still to come',
  },

  /** Time until a card is due: "<1m", "10m", "3h", "4d", "2mo", "1.5y". */
  interval: {
    underMinute: '<1m',
    minutes: (n: number) => `${n}m`,
    hours: (n: number) => `${n}h`,
    days: (n: number) => `${n}d`,
    months: (n: number) => `${n}mo`,
    years: (n: string) => `${n}y`,
  },

  seals: {
    names: {
      'first-day': 'First day of study',
      'first-gold': 'First gap mended with gold',
      'bowl-7': 'A 7-day sapling',
      'bowl-30': 'Buds at 30 days',
      'bowl-100': 'In bloom at 100 days',
      'words-100': '100 new words',
      'words-500': '500 new words',
      'words-1000': '1,000 new words',
      'xp-10000': '10,000 XP',
    } as Record<string, string>,
    count: (earned: number, total: number) => `${earned} of ${total} seals`,
    progress: (percent: number) => `${percent}% of the way`,
  },

  celebrate: {
    mended: 'Mended with gold',
    mendedBody: (missed: number, days: number) =>
      `You came back, and ${missed === 1 ? 'the missed day' : `${missed} missed days`} turned ` +
      `to gold. ${days} days of growing.`,
    sprout: 'A new sprout',
    sproutBody: 'Your last plant is in your garden, gold and all. This one starts today.',
    newSeal: (name: string) => `New seal · ${name}`,
    plant: 'Your streak plant',
  },

  welcome: {
    /** What 墨 says on each stretch of the road (你好！ 出發！ 一步一步 慢慢來 加油！ 好厲害 快到了 再一點 到了！). */
    says: [
      'hello!',
      'off we go',
      'step by step',
      'take it slow',
      'keep going',
      'look at you',
      'almost there',
      'a little more',
      'made it',
    ],
    bloomed: 'it bloomed',
  },
};

export type Messages = typeof en;
