import { describe, expect, it } from 'vitest';
import { FaceTracker, toEmotion, type FaceSignal } from './emotion';

const face = (b: Record<string, number>) => toEmotion(b);

describe('toEmotion', () => {
  it('is neutral for a resting face', () => {
    expect(face({ mouthSmileLeft: 0.1, browInnerUp: 0.1 }).emotion).toBe('netral');
    expect(face({}).emotion).toBe('netral');
  });

  it('detects a smile from the average of both mouth corners', () => {
    expect(face({ mouthSmileLeft: 0.6, mouthSmileRight: 0.5 }).emotion).toBe('senang');
    // One-sided smirk: average 0.35 < 0.5.
    expect(face({ mouthSmileLeft: 0.7, mouthSmileRight: 0 }).emotion).toBe('netral');
  });

  it('detects anger (brows down), sadness (frown) and a question (inner brows up)', () => {
    expect(face({ browDownLeft: 0.6, browDownRight: 0.6 }).emotion).toBe('marah');
    expect(face({ mouthFrownLeft: 0.4, mouthFrownRight: 0.4 }).emotion).toBe('sedih');
    expect(face({ browInnerUp: 0.5 }).emotion).toBe('bertanya');
  });

  it('checks the rules in order: a smile wins over raised brows', () => {
    const s = face({ mouthSmileLeft: 0.8, mouthSmileRight: 0.8, browInnerUp: 0.9 });
    expect(s.emotion).toBe('senang');
    expect(s.browInnerUp).toBe(0.9); // still available for isQuestion
  });
});

const neutral: FaceSignal = { emotion: 'netral', browInnerUp: 0 };
const happy: FaceSignal = { emotion: 'senang', browInnerUp: 0 };
const asking: FaceSignal = { emotion: 'bertanya', browInnerUp: 0.7 };

/** Push one signal every 100 ms starting at `t0`; returns the time after the last one. */
function feed(tracker: FaceTracker, signals: (FaceSignal | null)[], t0 = 0): number {
  signals.forEach((s, i) => tracker.push(s, t0 + i * 100));
  return t0 + (signals.length - 1) * 100;
}
const times = (s: FaceSignal | null, n: number) => Array.from({ length: n }, () => s);

describe('FaceTracker (sentence summary)', () => {
  it('is neutral without any face', () => {
    const tr = new FaceTracker();
    const t = feed(tr, times(null, 10));
    expect(tr.summary(t)).toEqual({ emotion: 'netral', isQuestion: false });
  });

  it('uses a non-neutral emotion seen in at least 30% of face frames', () => {
    const tr = new FaceTracker();
    const t = feed(tr, [...times(neutral, 7), ...times(happy, 3)]);
    expect(tr.summary(t).emotion).toBe('senang');
  });

  it('stays neutral when the other emotion is below 30%', () => {
    const tr = new FaceTracker();
    const t = feed(tr, [...times(neutral, 8), ...times(happy, 2)]);
    expect(tr.summary(t).emotion).toBe('netral');
  });

  it('is a question when brows are up in >= 30% of the last second', () => {
    const tr = new FaceTracker();
    // 2 s of neutral, then raised brows in 5 of the last 11 frames (t = 1600..2000 of 1000..2000).
    const t = feed(tr, [...times(neutral, 16), ...times(asking, 5)]);
    expect(tr.summary(t).isQuestion).toBe(true);
  });

  it('ignores raised brows older than the last second', () => {
    const tr = new FaceTracker();
    const t = feed(tr, [...times(asking, 10), ...times(neutral, 15)]);
    expect(tr.summary(t).isQuestion).toBe(false);
  });

  it('reset starts a new sentence', () => {
    const tr = new FaceTracker();
    const t = feed(tr, times(happy, 10));
    tr.reset();
    expect(tr.summary(t)).toEqual({ emotion: 'netral', isQuestion: false });
  });
});
