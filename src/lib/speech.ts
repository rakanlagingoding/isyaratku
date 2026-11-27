// Text-to-speech (PRD F6). Pure TypeScript, no React.
// Primary: Azure neural voice through /api/tts (server holds the key). Fallback: Web Speech, used
// when offline, when /api/tts fails or is not configured, or after a 3 s timeout.

import prosody from '../data/prosody.json';
import type { Emotion } from '../types';

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'name'>;
type AudioLike = Pick<HTMLAudioElement, 'src' | 'play' | 'pause' | 'onended' | 'onerror'>;

export type SpeechProvider = 'azure' | 'webspeech';

export type SpeechEnv = {
  synth?: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'getVoices'>;
  Utterance?: typeof SpeechSynthesisUtterance;
  /** Azure path; all of fetchImpl, audio, objectUrl and state are needed for it. */
  fetchImpl?: typeof fetch;
  /** One shared element, so the iOS unlock done in a tap carries over to later sentences. */
  audio?: AudioLike;
  objectUrl?: { create: (blob: Blob) => string; revoke: (url: string) => void };
  online?: () => boolean;
  state?: { azureOff: boolean; pending?: AbortController; url?: string };
};

export type SpeakOptions = {
  emotion?: Emotion;
  /** Default 'azure' (falls back to Web Speech by itself). */
  provider?: SpeechProvider;
  /** Azure voice name from prosody.json `azureVoices`; the server default when omitted. */
  voice?: string;
  /** Called when the speech finishes or fails (drives the "Suara" stage). Not called when stopped. */
  onEnd?: () => void;
};

export const AZURE_TIMEOUT_MS = 3000; // PRD F6

// 1-sample silent WAV, played from a tap to unlock the audio element on iOS.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiUAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQEAAACA';

let cachedEnv: SpeechEnv | null = null;

function browserEnv(): SpeechEnv {
  if (typeof window === 'undefined') return {};
  return (cachedEnv ??= {
    synth: window.speechSynthesis,
    Utterance: window.SpeechSynthesisUtterance,
    fetchImpl: (input, init) => fetch(input, init),
    audio: typeof Audio === 'undefined' ? undefined : new Audio(),
    objectUrl: { create: (b) => URL.createObjectURL(b), revoke: (u) => URL.revokeObjectURL(u) },
    online: () => navigator.onLine,
    state: { azureOff: false },
  });
}

const hasAzure = (env: SpeechEnv) =>
  Boolean(env.fetchImpl && env.audio && env.objectUrl && env.state);

export function isSpeechSupported(env: SpeechEnv = browserEnv()): boolean {
  return Boolean(env.synth && env.Utterance) || hasAzure(env);
}

/** Web Speech pitch/rate from prosody.json: value = 1 + percent / 100. */
export function prosodyFor(emotion: Emotion): { pitch: number; rate: number } {
  const p = prosody.emotions[emotion];
  return { pitch: 1 + p.pitchPct / 100, rate: 1 + p.ratePct / 100 };
}

/** Exact id-ID voice first, then any Indonesian voice (some phones report `id_ID`). */
export function pickVoice<V extends VoiceLike>(voices: ReadonlyArray<V>): V | null {
  return (
    voices.find((v) => v.lang === 'id-ID') ??
    voices.find((v) => v.lang.toLowerCase().startsWith('id')) ??
    null
  );
}

function speakWebSpeech(text: string, emotion: Emotion, opts: SpeakOptions, env: SpeechEnv) {
  const { synth, Utterance } = env;
  if (!synth || !Utterance) return false;
  const utterance = new Utterance(text);
  utterance.lang = 'id-ID';
  const { pitch, rate } = prosodyFor(emotion);
  utterance.pitch = pitch;
  utterance.rate = rate;
  // Voices load asynchronously on some browsers; pick at speak time and fall back to the default voice.
  const voice = pickVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  if (opts.onEnd) utterance.onend = utterance.onerror = opts.onEnd;
  synth.speak(utterance);
  return true;
}

async function speakAzure(text: string, emotion: Emotion, opts: SpeakOptions, env: SpeechEnv) {
  // hasAzure(env) was checked by the caller.
  const { fetchImpl, audio, objectUrl, state } = env as Required<SpeechEnv>;
  const controller = new AbortController();
  state.pending = controller;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, AZURE_TIMEOUT_MS);
  try {
    const res = await fetchImpl('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Only the sentence + emotion label (+ voice name) leave the device (CLAUDE.md).
      body: JSON.stringify({ text, emotion, voice: opts.voice }),
      signal: controller.signal,
    });
    // 503 = no key on the server: skip Azure for the rest of the session.
    if (res.status === 503) state.azureOff = true;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = objectUrl.create(await res.blob());
    clearTimeout(timer);
    if (controller.signal.aborted) return objectUrl.revoke(url);
    state.url = url;
    audio.onended = audio.onerror = () => {
      releaseAudio(env);
      opts.onEnd?.();
    };
    audio.src = url;
    await audio.play();
    if (state.pending === controller) state.pending = undefined;
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted && !timedOut) return; // stopped or replaced by a newer sentence
    if (state.pending !== controller) return;
    state.pending = undefined;
    releaseAudio(env);
    console.warn('Azure TTS unavailable, using Web Speech', err);
    if (!speakWebSpeech(text, emotion, opts, env)) opts.onEnd?.();
  }
}

function releaseAudio(env: SpeechEnv) {
  const { audio, objectUrl, state } = env;
  if (audio) audio.onended = audio.onerror = null;
  if (state?.url) objectUrl?.revoke(state.url);
  if (state) state.url = undefined;
}

/**
 * Speak `text`, interrupting anything still being spoken. Returns false when nothing will be
 * spoken. With Azure the audio starts asynchronously; `onEnd` fires when it (or the fallback) ends.
 */
export function speak(
  text: string,
  opts: SpeakOptions = {},
  env: SpeechEnv = browserEnv(),
): boolean {
  if (!text.trim()) return false;
  stopSpeaking(env);
  const emotion = opts.emotion ?? 'netral';
  const useAzure =
    opts.provider !== 'webspeech' &&
    hasAzure(env) &&
    !env.state?.azureOff &&
    (env.online?.() ?? true);
  if (useAzure) {
    void speakAzure(text, emotion, opts, env);
    return true;
  }
  return speakWebSpeech(text, emotion, opts, env);
}

export function stopSpeaking(env: SpeechEnv = browserEnv()): void {
  if (env.state) {
    env.state.pending?.abort();
    env.state.pending = undefined;
  }
  releaseAudio(env);
  env.audio?.pause();
  env.synth?.cancel();
}

/**
 * Call from a tap handler (e.g. "Mulai"). iOS Safari blocks speechSynthesis and audio.play() until
 * one was started by a user gesture; the sentence-end speech comes from the camera loop, not a tap.
 */
export function unlockSpeech(env: SpeechEnv = browserEnv()): void {
  const { synth, Utterance, audio } = env;
  if (synth && Utterance) {
    const silent = new Utterance(' ');
    silent.volume = 0;
    synth.speak(silent);
  }
  if (audio && !env.state?.url) {
    audio.src = SILENT_WAV;
    audio.play().catch(() => {}); // unlock attempt only; a failure here changes nothing
  }
}
