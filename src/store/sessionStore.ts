import { create } from 'zustand';
import { glossesToText } from '../lib/segmenter';
import type { RecognitionMode } from '../types';

// Live state of the Translate page (not persisted).
type ActiveLetter = { label: string; confidence: number };

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
  start: () => void;
  pause: () => void;
  setMode: (mode: RecognitionMode) => void;
  addGloss: (gloss: string) => void;
  removeGloss: (index: number) => void;
  setWordBuffer: (letters: string) => void;
  setActive: (active: ActiveLetter | null) => void;
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
  start: () => set({ running: true }),
  pause: () => set({ running: false, active: null, wordBuffer: '' }),
  setMode: (mode) => set({ mode }),
  addGloss: (gloss) => set((s) => ({ glosses: [...s.glosses, gloss] })),
  removeGloss: (index) => set((s) => ({ glosses: s.glosses.filter((_, i) => i !== index) })),
  setWordBuffer: (wordBuffer) => set({ wordBuffer }),
  setActive: (active) => set({ active }),
  finishSentence: (sentence) => set({ sentence, glosses: [], wordBuffer: '' }),
  takeSentence: () => {
    const text = glossesToText(get().glosses);
    if (text) get().finishSentence(text);
    return text;
  },
  clear: () => set({ running: false, glosses: [], wordBuffer: '', active: null, sentence: '' }),
}));
