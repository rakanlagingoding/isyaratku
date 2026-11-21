import { describe, expect, it } from 'vitest';
import { GPU_GOOD_ENOUGH_MS, chooseDelegate, median, shouldTryCpu } from './delegate';

describe('median', () => {
  it('handles odd, even and empty input', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNaN();
  });

  it('ignores a single outlier (e.g. shader warm-up)', () => {
    expect(median([20, 21, 900, 19, 22])).toBe(21);
  });
});

describe('shouldTryCpu', () => {
  it('skips CPU when GPU is fast enough', () => {
    expect(shouldTryCpu(GPU_GOOD_ENOUGH_MS)).toBe(false);
    expect(shouldTryCpu(12)).toBe(false);
  });

  it('tries CPU when GPU is slow or failed', () => {
    expect(shouldTryCpu(226)).toBe(true);
    expect(shouldTryCpu(null)).toBe(true);
    expect(shouldTryCpu(Number.NaN)).toBe(true);
  });
});

describe('chooseDelegate', () => {
  it('picks CPU when it is faster than a slow GPU (laptop case: GPU 226 ms)', () => {
    expect(chooseDelegate(226, 35)).toBe('CPU');
  });

  it('keeps GPU when it is faster or tied', () => {
    expect(chooseDelegate(15, 40)).toBe('GPU');
    expect(chooseDelegate(30, 30)).toBe('GPU');
  });

  it('falls back to whichever delegate loaded', () => {
    expect(chooseDelegate(null, 50)).toBe('CPU');
    expect(chooseDelegate(80, null)).toBe('GPU');
  });

  it('throws when nothing loaded', () => {
    expect(() => chooseDelegate(null, null)).toThrow();
  });
});
