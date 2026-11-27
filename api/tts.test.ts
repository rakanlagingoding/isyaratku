import { describe, expect, it, vi } from 'vitest';
import { buildSsml, createTtsHandler } from './tts';

const post = (body: unknown, ip = '1.1.1.1') =>
  new Request('http://app.test/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

const env = { AZURE_SPEECH_KEY: 'test-key', AZURE_SPEECH_REGION: 'southeastasia' };
const mp3 = () => Promise.resolve(new Response(new Uint8Array([0x49, 0x44, 0x33])));

describe('buildSsml', () => {
  it('applies the emotion prosody from prosody.json', () => {
    const ssml = buildSsml('Halo', 'senang', 'id-ID-GadisNeural');
    expect(ssml).toContain('xml:lang="id-ID"');
    expect(ssml).toContain('<voice name="id-ID-GadisNeural">');
    expect(ssml).toContain('<prosody pitch="+8%" rate="+5%">Halo</prosody>');
    expect(buildSsml('Halo', 'sedih', 'v')).toContain('pitch="-8%" rate="-12%"');
  });

  it('escapes the text so it cannot inject SSML tags', () => {
    const ssml = buildSsml('a < b & "c" </prosody><break/>', 'netral', 'v');
    expect(ssml).not.toContain('<break/>');
    expect(ssml).toContain('a &lt; b &amp; &quot;c&quot; &lt;/prosody&gt;&lt;break/&gt;');
  });
});

describe('api/tts', () => {
  it('asks Azure with the server key and returns MP3', async () => {
    const fetchImpl = vi.fn(mp3);
    const handle = createTtsHandler({ env, fetchImpl });
    const res = await handle(post({ text: 'Saya sudah makan.', emotion: 'senang' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('audio/mpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0x49, 0x44, 0x33]));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://southeastasia.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(url).not.toContain('test-key'); // key goes in a header, never in the URL
    const headers = init.headers as Record<string, string>;
    expect(headers['Ocp-Apim-Subscription-Key']).toBe('test-key');
    expect(init.body).toContain('id-ID-GadisNeural'); // default voice
    expect(init.body).toContain('pitch="+8%"');
  });

  it('uses a requested voice from prosody.json', async () => {
    const fetchImpl = vi.fn(mp3);
    const handle = createTtsHandler({ env, fetchImpl });
    await handle(post({ text: 'Halo', voice: 'id-ID-ArdiNeural' }));
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toContain('id-ID-ArdiNeural');
  });

  it('rejects invalid input with 400 without calling Azure', async () => {
    const fetchImpl = vi.fn();
    const handle = createTtsHandler({ env, fetchImpl });
    for (const body of [
      {},
      { text: '   ' },
      { text: 'x'.repeat(301) },
      { text: 'Halo', emotion: 'bingung' },
      { text: 'Halo', voice: 'en-US-JennyNeural' },
    ]) {
      expect((await handle(post(body))).status).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('only accepts POST', async () => {
    const handle = createTtsHandler({ env, fetchImpl: vi.fn() });
    expect((await handle(new Request('http://app.test/api/tts'))).status).toBe(405);
  });

  it('answers 503 when no key is configured (client falls back to Web Speech)', async () => {
    const handle = createTtsHandler({ env: {}, fetchImpl: vi.fn() });
    expect((await handle(post({ text: 'Halo' }))).status).toBe(503);
  });

  it('answers 502 when Azure fails, without leaking details', async () => {
    const handle = createTtsHandler({
      env,
      fetchImpl: () => Promise.resolve(new Response('bad key test-key', { status: 401 })),
    });
    const res = await handle(post({ text: 'Halo' }));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain('test-key');
  });

  it('limits each IP to 30 requests per minute', async () => {
    const handle = createTtsHandler({ env, fetchImpl: mp3, now: () => 0 });
    for (let i = 0; i < 30; i++) expect((await handle(post({ text: 'Halo' }))).status).toBe(200);
    expect((await handle(post({ text: 'Halo' }))).status).toBe(429);
  });
});
