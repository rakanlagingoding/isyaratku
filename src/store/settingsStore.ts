import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Phase 1 only needs the debug flag (FPS overlay). The rest of F11 comes in Phase 7.
type SettingsState = {
  debug: boolean;
  setDebug: (debug: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      debug: false,
      setDebug: (debug) => set({ debug }),
    }),
    { name: 'isyaratku-settings', version: 1 },
  ),
);
