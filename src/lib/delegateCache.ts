// Remembers the calibrated delegate per device, so repeat visits skip the GPU/CPU benchmark.
// The key includes the WebGL renderer and user agent: if the user updates drivers, enables
// browser graphics acceleration or changes browser, the key changes and we recalibrate.

import type { Delegate } from './delegate';

const STORAGE_KEY = 'isyaratku-delegate';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Entry = { key: string; delegate: Delegate };

export function delegateCacheKey(renderer: string, userAgent: string): string {
  return `${renderer}|${userAgent}`;
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // storage blocked (private mode, settings)
  }
}

export function loadCachedDelegate(
  key: string,
  storage: StorageLike | null = defaultStorage(),
): Delegate | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Partial<Entry>;
    if (entry.key !== key) return null;
    return entry.delegate === 'GPU' || entry.delegate === 'CPU' ? entry.delegate : null;
  } catch {
    return null;
  }
}

export function saveCachedDelegate(
  key: string,
  delegate: Delegate,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    const entry: Entry = { key, delegate };
    storage?.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // ignore: cache is an optimization only
  }
}
