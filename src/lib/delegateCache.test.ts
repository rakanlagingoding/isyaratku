import { describe, expect, it } from 'vitest';
import { delegateCacheKey, loadCachedDelegate, saveCachedDelegate } from './delegateCache';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};

describe('delegate cache', () => {
  const key = delegateCacheKey('ANGLE (AMD Radeon)', 'Chrome/150');

  it('returns the saved delegate for the same device', () => {
    const storage = memoryStorage();
    saveCachedDelegate(key, 'CPU', storage);
    expect(loadCachedDelegate(key, storage)).toBe('CPU');
  });

  it('misses when the renderer or browser changed (e.g. GPU acceleration enabled)', () => {
    const storage = memoryStorage();
    saveCachedDelegate(
      delegateCacheKey('Microsoft Basic Render Driver', 'Edg/150'),
      'CPU',
      storage,
    );
    expect(
      loadCachedDelegate(delegateCacheKey('ANGLE (AMD Radeon)', 'Edg/150'), storage),
    ).toBeNull();
  });

  it('survives missing, corrupt or blocked storage', () => {
    expect(loadCachedDelegate(key, null)).toBeNull();
    const corrupt = memoryStorage();
    corrupt.setItem('isyaratku-delegate', '{not json');
    expect(loadCachedDelegate(key, corrupt)).toBeNull();
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadCachedDelegate(key, throwing)).toBeNull();
    expect(() => saveCachedDelegate(key, 'GPU', throwing)).not.toThrow();
  });

  it('rejects unknown delegate values', () => {
    const storage = memoryStorage();
    storage.setItem('isyaratku-delegate', JSON.stringify({ key, delegate: 'NPU' }));
    expect(loadCachedDelegate(key, storage)).toBeNull();
  });
});
