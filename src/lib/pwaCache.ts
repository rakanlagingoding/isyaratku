// Service-worker runtime caching for large assets (PRD F12, DECISIONS #30). Pure TypeScript, used by
// vite.config.ts. Workbox copies these functions into sw.js as source text, so every function here
// must be self-contained (no imports or outer variables inside its body).

/**
 * Workbox `cacheWillUpdate`: store only real files. The dev/preview server (and the hosting rewrite)
 * answers a missing file such as /models/signs/model.json with index.html and status 200; caching that
 * would pin the app in mock mode even after the model ships.
 */
export async function keepOnlyRealFiles({
  response,
}: {
  response: Response;
}): Promise<Response | null> {
  if (!response.ok) return null;
  const type = response.headers.get('content-type') ?? '';
  return type.includes('text/html') ? null : response;
}

export type ModelCacheRule = {
  /** Matched by Workbox against the full URL (href); anchored to the path right after the host. */
  urlPattern: RegExp;
  handler: 'NetworkFirst' | 'CacheFirst';
  options: {
    cacheName: string;
    networkTimeoutSeconds?: number;
    plugins: Array<{ cacheWillUpdate: typeof keepOnlyRealFiles }>;
  };
};

/**
 * - /models/*: NetworkFirst. Retrained models keep the same file names, so they must be revalidated on
 *   each load (cheap thanks to HTTP ETag/304); the cached copy is the offline fallback.
 * - /mediapipe/*: CacheFirst in a cache named after the @mediapipe/tasks-vision version, so an upgrade
 *   (new JS in the precache) never runs against old wasm.
 */
export function modelRuntimeCaching(mediapipeVersion: string): ModelCacheRule[] {
  const plugins = [{ cacheWillUpdate: keepOnlyRealFiles }];
  return [
    {
      urlPattern: /^https?:\/\/[^/]+\/models\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'isyaratku-models', networkTimeoutSeconds: 4, plugins },
    },
    {
      urlPattern: /^https?:\/\/[^/]+\/mediapipe\//,
      handler: 'CacheFirst',
      options: { cacheName: `isyaratku-mediapipe-${mediapipeVersion}`, plugins },
    },
  ];
}
