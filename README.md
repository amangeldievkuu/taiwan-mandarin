# 臺灣華語

Learn Taiwan Mandarin along Taiwan's official exam path. The app covers TOCFL Novice 1 → Level 6
(about 15,000 words) with Traditional characters, Zhuyin and Taiwan readings. It has:

- FSRS spaced repetition, with recognition, recall and listening modes
- a built-in dictionary (CC-CEDICT with Taiwan readings) where you can tap any character
- graded reading about Taiwan life
- example sentences, stroke order and stats

It is an offline-first PWA for phone, iPad and desktop, with an optional sync backend.

## Layout

```
apps/web          Svelte 5 + Vite PWA (works fully offline, no account needed)
apps/api          NestJS API (auth, content, sync), PostgreSQL
packages/shared   phonetics (pinyin ⇄ Zhuyin), segmentation, content types, Taiwan-standard guard
packages/content  content pipeline: word lists + CC-CEDICT + Tatoeba → app content files
data/             curated inputs: readers, AI-written glosses/examples, stroke-order overrides
```

Web and Vitest import `@taiwan-mandarin/shared` from source (the `source` export condition), so
edits hot-reload. The API uses its built `dist/`. Root scripts build it first.

## Commands

```sh
npm install
cp .env.example .env                       # Postgres credentials for docker compose
cp apps/api/.env.example apps/api/.env
npm run dev        # builds content on first run, then Postgres + shared watch + API :3000 + web :5173
npm test           # shared, content and web tests, then the Taiwan-standard guard
npm run check      # tsc + svelte-check in every workspace
npm run lint       # ESLint (no `any`)
npm run build      # shared → api → web (service worker included)
npm run content    # re-download the sources and rebuild the app content
```

Web-only: `npm run icons -w @taiwan-mandarin/web` regenerates the PWA icons from `public/icon.svg`.

## API and sync

The web app works fully offline without an account. Signing in (Me › Account) syncs progress
between devices.

- **Accounts.** Passwords use argon2id. Access is a 15-minute JWT held in memory. A rotating
  refresh token sits in an httpOnly cookie, and reusing a rotated token revokes the whole chain.
- **Same origin.** The web app calls the API under `/api` (Vite proxies it in development), so
  the cookie stays first-party. That matters for Safari on iPhone and iPad.
- **Sync** (`POST /v1/sync`): cards merge last-write-wins per word, review logs are append-only
  and keyed by client UUIDs, and deck and settings are whole-value last-write-wins. It runs on
  start, when the app becomes visible, 5 s after changes, and on sign-in. The first sign-in on a
  device merges its local progress into the account.
- **Personal FSRS.** Review logs live in PostgreSQL. The fsrs-rs optimizer
  (`@open-spaced-repetition/binding`) fits each learner's weights nightly, once they have 400
  new reviews, or on demand from Me. Clients receive the weights on their next sync.
- **Public API.** Swagger is at `/docs` (`/api/docs` through the web app). Content routes are
  open: `/v1/levels`, `/v1/words`, `/v1/dict/:q`, `/v1/segment`, `/v1/readers`. Personal routes
  (`/v1/me/stats`, `/cards`, `/reviews`, `POST /v1/me/deck/:wordId`) accept a personal access
  token (`tm_…`) created in Me › API access. Tokens can't manage other tokens.
- **Content.** The API serves words and the dictionary from the same generated files as the
  web app, held in memory. The database holds only learner data.

### AI features (sign-in required)

These run on the server with Claude (`ANTHROPIC_API_KEY`, model `ANTHROPIC_MODEL`, default
`claude-opus-5-5`):

- Structured outputs are validated with zod.
- The system prompt is cached.
- Server-side refusal fallback is on (`fallbacks: "default"`).
- Per-user daily quotas apply (`AI_DAILY_LIMIT`).

**Explain a sentence** (Dictionary › Explain): text or a photo of a sign, menu or message. You
get a translation, a word-by-word breakdown, grammar and usage notes. Readings are then replaced
with the path's or dictionary's Taiwan readings. When the model's reading matches none of ours
(垃圾 lājī), ours wins. Tokens link to the path for one-tap "add to deck".

