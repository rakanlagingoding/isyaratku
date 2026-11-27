import { create } from 'zustand';
import { translateRuleBased } from '../lib/translator/ruleBased';
import type { SentenceFace } from '../lib/emotion';
import type { Emotion, Prediction, RecognitionMode } from '../types';

// Live state of the Translate page (not persisted).
type ActiveLetter = Prediction;

/** The 4 stages shown in StageBar (PRD F7). */
export type Stage = 'tangan' | 'ekspresi' | 'interpretasi' | 'suara';

type SessionState = {
  running: boolean;
  mode: RecognitionMode;
  /** Accepted glosses of the current sentence (chips). */
  glosses: string[];
  /** Letters of the word being spelled. */
  wordBuffer: string;
  /** What the model sees right now, for the confidence hint. */
  active: ActiveLetter | null;
  /** Last finished sentence (caption + "Ucapkan ulang"). */
  sentence: string;
  /** Text-to-speech is playing. */
  speaking: boolean;
  /** Live face emotion (F13); null = no face seen. */
  emotion: Emotion | null;
  /** Face summary of the last finished sentence (voice tone + replay). */
  sentenceFace: SentenceFace;
  /** Mode B request in flight. */
  translating: boolean;
  /** Last sentence came from Mode A because Mode B failed. */
  sentenceFallback: boolean;
  start: () => void;
  pause: () => void;
  setMode: (mode: RecognitionMode) => void;
  addGloss: (gloss: string) => void;
  removeGloss: (index: number) => void;
  setWordBuffer: (letters: string) => void;
  setActive: (active: ActiveLetter | null) => void;
  setSpeaking: (speaking: boolean) => void;
  setEmotion: (emotion: Emotion | null) => void;
  finishSentence: (text: string) => void;
  /**
   * End the sentence from the chips still on screen (removed chips are not spoken).
   * Returns the text to speak, or '' when no chip is left (the sentence is then left unchanged).
   */
  takeSentence: (face?: SentenceFace) => string;
  /** Mode B: take the chips for an async translation; signs made meanwhile start the next sentence. */
  beginTranslation: () => string[];
  endTranslation: (text: string, face: SentenceFace, fallback: boolean) => void;
  clear: () => void;
};

const NEUTRAL_FACE: SentenceFace = { emotion: 'netral', isQuestion: false };

export const useSessionStore = create<SessionState>()((set, get) => ({
  running: false,
  mode: 'letters',
  glosses: [],
  wordBuffer: '',
  active: null,
  sentence: '',
  speaking: false,
  emotion: null,
  sentenceFace: NEUTRAL_FACE,
  translating: false,
  sentenceFallback: false,
  start: () => set({ running: true }),
  pause: () => set({ running: false, active: null, wordBuffer: '', emotion: null }),
  setMode: (mode) => set({ mode, wordBuffer: '', active: null }),
  addGloss: (gloss) => set((s) => ({ glosses: [...s.glosses, gloss] })),
  removeGloss: (index) => set((s) => ({ glosses: s.glosses.filter((_, i) => i !== index) })),
  setWordBuffer: (wordBuffer) => set({ wordBuffer }),
  setActive: (active) => set({ active }),
  setSpeaking: (speaking) => set({ speaking }),
  setEmotion: (emotion) => set({ emotion }),
  finishSentence: (sentence) => set({ sentence, glosses: [], wordBuffer: '' }),
  takeSentence: (face = NEUTRAL_FACE) => {
    // Mode A (F5) with R9: raised brows -> question; Mode B comes with api/translate.
    const text = translateRuleBased(get().glosses, { isQuestion: face.isQuestion });
    if (text) {
      get().finishSentence(text);
      set({ sentenceFace: face, sentenceFallback: false });
    }
    return text;
  },
  beginTranslation: () => {
    const glosses = get().glosses;
    set({ glosses: [], wordBuffer: '', translating: glosses.length > 0 });
    return glosses;
  },
  endTranslation: (text, face, fallback) =>
    set({ sentence: text, sentenceFace: face, sentenceFallback: fallback, translating: false }),
  clear: () =>
    set({
      running: false,
      glosses: [],
      wordBuffer: '',
      active: null,
      sentence: '',
      speaking: false,
      emotion: null,
      sentenceFace: NEUTRAL_FACE,
      translating: false,
      sentenceFallback: false,
    }),
}));

/**
 * Which stage is running now. Ekspresi (face, F13) runs alongside Tangan on the same frames, so the
 * bar stays on Tangan; its live state is in the Ekspresi detail.
 * Interpretasi = glosses are collected and wait for the end of the sentence.
 */
export function currentStage(s: {
  running: boolean;
  speaking: boolean;
  wordBuffer: string;
  glosses: readonly string[];
  translating?: boolean;
}): Stage | null {
  if (s.speaking) return 'suara';
  if (s.translating) return 'interpretasi';
  if (!s.running) return null;
  return s.glosses.length > 0 && !s.wordBuffer ? 'interpretasi' : 'tangan';
}
