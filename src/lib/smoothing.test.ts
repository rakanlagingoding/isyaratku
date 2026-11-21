import { describe, expect, it } from 'vitest';
import { HandSmoother, OneEuroFilter, tweenFactor, tweenHands } from './smoothing';
import type { HandFrame } from '../types';

// Deterministic pseudo-random noise so tests are stable.
const noise = (i: number) => Math.sin(i * 12.9898) * 0.01;

const variance = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
};

describe('OneEuroFilter', () => {
  it('passes the first sample and a constant signal unchanged', () => {
    const f = new OneEuroFilter();
    expect(f.filter(0.5, 0)).toBe(0.5);
    for (let i = 1; i < 20; i++) expect(f.filter(0.5, i / 15)).toBeCloseTo(0.5);
  });

  it('reduces jitter on a still hand (low-quality camera noise)', () => {
    const f = new OneEuroFilter();
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 60; i++) {
      const v = 0.5 + noise(i);
      raw.push(v);
      out.push(f.filter(v, i / 15)); // 15 FPS
    }
    expect(variance(out.slice(10))).toBeLessThan(variance(raw.slice(10)) * 0.5);
  });

  it('keeps up with fast motion (small lag)', () => {
    const f = new OneEuroFilter();
    let out = 0;
    for (let i = 0; i <= 15; i++) out = f.filter(i * 0.05, i / 15); // 0.75 units/s
    expect(Math.abs(out - 0.75)).toBeLessThan(0.05);
  });

  it('ignores non-increasing timestamps and can reset', () => {
    const f = new OneEuroFilter();
    f.filter(0.2, 1);
    expect(f.filter(0.9, 1)).toBe(0.2);
    f.reset();
    expect(f.filter(0.9, 2)).toBe(0.9);
  });
});

const hand = (x: number) => Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 }));
const frame = (t: number, left: number | null, right: number | null = null): HandFrame => ({
  timestamp: t,
  left: left === null ? null : hand(left),
  right: right === null ? null : hand(right),
});

describe('HandSmoother', () => {
  it('keeps nulls and restarts a hand after it disappears', () => {
    const s = new HandSmoother();
    s.apply(frame(0, 0.2));
    s.apply(frame(66, 0.2));
    expect(s.apply(frame(133, null)).left).toBeNull();
    // Reappearing far away must snap there, not slide from the old position.
    expect(s.apply(frame(200, 0.8)).left?.[0]?.x).toBe(0.8);
  });

  it('smooths each hand independently', () => {
    const s = new HandSmoother();
    s.apply(frame(0, 0.2, 0.6));
    const out = s.apply(frame(66, 0.21, 0.6));
    expect(out.right?.[0]?.x).toBeCloseTo(0.6);
    expect(out.left?.[0]?.x).toBeGreaterThan(0.2);
    expect(out.left?.[0]?.x).toBeLessThanOrEqual(0.21);
  });
});

describe('tweenFactor', () => {
  it('is 0 for no time and approaches 1 over time', () => {
    expect(tweenFactor(0)).toBe(0);
    expect(tweenFactor(16, 45)).toBeGreaterThan(0.2);
    expect(tweenFactor(16, 45)).toBeLessThan(0.4);
    expect(tweenFactor(500, 45)).toBeGreaterThan(0.99);
  });
});

describe('tweenHands', () => {
  it('snaps a newly visible hand and hides a vanished one', () => {
    const shown = tweenHands(null, frame(0, 0.3), 16);
    expect(shown.left?.[0]?.x).toBe(0.3);
    expect(tweenHands(shown, frame(16, null), 16).left).toBeNull();
  });

  it('moves part of the way per display frame and converges', () => {
    let display: HandFrame = frame(0, 0.2);
    const target = frame(90, 0.6);
    display = tweenHands(display, target, 16);
    const x1 = display.left?.[0]?.x ?? 0;
    expect(x1).toBeGreaterThan(0.2);
    expect(x1).toBeLessThan(0.6);
    for (let i = 0; i < 30; i++) display = tweenHands(display, target, 16);
    expect(display.left?.[0]?.x).toBeCloseTo(0.6, 3);
  });
});
