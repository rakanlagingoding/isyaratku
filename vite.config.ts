/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { modelRuntimeCaching } from './src/lib/pwaCache';
import { createTranslateHandler } from './api/translate';
import { createTtsHandler } from './api/tts';

// HTTPS in dev is needed so a phone on the same network can open the camera.
// Set VITE_NO_SSL=1 to run plain HTTP (e.g. localhost-only testing).
const useSsl = process.env.VITE_NO_SSL !== '1';

// Names the MediaPipe wasm cache, so a package upgrade starts a fresh cache (the package's "exports"
// field hides package.json from require(), hence the file read).
const mediapipeVersion: string = JSON.parse(
  readFileSync('node_modules/@mediapipe/tasks-vision/package.json', 'utf8'),
).version;

// PWA (PRD F12). The app shell is precached; MediaPipe wasm and the TF.js / MediaPipe models are
// too large for the install step and are cached at runtime (src/lib/pwaCache.ts, DECISIONS #30).
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
    runtimeCaching: modelRuntimeCaching(mediapipeVersion),
  },
});

/**
 * Serve api/translate.ts and api/tts.ts inside `vite dev` and `vite preview` (Vite does not run the
 * api/ folder; DECISIONS #18, #40). Reads only LLM_* and AZURE_* variables from .env; they never
 * reach the client bundle, which only sees VITE_* variables.
 */
function apiPlugin(mode: string): Plugin {
  const env = loadEnv(mode, process.cwd(), ['LLM_', 'AZURE_']);
  const routes: Record<string, (request: Request) => Promise<Response>> = {
    '/api/translate': createTranslateHandler({ env }),
    '/api/tts': createTtsHandler({ env }),
  };
  const mount = (middlewares: Connect.Server) => {
    for (const [path, handle] of Object.entries(routes)) {
      middlewares.use(path, (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const ip = req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress ?? 'local';
          const request = new Request(`http://localhost${path}`, {
            method: req.method,
            headers: {
              'content-type': req.headers['content-type'] ?? 'application/json',
              'x-forwarded-for': String(ip),
            },
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          });
          void handle(request).then(async (response) => {
            res.statusCode = response.status;
            response.headers.forEach((value, key) => res.setHeader(key, value));
            // Binary-safe: /api/tts answers MP3.
            res.end(Buffer.from(await response.arrayBuffer()));
          });
        });
      });
    }
  };
  return {
    name: 'isyaratku-api',
    configureServer: (server) => void mount(server.middlewares),
    configurePreviewServer: (server) => void mount(server.middlewares),
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // `--mode tunnel`: plain HTTP on localhost; Cloudflare's tunnel adds a valid HTTPS certificate.
    ...(useSsl && mode !== 'test' && mode !== 'tunnel' ? [basicSsl()] : []),
    ...(mode !== 'test' ? [pwa, apiPlugin(mode)] : []),
  ],
  // Quick tunnel URLs look like https://<random>.trycloudflare.com (DECISIONS #30).
  server: { allowedHosts: ['.trycloudflare.com'] },
  preview: { allowedHosts: ['.trycloudflare.com'] },
  // The hand detector runs in a module worker (src/workers/handDetector.worker.ts).
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'eval/**/*.test.ts', 'api/**/*.test.ts'],
  },
}));
