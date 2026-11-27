// POST /api/translate — Mode B (PRD F5): glosses + face signal -> sentence via Google Gemini.
// The API key is read from the server environment (.env locally, Vercel env in production) and
// never reaches the browser. Only glosses, an emotion label and a flag are accepted (CLAUDE.md).
// Runs as a Vercel function (`POST` export) and inside `vite dev`/`vite preview` (vite.config.ts).

import {
  buildGeminiRequest,
  parseGeminiResponse,
  validateTranslateInput,
  type TranslateInput,
} from '../src/lib/translator/llm';

type Env = Record<string, string | undefined>;

export type TranslateDeps = {
  env: Env;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const RATE_LIMIT = 30; // requests per IP per window (PRD §10)
const RATE_WINDOW_MS = 60_000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export function createTranslateHandler({ env, fetchImpl = fetch, now = Date.now }: TranslateDeps) {
  // shortcut: per-process memory, so each server instance counts separately; fine for a class demo,
  // use a shared store (e.g. Vercel KV) if the app gets real traffic.
  const hits = new Map<string, { start: number; count: number }>();

  const limited = (ip: string): boolean => {
    const t = now();
    const entry = hits.get(ip);
    if (!entry || t - entry.start > RATE_WINDOW_MS) {
      hits.set(ip, { start: t, count: 1 });
      return false;
    }
    entry.count++;
    return entry.count > RATE_LIMIT;
  };

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (limited(ip)) return json({ error: 'Terlalu banyak permintaan, coba lagi sebentar' }, 429);

    let input;
    try {
      input = validateTranslateInput(await request.json());
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Input tidak valid' }, 400);
    }

    if (!env.LLM_API_KEY) {
      return json({ error: 'Mode B belum dikonfigurasi (LLM_API_KEY kosong)' }, 503);
    }
    try {
      return json({ sentence: await callGemini(input, env, fetchImpl) });
    } catch (err) {
      // Log server-side only; provider errors may echo request details.
      console.error('Gemini request failed', err instanceof Error ? err.message : err);
      return json({ error: 'Layanan LLM gagal' }, 502);
    }
  };
}

/** One Gemini call (also used by eval/run_eval.mjs). Throws on HTTP errors, timeouts, bad replies. */
export async function callGemini(
  input: TranslateInput,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const key = env.LLM_API_KEY;
  if (!key) throw new Error('LLM_API_KEY kosong');
  const base = env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const model = env.LLM_MODEL || DEFAULT_MODEL;
  const res = await fetchImpl(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(buildGeminiRequest(input)),
    signal: AbortSignal.timeout(Number(env.LLM_TIMEOUT_MS) || 4000),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  return parseGeminiResponse(await res.json());
}

// Vercel function entry. `process` exists on the server only; the app's tsconfig has DOM types.
const serverEnv = (globalThis as { process?: { env: Env } }).process?.env ?? {};
const handler = createTranslateHandler({ env: serverEnv });
export const POST = (request: Request) => handler(request);