**Talk** (conversation practice): eight Taiwan situations (night-market stall, bubble tea, MRT,
7-Eleven, clinic…).

- The partner may only use the learner's vocabulary: synced cards, Novice 1, and the levels below
  their path.
- Each reply is split into words and checked. More than two unknown words, or Mainland wording,
  triggers one rewrite through a mid-conversation system message.
- Remaining unknown words are returned as "new words" to tap.
- The learner's messages get a 修正 correction when needed.

### Pronunciation check (sign-in required)

Record a word or sentence on its word page. The browser decodes the recording (AAC on Safari,
Opus on Chrome) to 16 kHz mono WAV, so the server needs no ffmpeg.

- **Syllables.** OpenAI Whisper (`OPENAI_API_KEY`, `whisper-1`, word timestamps, the target as
  the prompt) transcribes the recording. Its Simplified output is converted to Taiwan characters
  and aligned with the target by edit distance. Homophones count as correct sounds.
- **Tones.** `packages/shared/src/pronunciation` (pure TypeScript, tested on synthetic voices) runs
  a YIN F0 tracker and converts pitch to semitones in the speaker's own range. It then matches
  each syllable's contour against templates for the four tones.
- **Sandhi.** Expected tones are computed first (3-3 → 2-3, 不 → bú before a 4th tone, 一 → yí/yì),
  so correct sandhi is never marked wrong.
- **Display.** The app draws your pitch curve over the ideal tone shape and says what it heard
  ("Sounded 4th, needs 3rd"). Tone feedback is labelled approximate.

```sh
npm run db:up                                  # PostgreSQL in Docker (POSTGRES_PORT in .env)
npm run db:migrate -w @taiwan-mandarin/api     # apply migrations
npm run test:api                               # API end-to-end tests (separate *_test database)
```

## Content

`npm run content` downloads the sources into `data/raw/` (gitignored) and writes
`apps/web/public/content/` (word lists per level, readers, search index) and
`apps/web/public/dict/` (128 dictionary shards). A tap loads only the shard for the tapped
character. The service worker caches every file after first use.

