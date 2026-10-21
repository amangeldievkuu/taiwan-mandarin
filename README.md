# 台灣華語

Taiwan Mandarin flashcards: Traditional characters, Zhuyin, Taiwan readings, FSRS spaced
repetition, stroke order. Svelte 5 + TypeScript + Vite, offline PWA.

```sh
npm install
npm run dev        # dev server
npm test           # phonetics, SRS and vocabulary tests
npm run check      # svelte-check + tsc
npm run build      # bundles stroke data, builds app + service worker
npm run icons      # regenerate PWA icons from public/icon.svg
```

- Vocabulary: `src/lib/vocab.ts` (run `npm run strokes` after adding words)
- Pinyin → Zhuyin: `src/lib/phonetics.ts`
- Persistence: `src/lib/storage.ts` (`StorageAdapter`, ready for a server sync adapter)

Stroke data: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) via `hanzi-writer-data`
(Arphic Public License). Stroke order follows PRC conventions, which differ slightly from
Taiwan's standard for a few characters.
