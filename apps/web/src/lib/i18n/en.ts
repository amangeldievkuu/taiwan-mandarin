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

  common: {
    cancel: 'Cancel',
  },

  today: {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    ring: (done: number, left: number) => `${done} done, ${left} left today`,
    allDone: 'all done',
    cardsLeft: (n: number): string => (n === 1 ? 'card left' : 'cards left'),
    practice: "Today's practice",
    toReview: 'to review',
    newWords: (n: number): string => (n === 1 ? 'new word' : 'new words'),
    continue: 'Continue',
    start: 'Start studying',
    doneBody: (reviews: number) =>
      `All done for today. ${reviews ? `${reviews} reviews. ` : ''}Read something or look ` +
      'around the dictionary.',
    readStory: 'Read a story',
    xpToday: (xp: number) => `+${xp} XP today`,
    plant: (days: number) => `Your streak plant: ${days} days`,
    yourPath: 'Your path',
    allLevels: 'All levels',
    wordsStarted: (started: number, total: number) => `${started} of ${total} words started`,
    learned: 'words learned',
    mature: 'well remembered',
    deck: 'in your deck',
    explore: 'Explore',
    tiles: {
      read: {
        title: 'Graded reading',
        text: "Short stories about Taiwan life. Tap any word you don't know.",
      },
      talk: { title: 'Conversation', text: 'Chat in Taiwan Mandarin using only words you know.' },
      explain: {
        title: 'Explain a sentence',
        text: 'Paste a sign, menu or message and get a word-by-word breakdown.',
      },
    },
    /** The streak plant card: always an invitation, never a scolding. */
    bowl: {
      firstTitle: 'Plant your first seed',
      firstBody:
        'Study today and a plum tree (梅) starts to grow. A missed day doesn’t break it: come ' +
        'back within three days and the pot is mended with gold (金繼).',
      newTitle: 'Plant a new seed',
      newBody: (days: number) =>
        `Your ${days}-day plant is in your garden, gold and all. Study today to grow a new one.`,
      mendedTitle: 'Mended with gold',
      mendedBody: (days: number) =>
        `You came back and the crack turned to gold. ${days} days of growing.`,
      streak: (days: number) => `${days}-day streak`,
      wateredSeams: (seams: number) =>
        `Watered for today, with ${seams} gold ${seams === 1 ? 'seam' : 'seams'} so far.`,
      watered: 'Watered for today. See you tomorrow.',
      thirsty: 'Your plant needs water',
      lastDay: 'Last day: study today and the crack turns to gold.',
      mendBy: (weekday: string, missed: number) =>
        `Study by ${weekday} and the missed ${missed === 1 ? 'day turns' : 'days turn'} to gold.`,
      grow: 'Study today to help your plant grow.',
    },
  },

  me: {
    eyebrow: 'Progress & settings',
    plant: (days: number, seams: number) => `Your streak plant: ${days} days, ${seams} gold seams`,
    dayStreak: 'day streak',
    longest: (days: number, seams: number) =>
      `Longest ${days} · ${seams} gold ${seams === 1 ? 'seam' : 'seams'}`,
    xpToday: (xp: number) => `+${xp} today`,
    wellRemembered: (n: number) => `${n} well remembered`,
    remembered: 'remembered',
    last30: 'last 30 days',
    last30Title: 'Last 30 days',
    studied: (reviews: number, minutes: number) =>
      `${reviews} reviews · about ${minutes} minutes of study`,
    more: 'More',
    signInSub: 'Sign in to keep your progress in sync',
    checking: (email: string) => `${email} · checking your session…`,
    syncing: (email: string) => `${email} · syncing…`,
    syncFailed: (email: string) => `${email} · sync failed`,
    synced: (email: string, time: string) => `${email} · synced ${time}`,
    settingsSub: (phonetics: string, perDay: number, memory: number) =>
      `${phonetics} · ${perDay} new a day · ${memory}% memory`,
    garden: 'Garden & seals',
    gardenSub: (plants: number, earned: number, total: number) =>
      `${plants} past ${plants === 1 ? 'plant' : 'plants'} · ${earned} of ${total} seals`,
    levelsSub: (words: number, levels: number) =>
      `${words} words across ${levels} ${levels === 1 ? 'level' : 'levels'}`,
    aboutSub: 'Sources and licences',
  },

  settings: {
    reading: 'Reading',
    phonetics: 'Phonetics',
    phoneticsHint: 'Shown beside every character',
    zhuyin: 'Zhuyin',
    both: 'Both',
    characters: 'Characters',
    charactersHint: 'Brush-style Kai, or a plain sans',
    characterStyle: 'Character style',
    kai: 'Kai',
    sans: 'Sans',
    theme: 'Theme',
    auto: 'Auto',
    light: 'Light',
    dark: 'Dark',
    studying: 'Studying',
    newPerDay: 'New words per day',
    newPerDayHint: 'Reviews come first; new words are added up to this many. 0 pauses new words.',
    memory: 'Target memory',
    memoryHint: 'How well you want to remember a word when it comes up. Higher means more reviews.',
    feedback: 'Feedback',
    sound: 'Sound effects',
    soundHint: 'Chimes when you answer and finish (this device)',
    vibration: 'Vibration',
    vibrationHint: 'A little buzz on each answer (this device)',
    companion: '墨 on every page',
    companionHint: 'The ink drop that comes along with you (this device)',
    data: 'Data',
    todayCounts: (learned: number, reviews: number) => `Today: ${learned} new · ${reviews} reviews`,
    resetAccount:
      'This deletes all progress and review history here and in your account. Other devices ' +
      'keep their copy until you reset them too.',
    resetDevice: 'This deletes all progress and review history on this device.',
    deleteEverything: 'Delete everything',
    reset: 'Reset progress…',
  },

  about: {
    tour: 'Take the tour',
    tourSub: 'The welcome page, with 墨 the ink bot',
    sources: 'Sources',
    wordLists: 'Word lists',
    and: 'and',
    dictionary: 'Dictionary',
    taiwanReadings: 'with Taiwan readings applied.',
    examples: 'Examples',
    ownSentences: 'and sentences written for this app.',
    strokeOrder: 'Stroke order',
    fonts: 'Fonts',
  },

  account: {
    starting: 'Starting…',
    homeScreen: 'Added to the Home Screen, the app keeps its own sign-in, separate from Safari.',
    security: 'Security',
    memoryModel: 'Memory model',
    fitted: 'Your scheduler uses FSRS parameters fitted to your own review history.',
    notFitted:
      'After about 400 reviews, the scheduler can be fitted to how you remember. It refits ' +
      'every night.',
    fitting: 'Fitting…',
    fitNow: 'Fit to my reviews now',
    fittedTo: (reviews: string) => `Fitted to your ${reviews} reviews.`,
    api: 'API access',
    deleteConfirm: 'Delete the account and all synced data? This device keeps its local copy.',
    deleting: 'Deleting…',
    delete: 'Delete account',
    deleteMenu: 'Delete account…',
    syncingNow: 'Syncing…',
    checking: 'Checking your session…',
    syncFailed: (why: string) => `Sync failed: ${why}`,
    synced: (time: string) => `Synced ${time}`,
    notSynced: 'Not synced yet',
    syncNow: 'Sync now',
    signingOut: 'Signing out…',
    signOut: 'Sign out',
  },

  auth: {
    mode: 'Sign in or create an account',
    signIn: 'Sign in',
    create: 'Create account',
    leadSignIn:
      'Your progress syncs between your phone, iPad and laptop, and conversation practice, ' +
      'sentence explanations and pronunciation checks become available.',
    leadCreate: 'Free. What you have learned on this device is added to the new account.',
    email: 'Email',
    name: 'Name',
    optional: 'optional',
    password: 'Password',
    passwordHint: 'At least 8 characters. A few words work well.',
    signingIn: 'Signing in…',
    creating: 'Creating your account…',
    noAccount: 'No account yet?',
    createOne: 'Create one',
    forgotten:
      'Forgotten your password? There is no reset by email yet: your progress on this device ' +
      'stays yours, and a new account can take it over.',
    haveAccount: 'Have an account?',
    show: 'Show',
    hide: 'Hide',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    mismatch: 'The two new passwords are not the same.',
    changed: 'Password changed. Your other devices are signed out.',
    current: 'Current password',
    new: 'New password',
    newHint: 'At least 8 characters.',
    again: 'New password again',
    changeNote: 'Changing it signs out your other devices; this one stays signed in.',
    changing: 'Changing…',
    change: 'Change password',
    changeMenu: 'Change password…',
    everywhereConfirm:
      'Sign out on every device, this one included? Progress already synced stays in your ' +
      'account, and API tokens keep working.',
    everywhere: 'Sign out everywhere',
    everywhereMenu: 'Sign out everywhere…',
  },

  tokens: {
    intro: 'Personal access tokens let other apps read your words, cards and stats through the',
    publicApi: 'public API',
    copyNow: "Copy it now, it won't be shown again:",
    copied: 'Copied',
    copy: 'Copy',
    name: 'Token name',
    placeholder: 'Token name, e.g. Anki export',
    creating: 'Creating…',
    create: 'Create',
    used: (date: string) => `used ${date}`,
    neverUsed: 'never used',
    revoke: (name: string) => `Revoke ${name}`,
  },

  errors: {
    wrongLogin: 'Wrong email or password.',
    emailTaken: 'That email already has an account. Sign in instead?',
    wrongPassword: 'The current password is wrong.',
    sessionEnded: 'Your session ended. Sign in again.',
    server: 'The server had a problem. Try again in a moment.',
    generic: 'Something went wrong.',
  },
};

export type Messages = typeof en;
