import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { defaultClientConditions, defaultServerConditions } from 'vite';
import { defineConfig } from 'vitest/config';

const YEAR = 60 * 60 * 24 * 365;

export default defineConfig({
  // Use @taiwan-mandarin/shared from source (its "source" export), so edits hot-reload without a build.
  resolve: { conditions: ['source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['source', ...defaultServerConditions] } },
  // The API is same-origin under /api, as in production (so the refresh cookie stays first-party).
  server: {
    proxy: {
      // 127.0.0.1, not localhost: Node resolves localhost to ::1 first, where another dev server
      // on port 3000 (IPv6 only) would answer instead of the API.
      '/api': { target: 'http://127.0.0.1:3000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3000', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  plugins: [
    svelte(),
    VitePWA({
      // A new version waits for the learner's "Reload" (src/lib/pwa.svelte.ts).
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: '臺灣華語',
        short_name: '華語',
        description:
          'Learn Taiwan Mandarin: the TOCFL path, Zhuyin, a built-in dictionary, graded reading and spaced repetition.',
        lang: 'zh-Hant-TW',
        display: 'standalone',
        start_url: '/',
        theme_color: '#F4F8F6',
        background_color: '#F4F8F6',
        categories: ['education'],
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico}', 'strokes-tw.json'],
        // Word lists and dictionary shards (~17 MB) are cached on first use, not precached.
        globIgnores: ['content/**', 'dict/**'],
        navigateFallbackDenylist: [/^\/api\//, /^\/content\//, /^\/dict\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/content/manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'content-manifest', networkTimeoutSeconds: 4 },
          },
          {
            // Versioned by the manifest hash (?v=…), so cached copies never go stale.
            urlPattern: ({ url }) => /\/(content|dict)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'content',
              expiration: { maxEntries: 400, maxAgeSeconds: YEAR },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
            handler: 'CacheFirst',
            options: {
              cacheName: 'strokes',
              expiration: { maxEntries: 3000, maxAgeSeconds: YEAR },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
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
              expiration: { maxEntries: 300, maxAgeSeconds: YEAR },
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
