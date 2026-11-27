// Mode B client (PRD F5): ask /api/translate, fall back to Mode A on any failure so the user always
// gets a sentence (offline, no API key configured, quota, timeout, bad reply).

import type { SentenceFace } from '../emotion';
import { translateRuleBased } from './ruleBased';

export type ModeBResult = { sentence: string; fallback: boolean; latencyMs: number };

type Options = { fetchImpl?: typeof fetch; timeoutMs?: number };

/** Longer than the server's LLM_TIMEOUT_MS (4 s) so a slow-but-successful reply is not cut off. */
const DEFAULT_TIMEOUT_MS = 5000;

export async function translateModeB(
  glosses: readonly string[],
  face: SentenceFace,
  { fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: Options = {},
): Promise<ModeBResult> {
  const start = performance.now();
  const done = (sentence: string, fallback: boolean): ModeBResult => ({
    sentence,
    fallback,
    latencyMs: performance.now() - start,
  });
  try {
    const res = await fetchImpl('/api/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Only glosses + emotion label + flag leave the device (CLAUDE.md).
      body: JSON.stringify({ glosses, emotion: face.emotion, isQuestion: face.isQuestion }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { sentence } = (await res.json()) as { sentence?: unknown };
    if (typeof sentence !== 'string' || !sentence.trim()) throw new Error('No sentence');
    return done(sentence, false);
  } catch (err) {
    console.warn('Mode B unavailable, using Mode A', err);
    return done(translateRuleBased(glosses, { isQuestion: face.isQuestion }), true);
  }
}