| Source                                              | Used for                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| TOCFL 《華語八千詞表》 (SC-TOP, 2024-09)            | Levels Novice 1 – Level 5 (7,517 entries), readings, parts of speech  |
| NAER 《臺灣華語文能力基準》三等七級詞語表 (2025-04) | Level 6 (精通, C2: TOCFL has no list), extra words, Zhuyin, topics    |
| NAER 通用詞頻表                                     | Study order within a level                                            |
| [CC-CEDICT](https://cc-cedict.org)                  | English glosses, measure words, the dictionary                        |
| [Tatoeba](https://tatoeba.org)                      | Example sentences with English translations                           |
| `data/generated/*.jsonl`                            | Glosses and examples written for this app where the sources have none |
| `packages/shared/src/content/curated.ts`            | The original 121 hand-checked words: notes, Mainland labels           |

How the path is built (`packages/content/src/lexicon.ts`):

- **Levels.** A word's level is its TOCFL band. The two lists line up level by level (the TOCFL
  list's 2022 notes map them): NAER 第1級 ≈ 準備一級 … 第6級 ≈ 流利級, and 第7級 becomes Level 6.
  NAER-only words fill gaps after the TOCFL words of their level.
- **Readings.** NAER's syllable-split Zhuyin is used where the forms match. Otherwise the run-together
  TOCFL pinyin is split by a DP that checks each syllable against the character's known readings.
  NAER's tones win for multi-character words; the differences are listed in
  `data/generated/reading-diffs.txt` for review. 一 and 不 keep citation tones (the app applies
  sandhi).
- **Headwords.** Variants in a list cell (`爸爸/爸`, `小孩(子)`, `台灣/臺灣`) become one word. The
  headword is the Taiwan-standard form (臺 over 台, no erhua when a non-兒 form exists).
- **Glosses.** CC-CEDICT senses for the same headword and reading, shortened for flashcards. The
  full entry stays in the dictionary.

**Graded readers** live in `data/readers/<id>.json`. There are 24 texts, 3 per level, about Taiwan
life. They were written with Claude and carry `"draft": true` (shown as "Draft") until a person
has reviewed them. The build:

- splits each text into words with readings;
- links the words to the path;
- glosses every word above the reader's level (from the reader's `glossary`, else the study gloss);
- reports those words in `data/generated/reader-hard-words.tsv`.

Generated content isn't committed. The NAER list is marked 版權所有, and the TOCFL list states no
license. Both are downloaded from their official sites at build time, and attributed in the app's
About section and in `NOTICE`.

## Taiwan standard (臺灣華語)

This app teaches Taiwan Mandarin only. Every Chinese string is Traditional Chinese in Taiwan
forms (zh-Hant-TW), with Taiwan vocabulary and Taiwan readings. Zhuyin is the primary phonetic
system; pinyin is optional.

- **Script.** Taiwan forms only (裡, 為, 線…). 臺 is used in formal names (臺灣, 臺北). The everyday
  form 台 appears only in notes that explain it, and is a listed variant.
- **Vocabulary.** Taiwan words (捷運, 計程車, 腳踏車, 機車, 網路…). Mainland words that the NAER list
  includes for recognition (地鐵, 自行車) carry a note with the Taiwan word and come last in their
  level.
- **Readings.** From the official lists, which follow the MOE 《重編國語辭典修訂本》 (垃圾 lèsè,
  星期 xīngqí, 誰 shéi). Dictionary entries outside the path get CC-CEDICT's "Taiwan pr." readings
  and the per-character fixes below.
- **Glyphs.** Chinese text is tagged `lang="zh-Hant-TW"` and uses Taiwan-locale fonts (LXGW
  WenKai TC, PingFang TC / Noto Sans TC).

### Automated guards

`npm test` and the content build run both checks. `npm run guard:taiwan` runs the repo scan alone.

1. **Text guard** (`packages/shared/src/taiwan-standard`). It checks:
   - every example sentence, reader and note;
   - our own glosses;
   - curated headwords;
   - every Chinese run in `apps/web` and `apps/api` sources.

   Each text goes through three checks:
   - OpenCC `{ from: 'cn', to: 'twp' }` (Simplified characters plus Mainland phrasing). The text
     must come back unchanged. Everyday words that OpenCC's table rewrites into software terms
     (消息 → 訊息, 打開 → 開啟, 支持 → 支援, 項目 → 專案…) are ignored (`OPENCC_OVERREACH`).
   - A denylist of Mainland words OpenCC misses when they are written in Traditional characters
     (地鐵, 出租車, 公交車, 空調, 便利店, 摩托車, 菠蘿, 質量…).
   - Labeled `mainland` notes, which are checked for characters only.

   Headwords from the official lists and CC-CEDICT reference glosses are not phrase-checked: the
   lists define the standard. False positives go in `allowlist.ts`, scoped to one location, with
   a reason.

2. **Reading guard.** Mainland readings must never appear: 垃圾 la1 ji1, 期 qi1, 危 wei1, 企 qi3,
   暫 zan4, 綜 zong1, 究 jiu1, 髮 fa4. (液 yè is accepted: it is an MOE alternate reading and both
   lists use it.) The dictionary build rewrites these to the Taiwan reading.

### Stroke order

`hanzi-writer-data` ([Make Me a Hanzi](https://github.com/skishore/makemeahanzi)) follows PRC
stroke order and is loaded per character from jsDelivr (cached for offline use).
`data/stroke-order-tw-overrides.json` lists characters verified against the MOE
《常用國字標準字體筆順學習網》, either as `same-as-prc` or with corrected Taiwan stroke data (`tw`).
`npm run strokes -w @taiwan-mandarin/web` bundles those into `public/strokes-tw.json`. Every
other character shows the badge 「筆順可能與臺灣標準不同」. Stroke data is never invented: entries
need a source.
