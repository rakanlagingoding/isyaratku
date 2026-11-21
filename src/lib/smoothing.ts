// Landmark smoothing. Pure TypeScript, no React.
//
// Two stages:
// 1. One Euro filter (Casiez et al., CHI 2012) on every detection: removes jitter from
//    noisy/low-quality cameras while staying responsive when the hand moves fast.
//    Its output feeds the overlay AND later phases (features/segmenter).
// 2. Tween on every display frame: moves drawn points toward the latest filtered
//    detection, so motion looks fluid even when detection runs at ~10-15 FPS.
//    Display only; never fed to the classifier.

import type { HandFrame, Point3 } from '../types';

/**
 * Tuned by simulation for normalized coordinates (0..1), 10–30 FPS detection:
 * at 15 FPS jitter variance drops ~70% while lag stays ~0.02–0.03 units at
 * 0.75–2 units/s hand speed.
 */
export const ONE_EURO_DEFAULTS = { minCutoff: 0.5, beta: 5, dCutoff: 0.5 } as const;

/** Time constant (ms) of the display tween. Lower = snappier, higher = smoother. */
export const TWEEN_TAU_MS = 45;

const smoothingFactor = (cutoffHz: number, dtSec: number) => {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dtSec);
};

export class OneEuroFilter {
  private prevValue: number | null = null;
  private prevDeriv = 0;
  private prevTime = 0;

  constructor(
    private readonly minCutoff: number = ONE_EURO_DEFAULTS.minCutoff,
    private readonly beta: number = ONE_EURO_DEFAULTS.beta,
    private readonly dCutoff: number = ONE_EURO_DEFAULTS.dCutoff,
  ) {}

  /** Filter `value` sampled at `timeSec`. The first sample passes through unchanged. */
  filter(value: number, timeSec: number): number {
    if (this.prevValue === null) {
      this.prevValue = value;
      this.prevTime = timeSec;
      return value;
    }
    const dt = timeSec - this.prevTime;
    if (dt <= 0) return this.prevValue;

    const deriv = (value - this.prevValue) / dt;
    const aD = smoothingFactor(this.dCutoff, dt);
    const smoothDeriv = aD * deriv + (1 - aD) * this.prevDeriv;

    const cutoff = this.minCutoff + this.beta * Math.abs(smoothDeriv);
    const a = smoothingFactor(cutoff, dt);
    const result = a * value + (1 - a) * this.prevValue;

    this.prevValue = result;
    this.prevDeriv = smoothDeriv;
    this.prevTime = timeSec;
    return result;
  }

  reset(): void {
    this.prevValue = null;
    this.prevDeriv = 0;
  }
}

type Side = 'left' | 'right';

/** One Euro filter per coordinate of each hand (2 x 21 x 3 filters). */
export class HandSmoother {
  private readonly filters: Record<Side, OneEuroFilter[]>;

  constructor(params: { minCutoff: number; beta: number; dCutoff: number } = ONE_EURO_DEFAULTS) {
    const make = () =>
      Array.from(
        { length: 21 * 3 },
        () => new OneEuroFilter(params.minCutoff, params.beta, params.dCutoff),
      );
    this.filters = { left: make(), right: make() };
  }

  apply(frame: HandFrame): HandFrame {
    const t = frame.timestamp / 1000;
    const smoothSide = (side: Side): Point3[] | null => {
      const points = frame[side];
      const filters = this.filters[side];
      if (!points) {
        filters.forEach((f) => f.reset()); // hand left the view: start fresh next time
        return null;
      }
      return points.map((p, i) => ({
        x: filters[i * 3]!.filter(p.x, t),
        y: filters[i * 3 + 1]!.filter(p.y, t),
        z: filters[i * 3 + 2]!.filter(p.z, t),
      }));
    };
    return { timestamp: frame.timestamp, left: smoothSide('left'), right: smoothSide('right') };
  }

  reset(): void {
    this.filters.left.forEach((f) => f.reset());
    this.filters.right.forEach((f) => f.reset());
  }
}

/** Fraction of the remaining distance to cover after `dtMs` (exponential approach). */
export function tweenFactor(dtMs: number, tauMs: number = TWEEN_TAU_MS): number {
  if (dtMs <= 0) return 0;
  return 1 - Math.exp(-dtMs / tauMs);
}

/**
 * Move the displayed hands toward the target hands.
 * A hand that appears snaps into place; a hand that disappears is hidden at once.
 */
export function tweenHands(
  display: HandFrame | null,
  target: HandFrame,
  dtMs: number,
  tauMs: number = TWEEN_TAU_MS,
): HandFrame {
  const k = tweenFactor(dtMs, tauMs);
  const step = (side: Side): Point3[] | null => {
    const to = target[side];
    if (!to) return null;
    const from = display?.[side];
    if (!from || from.length !== to.length) return to.map((p) => ({ ...p }));
    return to.map((p, i) => {
      const q = from[i]!;
      return { x: q.x + (p.x - q.x) * k, y: q.y + (p.y - q.y) * k, z: q.z + (p.z - q.z) * k };
    });
  };
  return { timestamp: target.timestamp, left: step('left'), right: step('right') };
}
