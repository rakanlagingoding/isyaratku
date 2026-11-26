// Hand landmark helpers: MediaPipe asset URLs, conversion to HandFrame, overlay drawing.
// Pure TypeScript, no React. Detection itself runs in src/workers/handDetector.worker.ts.

import type { HandFrame, Point3 } from '../types';

// Self-hosted on our own origin (DECISIONS #15):
// - wasm is copied from node_modules by scripts/copy-mediapipe.mjs (predev/prebuild),
//   so it always matches the installed @mediapipe/tasks-vision version;
// - the model is committed in public/models/ (float16 hand_landmarker from Google, Apache-2.0).
export const MEDIAPIPE_WASM_PATH = '/mediapipe/wasm';
export const HAND_MODEL_PATH = '/models/hand_landmarker.task';

export const LANDMARKS_PER_HAND = 21;

/** Bone connections between the 21 hand landmarks (same topology as MediaPipe). */
// prettier-ignore
export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // pinky + palm
];

/** Minimal shape of a HandLandmarkerResult, so conversion can be tested without MediaPipe. */
export type LandmarkerOutput = {
  landmarks: ReadonlyArray<ReadonlyArray<Point3>>;
  handedness: ReadonlyArray<ReadonlyArray<{ categoryName: string; score: number }>>;
};

export type ToHandFrameOptions = {
  /**
   * MediaPipe reports the subject's real hand when the input is NOT mirrored.
   * We feed the raw (unmirrored) camera frame, so the default is no swap.
   * Flip this only if on-device testing proves the labels are inverted.
   */
  swapHandedness?: boolean;
};

/** Convert a detector result into a HandFrame with the subject's left/right hands. */
export function toHandFrame(
  result: LandmarkerOutput,
  timestamp: number,
  { swapHandedness = false }: ToHandFrameOptions = {},
): HandFrame {
  const frame: HandFrame = { timestamp, left: null, right: null };
  const unassigned: Point3[][] = [];

  result.landmarks.forEach((points, i) => {
    if (points.length !== LANDMARKS_PER_HAND) return;
    const copy = points.map(({ x, y, z }) => ({ x, y, z }));
    let side = result.handedness[i]?.[0]?.categoryName;
    if (swapHandedness) side = side === 'Left' ? 'Right' : side === 'Right' ? 'Left' : side;

    if (side === 'Left' && !frame.left) frame.left = copy;
    else if (side === 'Right' && !frame.right) frame.right = copy;
    else unassigned.push(copy); // unknown label or both hands got the same label
  });

  for (const hand of unassigned) {
    if (!frame.left) frame.left = hand;
    else if (!frame.right) frame.right = hand;
  }
  return frame;
}

export function handCount(frame: HandFrame): number {
  return (frame.left ? 1 : 0) + (frame.right ? 1 : 0);
}

const HAND_COLOR = '#ffffff';
const GLOW_COLOR = 'rgba(255, 255, 255, 0.85)';

/**
 * Draw both hands onto a canvas whose size matches the video frame.
 * Coordinates are normalized (0..1) in the unmirrored frame; the canvas is
 * mirrored with CSS together with the video, so they line up on screen.
 */
export function drawHands(
  ctx: CanvasRenderingContext2D,
  frame: HandFrame,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  const radius = Math.max(3, width / 160);
  // White glow. All dots share one path: shadowBlur is costly on phones, so blur 2 shapes, not 22.
  ctx.strokeStyle = HAND_COLOR;
  ctx.fillStyle = HAND_COLOR;
  ctx.shadowColor = GLOW_COLOR;
  ctx.shadowBlur = Math.max(6, width / 60);
  ctx.lineWidth = Math.max(2, width / 240);

  for (const side of ['left', 'right'] as const) {
    const points = frame[side];
    if (!points) continue;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const p = points[a];
      const q = points[b];
      if (!p || !q) continue;
      ctx.moveTo(p.x * width, p.y * height);
      ctx.lineTo(q.x * width, q.y * height);
    }
    ctx.stroke();

    ctx.beginPath();
    for (const p of points) {
      ctx.moveTo(p.x * width + radius, p.y * height); // start each circle on its edge: no joining line
      ctx.arc(p.x * width, p.y * height, radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
