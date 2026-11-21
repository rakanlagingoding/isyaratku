/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS in dev is needed so a phone on the same network can open the camera.
// Set VITE_NO_SSL=1 to run plain HTTP (e.g. localhost-only testing).
const useSsl = process.env.VITE_NO_SSL !== '1';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(useSsl && mode !== 'test' ? [basicSsl()] : [])],
  // The hand detector runs in a module worker (src/workers/handDetector.worker.ts).
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
