import { describe, expect, it, vi } from 'vitest';
import {
  isSpeechSupported,
  pickVoice,
  prosodyFor,
  speak,
  unlockSpeech,
  stopSpeaking,
  type SpeechEnv,
} from './speech';

class FakeUtterance {
  text: string;
  lang = '';
  pitch = 1;
  rate = 1;
  volume = 1;
  voice: unknown = null;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeEnv(voices: Array<{ lang: string; name: string }> = []) {
  const calls: string[] = [];
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((u: FakeUtterance) => {
      calls.push('speak');
      spoken.push(u);
    }),
    cancel: vi.fn(() => calls.push('cancel')),
    getVoices: vi.fn(() => voices),
  };
  const env = {
    synth,
    Utterance: FakeUtterance,
  } as unknown as SpeechEnv; // fake objects only implement what speech.ts uses
  return { env, synth, calls, spoken };
}

describe('prosodyFor', () => {
  it('maps prosody.json percentages to Web Speech pitch and rate', () => {
    expect(prosodyFor('netral')).toEqual({ pitch: 1, rate: 1 });
    const sad = prosodyFor('sedih');
    expect(sad.pitch).toBeCloseTo(0.92);
    expect(sad.rate).toBeCloseTo(0.88);
  });
});

describe('pickVoice', () => {
  it('prefers an exact id-ID voice, then any Indonesian voice', () => {
    const idId = { lang: 'id-ID', name: 'Google Bahasa Indonesia' };
    expect(pickVoice([{ lang: 'en-US', name: 'en' }, { lang: 'id_ID', name: 'x' }, idId])).toBe(
      idId,
    );
    const loose = { lang: 'id_ID', name: 'x' };
    expect(pickVoice([{ lang: 'en-US', name: 'en' }, loose])).toBe(loose);
  });

  it('returns null when no Indonesian voice exists', () => {
    expect(pickVoice([{ lang: 'en-US', name: 'en' }])).toBeNull();
  });
});

describe('speak', () => {
  it('cancels the previous utterance, then speaks in id-ID with neutral prosody', () => {
    const voice = { lang: 'id-ID', name: 'id' };
    const { env, calls, spoken } = fakeEnv([voice]);
    expect(speak('Rakan', {}, env)).toBe(true);
    expect(calls).toEqual(['cancel', 'speak']);
    expect(spoken[0]).toMatchObject({ text: 'Rakan', lang: 'id-ID', pitch: 1, rate: 1, voice });
  });

  it('still speaks with the default voice when no voices are loaded yet', () => {
    const { env, spoken } = fakeEnv([]);
    expect(speak('Rakan', {}, env)).toBe(true);
    expect(spoken[0]?.voice).toBeNull();
  });

  it('applies the emotion prosody', () => {
    const { env, spoken } = fakeEnv();
    speak('Halo', { emotion: 'senang' }, env);
    expect(spoken[0]?.pitch).toBeCloseTo(1.08);
    expect(spoken[0]?.rate).toBeCloseTo(1.05);
  });

  it('does nothing for blank text or without speech support', () => {
    const { env, synth } = fakeEnv();
    expect(speak('   ', {}, env)).toBe(false);
    expect(synth.speak).not.toHaveBeenCalled();
    expect(speak('Rakan', {}, {})).toBe(false);
    expect(isSpeechSupported({})).toBe(false);
    expect(isSpeechSupported(env)).toBe(true);
  });
});

describe('speak onEnd', () => {
  it('calls onEnd when the utterance finishes or fails', () => {
    const { env, spoken } = fakeEnv();
    let ended = 0;
    speak('Rakan', { onEnd: () => ended++ }, env);
    const u = spoken[0] as unknown as { onend: () => void; onerror: () => void };
    u.onend();
    u.onerror();
    expect(ended).toBe(2);
  });
});

describe('stopSpeaking', () => {
  it('cancels speech', () => {
    const { env, synth } = fakeEnv();
    stopSpeaking(env);
    expect(synth.cancel).toHaveBeenCalled();
  });
});

describe('unlockSpeech', () => {
  it('speaks a silent utterance (iOS only allows speech after one started from a tap)', () => {
    const { env, spoken } = fakeEnv();
    unlockSpeech(env);
    expect(spoken).toHaveLength(1);
    expect(spoken[0]?.volume).toBe(0);
  });

  it('does nothing without speech support', () => {
    expect(() => unlockSpeech({})).not.toThrow();
  });
});

