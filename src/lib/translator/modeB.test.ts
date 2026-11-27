import { describe, expect, it, vi } from 'vitest';
import { translateModeB } from './modeB';

const neutral = { emotion: 'netral' as const, isQuestion: false };
const ok = (sentence: string) => () => Promise.resolve(new Response(JSON.stringify({ sentence })));

describe('translateModeB', () => {
  it('returns the LLM sentence and sends only glosses + face signal', async () => {
    const fetchImpl = vi.fn(ok('Saya sudah makan, lho.'));
    const r = await translateModeB(['SAYA', 'MAKAN', 'SUDAH'], neutral, { fetchImpl });
    expect(r).toMatchObject({ sentence: 'Saya sudah makan, lho.', fallback: false });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/translate');
    expect(JSON.parse(String(init.body))).toEqual({
      glosses: ['SAYA', 'MAKAN', 'SUDAH'],
      emotion: 'netral',
      isQuestion: false,
    });
  });

  it('falls back to Mode A when the server answers an error', async () => {
    const fetchImpl = () => Promise.resolve(new Response('{"error":"x"}', { status: 503 }));
    const r = await translateModeB(['SAYA', 'MAKAN', 'SUDAH'], neutral, { fetchImpl });
    expect(r).toMatchObject({ sentence: 'Saya sudah makan.', fallback: true });
  });

  it('falls back to Mode A when offline', async () => {
    const fetchImpl = () => Promise.reject(new TypeError('Failed to fetch'));
    const r = await translateModeB(
      ['KAMU', 'MAKAN', 'SUDAH'],
      { emotion: 'netral', isQuestion: true },
      {
        fetchImpl,
      },
    );
    expect(r).toMatchObject({ sentence: 'Kamu sudah makan?', fallback: true }); // R9 kept in fallback
  });

  it('falls back to Mode A after the timeout', async () => {
    const fetchImpl = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) =>
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('timeout', 'TimeoutError')),
        ),
      );
    const r = await translateModeB(['SAYA', 'MAKAN', 'SUDAH'], neutral, {
      fetchImpl,
      timeoutMs: 20,
    });
    expect(r).toMatchObject({ sentence: 'Saya sudah makan.', fallback: true });
  });

  it('falls back when the server reply has no sentence', async () => {
    const fetchImpl = () => Promise.resolve(new Response('{}'));
    const r = await translateModeB(['SAYA', 'MAKAN', 'SUDAH'], neutral, { fetchImpl });
    expect(r.fallback).toBe(true);
  });
});
