// Copies the MediaPipe wasm loader + binary from node_modules into public/ so they are
// served from our own origin (fast on Vercel's CDN and on the local dev server) and always
// match the installed @mediapipe/tasks-vision version. Runs before `dev` and `build`.
//
// Only the ES-module build is copied: the detector runs in a module worker
// (FilesetResolver.forVisionTasks(url, true)).

import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const target = join(root, 'public', 'mediapipe', 'wasm');
const files = ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm'];

mkdirSync(target, { recursive: true });
for (const file of files) {
  const from = join(source, file);
  const to = join(target, file);
  let upToDate = false;
  try {
    const a = statSync(from);
    const b = statSync(to);
    upToDate = a.size === b.size && a.mtimeMs <= b.mtimeMs;
  } catch {
    // target missing -> copy
  }
  if (!upToDate) copyFileSync(from, to);
}
console.log(`MediaPipe wasm ready in public/mediapipe/wasm (${files.length} files)`);
