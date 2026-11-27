import { describe, expect, it, vi } from 'vitest';
import { createTranslateHandler } from './translate';

const geminiReply = (sentence: string) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ sentence }) }] } }],
    }),
  );

const post = (body: unknown, ip = '1.1.1.1') =>
  new Request('http://app.test/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

const env = { LLM_API_KEY: 'test-key', LLM_MODEL: 'gemini-test' };

describe('api/translate', () => {
  it('asks Gemini with the server key and returns the sentence', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(geminiReply('Saya sudah makan.')));
    const handle = createTranslateHandler({ env, fetchImpl });
    const res = await handle(post({ glosses: ['SAYA', 'MAKAN', 'SUDAH'] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sentence: 'Saya sudah makan.' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/models/gemini-test:generateContent');
    expect(url).not.toContain('test-key'); // key goes in a header, never in the URL
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
  });

  it('rejects invalid input with 400 without calling the LLM', async () => {
    const fetchImpl = vi.fn();
    const handle = createTranslateHandler({ env, fetchImpl });
    const res = await handle(post({ glosses: ['bukan gloss'] }));
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('only accepts POST', async () => {
    const handle = createTranslateHandler({ env, fetchImpl: vi.fn() });
    expect((await handle(new Request('http://app.test/api/translate'))).status).toBe(405);
  });

  it('answers 503 when no API key is configured (client falls back to Mode A)', async () => {
    const handle = createTranslateHandler({ env: {}, fetchImpl: vi.fn() });
    expect((await handle(post({ glosses: ['SAYA'] }))).status).toBe(503);
  });

  it('answers 502 when Gemini fails or replies nonsense, without leaking details', async () => {
    const failing = createTranslateHandler({
      env,
      fetchImpl: () =>
        Promise.resolve(new Response('quota exceeded for key test-key', { status: 429 })),
    });
    const res = await failing(post({ glosses: ['SAYA'] }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('test-key');
    const nonsense = createTranslateHandler({
      env,
      fetchImpl: () => Promise.resolve(geminiReply('')),
    });
    expect((await nonsense(post({ glosses: ['SAYA'] }))).status).toBe(502);
  });

  it('limits each IP to 30 requests per minute', async () => {
    let t = 0;
    const handle = createTranslateHandler({
      env,
      fetchImpl: () => Promise.resolve(geminiReply('Saya.')),
      now: () => t,
    });
    for (let i = 0; i < 30; i++)
      expect((await handle(post({ glosses: ['SAYA'] }))).status).toBe(200);
    expect((await handle(post({ glosses: ['SAYA'] }))).status).toBe(429);
    expect((await handle(post({ glosses: ['SAYA'] }, '2.2.2.2'))).status).toBe(200); // other IP
    t = 60_001;
    expect((await handle(post({ glosses: ['SAYA'] }))).status).toBe(200); // new window
  });
});
