import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/mlb-stat-underground/'

// Same-origin proxy so the browser can reach data-graph.mlb.com (no CORS).
const mlbDataGraphProxy = {
  '/mlb-data-graph': {
    target: 'https://data-graph.mlb.com',
    changeOrigin: true,
    secure: true,
    rewrite: () => '/graphql',
  },
}

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'logo.png', 'icons/*.png'],
      manifest: {
        id: base,
        name: 'MLB Stat Underground',
        short_name: 'MLB Live',
        description: 'Live MLB scores, postseason brackets, stats, standings, and player data.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable_icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Never offline-cache the rankings proxy or snapshot — always network.
        runtimeCaching: [
          {
            urlPattern: /\/mlb-data-graph(?:\?|$)/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/data\/pipeline-rankings\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pipeline-rankings',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    proxy: mlbDataGraphProxy,
  },
  preview: {
    proxy: mlbDataGraphProxy,
  },
})