import { create } from 'zustand';
import { translateRuleBased } from '../lib/translator/ruleBased';
import type { RecognitionMode } from '../types';

// Live state of the Translate page (not persisted).
type ActiveLetter = { label: string; confidence: number };

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
  start: () => void;
  pause: () => void;
  setMode: (mode: RecognitionMode) => void;
  addGloss: (gloss: string) => void;
  removeGloss: (index: number) => void;
  setWordBuffer: (letters: string) => void;
  setActive: (active: ActiveLetter | null) => void;
  setSpeaking: (speaking: boolean) => void;
  finishSentence: (text: string) => void;
  /**
   * End the sentence from the chips still on screen (removed chips are not spoken).
   * Returns the text to speak, or '' when no chip is left (the sentence is then left unchanged).
   */
  takeSentence: () => string;
  clear: () => void;
};

export const useSessionStore = create<SessionState>()((set, get) => ({
  running: false,
  mode: 'letters',
  glosses: [],
  wordBuffer: '',
  active: null,
  sentence: '',
  speaking: false,
  start: () => set({ running: true }),
  pause: () => set({ running: false, active: null, wordBuffer: '' }),
  setMode: (mode) => set({ mode, wordBuffer: '', active: null }),
  addGloss: (gloss) => set((s) => ({ glosses: [...s.glosses, gloss] })),
  removeGloss: (index) => set((s) => ({ glosses: s.glosses.filter((_, i) => i !== index) })),
  setWordBuffer: (wordBuffer) => set({ wordBuffer }),
  setActive: (active) => set({ active }),
  setSpeaking: (speaking) => set({ speaking }),
  finishSentence: (sentence) => set({ sentence, glosses: [], wordBuffer: '' }),
  takeSentence: () => {
    const text = translateRuleBased(get().glosses); // Mode A (F5); Mode B comes with api/translate
    if (text) get().finishSentence(text);
    return text;
  },
  clear: () =>
    set({
      running: false,
      glosses: [],
      wordBuffer: '',
      active: null,
      sentence: '',
      speaking: false,
    }),
}));

/**
 * Which stage is running now. Ekspresi (face, F13) is not built yet, so it is never current.
 * Interpretasi = glosses are collected and wait for the end of the sentence.
 */
export function currentStage(s: {
  running: boolean;
  speaking: boolean;
  wordBuffer: string;
  glosses: readonly string[];
}): Stage | null {
  if (s.speaking) return 'suara';
  if (!s.running) return null;
  return s.glosses.length > 0 && !s.wordBuffer ? 'interpretasi' : 'tangan';
}
