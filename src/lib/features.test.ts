import { describe, expect, it } from 'vitest';
import type { HandFrame, Point3 } from '../types';
import { FEATURE_LENGTH, FEATURES_PER_HAND, hasHand, normalizeHand, toFeatures } from './features';

/** Deterministic, non-degenerate fake hand around (cx, cy). */
function makeHand(cx: number, cy: number, seed = 1): Point3[] {
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: 21 }, (_, i) => ({
    x: cx + (i === 0 ? 0 : (rand() - 0.5) * 0.2),
    y: cy + (i === 0 ? 0 : -0.05 - rand() * 0.15),
    z: (rand() - 0.5) * 0.05,
  }));
}

const transform = (hand: Point3[], dx: number, dy: number, k: number): Point3[] =>
  hand.map((p) => ({ x: p.x * k + dx, y: p.y * k + dy, z: p.z * k }));

const frame = (left: Point3[] | null, right: Point3[] | null): HandFrame => ({
  timestamp: 0,
  left,
  right,
});

const expectClose = (a: Float32Array, b: Float32Array) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i] ?? NaN, 4));
};

describe('normalizeHand', () => {
  it('puts the wrist at the origin and the middle knuckle at distance 1', () => {
    const f = normalizeHand(makeHand(0.4, 0.6));
    expect(Array.from(f.slice(0, 3))).toEqual([0, 0, 0]);
    expect(Math.hypot(f[27] ?? NaN, f[28] ?? NaN, f[29] ?? NaN)).toBeCloseTo(1, 5);
  });

  it('is unchanged when the hand is moved', () => {
    const hand = makeHand(0.3, 0.5);
    expectClose(normalizeHand(transform(hand, 0.25, -0.1, 1)), normalizeHand(hand));
  });

  it('is unchanged when the hand is scaled (closer/farther from the camera)', () => {
    const hand = makeHand(0.5, 0.5);
    expectClose(normalizeHand(transform(hand, 0, 0, 0.5)), normalizeHand(hand));
    expectClose(normalizeHand(transform(hand, 0.1, 0.05, 1.8)), normalizeHand(hand));
  });

  it('gives the same features for the same pose seen in different aspect ratios', () => {
    // Same physical hand, in height units. A frame of aspect a stores x as x_h / a.
    const physical = makeHand(0.5, 0.5, 7);
    const inFrame = (a: number) => physical.map((p) => ({ x: p.x / a, y: p.y, z: p.z / a }));
    expectClose(normalizeHand(inFrame(4 / 3), 4 / 3), normalizeHand(inFrame(3 / 4), 3 / 4));
  });

  it('returns zeros for a degenerate hand instead of NaN', () => {
    const flat = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    const f = normalizeHand(flat);
    expect(f.every((v) => v === 0)).toBe(true);
  });

  it('rejects a hand with the wrong number of points', () => {
    expect(() => normalizeHand(makeHand(0.5, 0.5).slice(0, 20))).toThrow();
  });
});

describe('toFeatures', () => {
  it('returns 126 numbers: left hand first, then right', () => {
    const left = makeHand(0.3, 0.5, 2);
    const right = makeHand(0.7, 0.5, 3);
    const f = toFeatures(frame(left, right));
    expect(f).toHaveLength(FEATURE_LENGTH);
    expectClose(f.slice(0, FEATURES_PER_HAND), normalizeHand(left));
    expectClose(f.slice(FEATURES_PER_HAND), normalizeHand(right));
  });

  it('fills a missing hand with zeros', () => {
    const right = makeHand(0.6, 0.4);
    const f = toFeatures(frame(null, right));
    expect(f.slice(0, FEATURES_PER_HAND).every((v) => v === 0)).toBe(true);
    expectClose(f.slice(FEATURES_PER_HAND), normalizeHand(right));
  });

  it('is all zeros with no hands', () => {
    const f = toFeatures(frame(null, null));
    expect(hasHand(f)).toBe(false);
  });

  it('is invariant to moving and scaling both hands together', () => {
    const left = makeHand(0.3, 0.5, 4);
    const right = makeHand(0.7, 0.5, 5);
    const moved = toFeatures(
      frame(transform(left, 0.1, 0.1, 0.7), transform(right, 0.1, 0.1, 0.7)),
    );
    expectClose(moved, toFeatures(frame(left, right)));
    expect(hasHand(moved)).toBe(true);
  });
});
