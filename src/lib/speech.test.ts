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
