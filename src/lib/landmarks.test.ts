import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  HAND_CONNECTIONS,
  HAND_MODEL_PATH,
  drawHands,
  handCount,
  toHandFrame,
  type LandmarkerOutput,
} from './landmarks';

const hand = (offset: number) =>
  Array.from({ length: 21 }, (_, i) => ({ x: offset + i / 100, y: i / 100, z: 0 }));
const label = (categoryName: string) => [{ categoryName, score: 0.9 }];

describe('toHandFrame', () => {
  it('assigns hands by handedness label', () => {
    const result: LandmarkerOutput = {
      landmarks: [hand(0.1), hand(0.5)],
      handedness: [label('Right'), label('Left')],
    };
    const frame = toHandFrame(result, 42);
    expect(frame.timestamp).toBe(42);
    expect(frame.right?.[0]?.x).toBeCloseTo(0.1);
    expect(frame.left?.[0]?.x).toBeCloseTo(0.5);
    expect(handCount(frame)).toBe(2);
  });

  it('returns nulls when no hand is detected', () => {
    const frame = toHandFrame({ landmarks: [], handedness: [] }, 0);
    expect(frame.left).toBeNull();
    expect(frame.right).toBeNull();
    expect(handCount(frame)).toBe(0);
  });

  it('swaps labels when asked', () => {
    const frame = toHandFrame({ landmarks: [hand(0)], handedness: [label('Left')] }, 0, {
      swapHandedness: true,
    });
    expect(frame.left).toBeNull();
    expect(frame.right).not.toBeNull();
  });

  it('keeps both hands when MediaPipe gives them the same label', () => {
    const frame = toHandFrame(
      { landmarks: [hand(0.1), hand(0.5)], handedness: [label('Left'), label('Left')] },
      0,
    );
    expect(frame.left?.[0]?.x).toBeCloseTo(0.1);
    expect(frame.right?.[0]?.x).toBeCloseTo(0.5);
  });

  it('ignores hands without 21 points and copies the points', () => {
    const source = hand(0);
    const frame = toHandFrame(
      { landmarks: [source.slice(0, 5), source], handedness: [label('Left'), label('Right')] },
      0,
    );
    expect(frame.left).toBeNull();
    expect(frame.right).not.toBe(source);
    expect(frame.right).toHaveLength(21);
  });
});

describe('HAND_CONNECTIONS', () => {
  it('has 21 bones over landmark indices 0..20', () => {
    expect(HAND_CONNECTIONS).toHaveLength(21);
    for (const [a, b] of HAND_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(20);
    }
  });
});

describe('self-hosted MediaPipe assets', () => {
  it('has the hand model committed in public/', () => {
    expect(existsSync(resolve('public', `.${HAND_MODEL_PATH}`))).toBe(true);
  });

  it('copy script names wasm files that exist in the installed package', () => {
    const script = readFileSync(resolve('scripts/copy-mediapipe.mjs'), 'utf-8');
    const names = [...script.matchAll(/'(vision_wasm_[\w.]+)'/g)].map((m) => m[1] ?? '');
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(existsSync(resolve('node_modules/@mediapipe/tasks-vision/wasm', name))).toBe(true);
    }
  });
});

describe('drawHands', () => {
  it('draws 21 points per detected hand', () => {
    const ctx = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    drawHands(ctx, { timestamp: 0, left: hand(0), right: null }, 640, 480);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(ctx.arc).toHaveBeenCalledTimes(21);
    expect(ctx.lineTo).toHaveBeenCalledTimes(HAND_CONNECTIONS.length);
  });
});
