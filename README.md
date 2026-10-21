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
npm test           # shared + web tests
npm run check      # tsc + svelte-check in every workspace
npm run lint       # ESLint (no `any`)
npm run build      # shared → api → web (bundles stroke data, service worker)
```

Web-only tasks: `npm run strokes -w @taiwan-mandarin/web` after adding words,
`npm run icons -w @taiwan-mandarin/web` to regenerate PWA icons.

Stroke data: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) via `hanzi-writer-data`
(Arphic Public License). It follows PRC stroke order; see `data/stroke-order-tw-overrides.json`.
