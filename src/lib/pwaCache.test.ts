import { describe, expect, it } from 'vitest';
import { keepOnlyRealFiles, modelRuntimeCaching } from './pwaCache';

const res = (status: number, type: string) =>
  new Response(status === 200 ? 'x' : null, { status, headers: { 'content-type': type } });

const ruleFor = (path: string) => {
  const url = new URL(`https://app.test${path}`);
  // Workbox matches a RegExp route against the full URL (url.href), not the path.
  return modelRuntimeCaching('1.2.3').find((r) => r.urlPattern.test(url.href));
};

describe('keepOnlyRealFiles (cacheWillUpdate)', () => {
  it('never caches the SPA fallback HTML served for a missing model file', async () => {
    expect(await keepOnlyRealFiles({ response: res(200, 'text/html; charset=utf-8') })).toBeNull();
  });

  it('never caches error responses', async () => {
    expect(await keepOnlyRealFiles({ response: res(404, 'application/json') })).toBeNull();
  });

  it('caches real model and wasm files', async () => {
    const json = res(200, 'application/json');
    expect(await keepOnlyRealFiles({ response: json })).toBe(json);
    const bin = res(200, 'application/octet-stream');
    expect(await keepOnlyRealFiles({ response: bin })).toBe(bin);
  });
});

describe('modelRuntimeCaching', () => {
  it('revalidates models on every load so retrained models reach installed apps', () => {
    const rule = ruleFor('/models/letters/model.json');
    expect(rule?.handler).toBe('NetworkFirst');
    expect(ruleFor('/models/letters/group1-shard1of1.bin')?.options.cacheName).toBe(
      'isyaratku-models',
    );
    expect(ruleFor('/models/hand_landmarker.task')?.options.cacheName).toBe('isyaratku-models');
  });

  it('caches MediaPipe wasm per package version, so an upgrade never mixes old wasm with new JS', () => {
    const rule = ruleFor('/mediapipe/wasm/vision_wasm_module_internal.wasm');
    expect(rule?.handler).toBe('CacheFirst');
    expect(rule?.options?.cacheName).toBe('isyaratku-mediapipe-1.2.3');
  });

  it('applies the real-file filter to both rules', () => {
    for (const rule of modelRuntimeCaching('1.2.3')) {
      expect(rule.options?.plugins?.[0]?.cacheWillUpdate).toBe(keepOnlyRealFiles);
    }
  });
});
