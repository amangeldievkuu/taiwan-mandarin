import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { defaultClientConditions, defaultServerConditions, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { VOCAB } from '@taiwan-mandarin/shared';

// Every character drawn in the Kai font: vocabulary, Zhuyin (ㄅ–ㄩ, tones) and a few UI labels.
// Requesting just these from Google Fonts gives one small file that the service worker caches,
// so the Kai font works fully offline.
const KAI_TEXT = [
  ...new Set([
    ...VOCAB.map((w) => w.hanzi).join(''),
    ...'今天完成了楷書Kai˙',
    ...Array.from({ length: 0x3129 - 0x3105 + 1 }, (_, i) => String.fromCodePoint(0x3105 + i)),
  ]),
].join('');

const kaiFontSubset = (): Plugin => ({
  name: 'kai-font-subset',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) => html.replace('__KAI_TEXT__', encodeURIComponent(KAI_TEXT)),
  },
});

export default defineConfig({
  // Use @taiwan-mandarin/shared from source (its "source" export), so edits hot-reload without a build.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  plugins: [
    kaiFontSubset(),
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '台灣華語',
        short_name: '華語',
        description:
          'Taiwan Mandarin flashcards: Traditional characters, Zhuyin, spaced repetition.',
        lang: 'zh-Hant-TW',
        display: 'standalone',
        theme_color: '#FFFFFF',
        background_color: '#FFFFFF',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
