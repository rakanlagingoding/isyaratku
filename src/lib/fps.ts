/** Frames-per-second meter over a sliding time window. */
export class FpsMeter {
  private readonly windowMs: number;
  private stamps: number[] = [];

  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
  }

  /** Record a frame at time `now` (ms) and return the current FPS. */
  tick(now: number): number {
    this.stamps.push(now);
    const cutoff = now - this.windowMs;
    while (this.stamps.length > 0 && (this.stamps[0] ?? 0) <= cutoff) this.stamps.shift();
    return (this.stamps.length * 1000) / this.windowMs;
  }

  reset(): void {
    this.stamps = [];
  }
}
