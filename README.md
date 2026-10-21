# 臺灣華語

Taiwan Mandarin flashcards: Traditional characters, Zhuyin, Taiwan readings, FSRS spaced
repetition, stroke order. Offline-first PWA with an optional sync backend.

## Layout

```
apps/web         Svelte 5 + Vite PWA (works fully offline, no account needed)
apps/api         NestJS API (auth, content, sync), PostgreSQL
packages/shared  phonetics (pinyin → Zhuyin), vocabulary data and shared types
data/            curated data files (e.g. Taiwan stroke-order overrides)
```

Web and Vitest import `@taiwan-mandarin/shared` from source (the `source` export condition), so
edits hot-reload. The API uses its built `dist/`. Root scripts build it first.

## Commands

```sh
npm install
cp .env.example .env                       # Postgres credentials for docker compose
cp apps/api/.env.example apps/api/.env
npm run dev        # Postgres (docker compose) + shared watch + API :3000 + web :5173
npm test           # shared + web tests, then the Taiwan-standard guard
npm run check      # tsc + svelte-check in every workspace
npm run lint       # ESLint (no `any`)
npm run build      # shared → api → web (bundles stroke data, service worker)
```

Web-only tasks: `npm run strokes -w @taiwan-mandarin/web` after adding words,
`npm run icons -w @taiwan-mandarin/web` to regenerate PWA icons.

## Taiwan standard (臺灣華語)

This app teaches Taiwan Mandarin only. Every Chinese string is Traditional Chinese in Taiwan
forms (zh-Hant-TW), with Taiwan vocabulary and Taiwan readings. Zhuyin is the primary phonetic
system; pinyin is optional.

- **Script:** Taiwan forms only (裡, 為, 線…). 臺 is used in formal names (臺灣, 臺北); the
  everyday form 台 appears only in notes that explain it.
- **Vocabulary:** Taiwan words (捷運, 計程車, 腳踏車, 公車, 機車, 網路…). A Mainland equivalent
  appears only as a labeled note (`mainland` field → "Материкте: 地鐵" / "Mainland: 地鐵").
- **Readings:** from the MOE 《重編國語辭典修訂本》 (e.g. 垃圾 lèsè, 星期 xīngqí, 誰 shéi,
  對不起 duìbuqǐ, 漂亮 piàoliang). All vocabulary was checked against
  [moedict.tw](https://www.moedict.tw), which mirrors the dictionary. Words marked
  `readingUnverified` (currently 哪裡) weren't found there and still need a manual check.
- **Glyphs:** Chinese text is tagged `lang="zh-Hant-TW"` and uses Taiwan-locale fonts (LXGW
  WenKai TC, PingFang TC / Noto Sans TC). The page language follows the meaning language.

### Automated guards

`npm test` runs both; `npm run guard:taiwan` runs the repo scan alone.

1. **Text guard** (`packages/shared/src/taiwan-standard`). Every Chinese string in the vocabulary
   data and every Chinese run in `apps/web` and `apps/api` sources goes through three checks:
   - OpenCC `{ from: 'cn', to: 'twp' }` (Simplified characters plus Mainland phrasing). The text
     must come back unchanged.
   - A denylist of Mainland words that OpenCC misses when they are written in Traditional
     characters (地鐵, 出租車, 公交車, 空調, 便利店, 摩托車, 菠蘿, 質量…).
   - Labeled `mainland` notes are checked with `{ from: 'cn', to: 'tw' }` (characters only).
   - False positives go in `allowlist.ts`, scoped to one location, with a reason. Example:
     OpenCC turns 菜單 (restaurant menu) into 選單 (software menu).
2. **Reading guard.** Mainland readings must never appear, e.g. 垃圾 la1 ji1, 星期 xing1 qi1,
   危 wei1, 企 qi3, 暫 zan4, 綜 zong1.

### Stroke order

`hanzi-writer-data` ([Make Me a Hanzi](https://github.com/skishore/makemeahanzi)) follows PRC
stroke order. `data/stroke-order-tw-overrides.json` lists characters verified against the MOE
《常用國字標準字體筆順學習網》, either as `same-as-prc` or with corrected Taiwan stroke data
(`tw`). Every other character shows the badge 「筆順可能與臺灣標準不同」. Stroke data is never
invented: entries need a source.

Stroke data: Make Me a Hanzi via `hanzi-writer-data` (Arphic Public License).