describe('speak with Azure', () => {
  function azureEnv(fetchImpl: () => Promise<Response>, online = true) {
    const base = fakeEnv([{ lang: 'id-ID', name: 'id' }]);
    const audio = {
      src: '',
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      onended: null as null | (() => void),
      onerror: null as null | (() => void),
    };
    const objectUrl = { create: vi.fn(() => 'blob:1'), revoke: vi.fn() };
    const fetchSpy = vi.fn(fetchImpl);
    const env = {
      ...base.env,
      fetchImpl: fetchSpy,
      audio,
      objectUrl,
      online: () => online,
      state: { azureOff: false },
    } as unknown as SpeechEnv; // fakes implement only what speech.ts uses
    return { ...base, env, audio, objectUrl, fetchSpy };
  }
  const flush = () => new Promise((r) => setTimeout(r, 0));
  const mp3 = () => Promise.resolve(new Response(new Blob([new Uint8Array([1])])));

  it('plays the Azure MP3 and sends only text, emotion and voice', async () => {
    const { env, audio, synth, fetchSpy, objectUrl } = azureEnv(mp3);
    let ended = 0;
    expect(speak('Halo', { emotion: 'senang', onEnd: () => ended++ }, env)).toBe(true);
    await flush();
    expect(audio.src).toBe('blob:1');
    expect(audio.play).toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/tts');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Halo', emotion: 'senang' });
    audio.onended?.();
    expect(ended).toBe(1);
    expect(objectUrl.revoke).toHaveBeenCalledWith('blob:1');
  });

  it('falls back to Web Speech when /api/tts fails', async () => {
    const { env, spoken } = azureEnv(() => Promise.resolve(new Response('x', { status: 502 })));
    speak('Halo', { emotion: 'sedih' }, env);
    await flush();
    expect(spoken[0]?.text).toBe('Halo');
    expect(spoken[0]?.pitch).toBeCloseTo(0.92);
  });

  it('falls back to Web Speech after the 3 s timeout', async () => {
    vi.useFakeTimers();
    try {
      // Like a real fetch: never answers, rejects when its signal aborts.
      const hanging = (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        );
      const { env, spoken } = azureEnv(hanging as unknown as () => Promise<Response>);
      speak('Halo', {}, env);
      await vi.advanceTimersByTimeAsync(2999);
      expect(spoken).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(1);
      expect(spoken[0]?.text).toBe('Halo');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back when play() is blocked (no unlock on iOS)', async () => {
    const { env, audio, spoken } = azureEnv(mp3);
    audio.play.mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
    speak('Halo', {}, env);
    await flush();
    expect(spoken[0]?.text).toBe('Halo');
  });

  it('skips Azure for the session after a 503 (no key on the server)', async () => {
    const { env, fetchSpy, spoken } = azureEnv(() =>
      Promise.resolve(new Response('x', { status: 503 })),
    );
    speak('Satu', {}, env);
    await flush();
    speak('Dua', {}, env);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(spoken.map((u) => u.text)).toEqual(['Satu', 'Dua']);
  });

  it('uses Web Speech directly when offline or when asked to', () => {
    const offline = azureEnv(mp3, false);
    speak('Halo', {}, offline.env);
    expect(offline.fetchSpy).not.toHaveBeenCalled();
    expect(offline.spoken).toHaveLength(1);
    const forced = azureEnv(mp3);
    speak('Halo', { provider: 'webspeech' }, forced.env);
    expect(forced.fetchSpy).not.toHaveBeenCalled();
    expect(forced.spoken).toHaveLength(1);
  });

  it('a newer sentence or stopSpeaking cancels the pending one without a fallback', async () => {
    const { env, audio, spoken } = azureEnv(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('aborted')), 0)),
    );
    let ended = 0;
    speak('Lama', { onEnd: () => ended++ }, env);
    stopSpeaking(env);
    await flush();
    expect(spoken).toHaveLength(0);
    expect(ended).toBe(0);
    expect(audio.pause).toHaveBeenCalled();
  });

  it('unlockSpeech also primes the shared audio element', () => {
    const { env, audio } = azureEnv(mp3);
    unlockSpeech(env);
    expect(audio.src).toMatch(/^data:audio\/wav/);
    expect(audio.play).toHaveBeenCalled();
  });
});
