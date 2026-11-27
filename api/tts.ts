// POST /api/tts — neural voice (PRD F6): sentence + emotion -> MP3 via Azure Speech (tier F0).
// The key stays on the server. Only the sentence, an emotion label and a voice name from
// prosody.json are accepted (CLAUDE.md). The client falls back to Web Speech on any error.
// Runs as a Vercel function (`POST` export) and inside `vite dev`/`vite preview` (vite.config.ts).

import prosody from '../src/data/prosody.json';
import { MAX_SENTENCE_CHARS } from '../src/lib/translator/llm';
import type { Emotion } from '../src/types';
import { clientIp, createRateLimiter } from './_rateLimit';

type Env = Record<string, string | undefined>;

export type TtsDeps = {
  env: Env;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type TtsInput = { text: string; emotion: Emotion; voice?: string };

const DEFAULT_REGION = 'southeastasia';
const VOICES: readonly string[] = Object.values(prosody.azureVoices);
const EMOTIONS = Object.keys(prosody.emotions) as Emotion[];
const AZURE_TIMEOUT_MS = 3000; // PRD F6: the client gives up after 3 s anyway
const RATE_LIMIT = 30; // requests per IP per window (PRD §10)
const RATE_WINDOW_MS = 60_000;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/** Trust boundary: reject anything that is not a short sentence + known emotion + known voice. */
export function validateTtsInput(body: unknown): TtsInput {
  if (typeof body !== 'object' || body === null) throw new Error('Body harus objek JSON');
  const { text, emotion = 'netral', voice } = body as Record<string, unknown>;
  if (typeof text !== 'string' || !text.trim()) throw new Error('text kosong');
  if (text.length > MAX_SENTENCE_CHARS) throw new Error('text terlalu panjang');
  if (typeof emotion !== 'string' || !EMOTIONS.includes(emotion as Emotion)) {
    throw new Error('emotion tidak valid');
  }
  if (voice !== undefined && (typeof voice !== 'string' || !VOICES.includes(voice))) {
    throw new Error('voice tidak dikenal');
  }
  return { text: text.trim(), emotion: emotion as Emotion, voice };
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c] ?? c);
const signedPct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;

/** SSML with the emotion's pitch/rate from prosody.json; the text is escaped (no tag injection). */
export function buildSsml(text: string, emotion: Emotion, voice: string): string {
  const { pitchPct, ratePct } = prosody.emotions[emotion];
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="id-ID">` +
    `<voice name="${escapeXml(voice)}">` +
    `<prosody pitch="${signedPct(pitchPct)}" rate="${signedPct(ratePct)}">${escapeXml(text)}</prosody>` +
    `</voice></speak>`
  );
}

export function createTtsHandler({ env, fetchImpl = fetch, now = Date.now }: TtsDeps) {
  const limited = createRateLimiter(RATE_LIMIT, RATE_WINDOW_MS, now);

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Gunakan POST' }, 405);
    if (limited(clientIp(request))) {
      return json({ error: 'Terlalu banyak permintaan, coba lagi sebentar' }, 429);
    }

    let input: TtsInput;
    try {
      input = validateTtsInput(await request.json());
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Input tidak valid' }, 400);
    }

    const key = env.AZURE_SPEECH_KEY;
    if (!key)
      return json({ error: 'Suara Azure belum dikonfigurasi (AZURE_SPEECH_KEY kosong)' }, 503);

    const region = env.AZURE_SPEECH_REGION || DEFAULT_REGION;
    const voice = input.voice ?? (env.AZURE_TTS_VOICE || prosody.azureVoices.perempuan);
    try {
      const res = await fetchImpl(
        `https://${encodeURIComponent(region)}.tts.speech.microsoft.com/cognitiveservices/v1`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'isyaratku',
          },
          body: buildSsml(input.text, input.emotion, voice),
          signal: AbortSignal.timeout(AZURE_TIMEOUT_MS),
        },
      );
      if (!res.ok) throw new Error(`Azure HTTP ${res.status}`);
      return new Response(await res.arrayBuffer(), {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
      });
    } catch (err) {
      // Log server-side only; provider errors may echo request details.
      console.error('Azure TTS failed', err instanceof Error ? err.message : err);
      return json({ error: 'Layanan suara gagal' }, 502);
    }
  };
}

// Vercel function entry. `process` exists on the server only; the app's tsconfig has DOM types.
const serverEnv = (globalThis as { process?: { env: Env } }).process?.env ?? {};
const handler = createTtsHandler({ env: serverEnv });
export const POST = (request: Request) => handler(request);
