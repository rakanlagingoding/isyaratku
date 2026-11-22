// Feature extraction (PRD F2). Pure TypeScript, no React.
// One frame -> 126 numbers: left hand (21 x 3) then right hand (21 x 3); a missing hand is all zeros.
// Letters and words use the same layout (DECISIONS #16). The training notebooks must match this file.

import type { FeatureVector, HandFrame, Point3 } from '../types';
import { LANDMARKS_PER_HAND } from './landmarks';

export const FEATURES_PER_HAND = LANDMARKS_PER_HAND * 3; // 63
export const FEATURE_LENGTH = FEATURES_PER_HAND * 2; // 126

const WRIST = 0;
const MIDDLE_MCP = 9;
/** Below this palm size (wrist -> middle knuckle) the hand is degenerate and treated as missing. */
const MIN_PALM_SIZE = 1e-6;

/**
 * Normalize one hand into 63 numbers.
 *
 * MediaPipe x is a fraction of the image width, y of the height, and z uses roughly the
 * same scale as x. `aspect` = width / height converts x and z to height units, so all three
 * axes share one unit and the same pose gives the same features in portrait and landscape
 * (DECISIONS #19). Then: subtract the wrist, divide by the wrist -> middle-knuckle distance.
 */
export function normalizeHand(
  points: ReadonlyArray<Point3>,
  aspect = 1,
  out: Float32Array = new Float32Array(FEATURES_PER_HAND),
  offset = 0,
): Float32Array {
  if (points.length !== LANDMARKS_PER_HAND) {
    throw new Error(`Expected ${LANDMARKS_PER_HAND} landmarks, got ${points.length}`);
  }
  const wrist = points[WRIST];
  const ref = points[MIDDLE_MCP];
  if (!wrist || !ref) throw new Error('Hand is missing the wrist or middle knuckle');
  const size = Math.hypot((ref.x - wrist.x) * aspect, ref.y - wrist.y, (ref.z - wrist.z) * aspect);
  if (!(size > MIN_PALM_SIZE)) return out; // leave zeros: same as "hand not detected"

  points.forEach((p, i) => {
    out[offset + i * 3] = ((p.x - wrist.x) * aspect) / size;
    out[offset + i * 3 + 1] = (p.y - wrist.y) / size;
    out[offset + i * 3 + 2] = ((p.z - wrist.z) * aspect) / size;
  });
  return out;
}

/** 126 features for one frame: left hand first, then right; missing hands are zeros. */
export function toFeatures(frame: HandFrame, aspect = 1): FeatureVector {
  const out = new Float32Array(FEATURE_LENGTH);
  if (frame.left) normalizeHand(frame.left, aspect, out, 0);
  if (frame.right) normalizeHand(frame.right, aspect, out, FEATURES_PER_HAND);
  return out;
}

/** True when the feature vector contains at least one (non-degenerate) hand. */
export function hasHand(features: FeatureVector): boolean {
  return features.some((v) => v !== 0);
}
