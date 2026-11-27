// Text-to-speech with the Web Speech API (PRD F6). Pure TypeScript, no React.
// Azure neural TTS comes in Phase 7; this module is its offline fallback.

import prosody from '../data/prosody.json';
import type { Emotion } from '../types';

type VoiceLike = Pick<SpeechSynthesisVoice, 'lang' | 'name'>;

export type SpeechEnv = {
  synth?: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'getVoices'>;
  Utterance?: typeof SpeechSynthesisUtterance;
};

export type SpeakOptions = {
  emotion?: Emotion;
  /** Called when the utterance finishes or fails (drives the "Suara" stage). */
  onEnd?: () => void;
};

function browserEnv(): SpeechEnv {
  if (typeof window === 'undefined') return {};
  return { synth: window.speechSynthesis, Utterance: window.SpeechSynthesisUtterance };
}

export function isSpeechSupported(env: SpeechEnv = browserEnv()): boolean {
  return Boolean(env.synth && env.Utterance);
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

/** Speak `text`, interrupting anything still being spoken. Returns false when nothing was spoken. */
export function speak(
  text: string,
  opts: SpeakOptions = {},
  env: SpeechEnv = browserEnv(),
): boolean {
  const { synth, Utterance } = env;
  if (!synth || !Utterance || !text.trim()) return false;
  const utterance = new Utterance(text);
  utterance.lang = 'id-ID';
  const { pitch, rate } = prosodyFor(opts.emotion ?? 'netral');
  utterance.pitch = pitch;
  utterance.rate = rate;
  // Voices load asynchronously on some browsers; pick at speak time and fall back to the default voice.
  const voice = pickVoice(synth.getVoices());
  if (voice) utterance.voice = voice;
  if (opts.onEnd) utterance.onend = utterance.onerror = opts.onEnd;
  synth.cancel();
  synth.speak(utterance);
  return true;
}

export function stopSpeaking(env: SpeechEnv = browserEnv()): void {
  env.synth?.cancel();
}

/**
 * Call from a tap handler (e.g. "Mulai"). iOS Safari blocks speechSynthesis until one utterance
 * was started by a user gesture; the sentence-end speech comes from the camera loop, not a tap.
 */
export function unlockSpeech(env: SpeechEnv = browserEnv()): void {
  const { synth, Utterance } = env;
  if (!synth || !Utterance) return;
  const silent = new Utterance(' ');
  silent.volume = 0;
  synth.speak(silent);
}
