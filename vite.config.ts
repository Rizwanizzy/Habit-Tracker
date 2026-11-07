import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
    allowedHosts: true,
  },
  test: {
    // Don't run other tools' worktree snapshots nested in this folder
    // (e.g. .kilo/worktrees/*/src/**) — only this project's own tests count.
    exclude: ['**/node_modules/**', '**/.kilo/**', '**/dist/**'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Serve + register the service worker in dev too (registers /sw.js in the
      // dev middleware). Without this, dev has NO SW and code that awaited
      // navigator.serviceWorker.ready would hang forever.
      devOptions: { enabled: true },
      includeAssets: ['favicon.ico', 'icons.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'push-sw.js'],
      manifest: {
        name: 'Habit Tracker',
        short_name: 'Habits',
        description: 'Personal habit tracking with streaks, scores, and charts.',
        theme_color: '#070A12',
        background_color: '#070A12',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        importScripts: ['push-sw.js'],
      },
    }),
  ],
})