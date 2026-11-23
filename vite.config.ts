/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// HTTPS in dev is needed so a phone on the same network can open the camera.
// Set VITE_NO_SSL=1 to run plain HTTP (e.g. localhost-only testing).
const useSsl = process.env.VITE_NO_SSL !== '1';

// PWA (PRD F12). The app shell is precached; MediaPipe wasm and the TF.js / MediaPipe models are
// too large for the install step and are cached on first use instead (DECISIONS #30).
const pwa = VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'IsyaratKu',
    short_name: 'IsyaratKu',
    description: 'Penerjemah bahasa isyarat BISINDO ke suara',
    lang: 'id',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#0f172a',
    background_color: '#0f172a',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    // Manifest icons are added by the plugin itself; listing png here would precache them twice.
    globPatterns: ['**/*.{js,css,html,svg}'],
    globIgnores: ['mediapipe/**', 'models/**'],
    navigateFallbackDenylist: [/^\/api\//],
    maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
    runtimeCaching: [
      {
        urlPattern: /\/(mediapipe|models)\//,
        handler: 'CacheFirst',
        options: { cacheName: 'isyaratku-models' },
      },
    ],
  },
});

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(useSsl && mode !== 'test' ? [basicSsl()] : []),
    ...(mode !== 'test' ? [pwa] : []),
  ],
  // The hand detector runs in a module worker (src/workers/handDetector.worker.ts).
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
