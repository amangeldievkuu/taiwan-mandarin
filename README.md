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
