import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TranslatorMode } from '../types';

// F11 settings, persisted in localStorage. New fields get their default from the initial state
// (persist merges), so adding one needs no version bump.
type SettingsState = {
  debug: boolean;
  setDebug: (debug: boolean) => void;
  /** 'rule' = Mode A (offline), 'llm' = Mode B (Gemini via /api/translate, falls back to Mode A). */
  translator: TranslatorMode;
  setTranslator: (translator: TranslatorMode) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      debug: false,
      setDebug: (debug) => set({ debug }),
      translator: 'rule',
      setTranslator: (translator) => set({ translator }),
    }),
    { name: 'isyaratku-settings', version: 1 },
  ),
);
