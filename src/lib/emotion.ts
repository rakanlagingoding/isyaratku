// Face blendshapes -> emotion (PRD F13). Fixed thresholds from emotion.json, no trained model
// (DECISIONS #24). Pure TypeScript; timing comes from the `t` passed in, so it is testable.

import config from '../data/emotion.json';
import type { Emotion } from '../types';

/** MediaPipe FaceLandmarker blendshape scores (0..1) by category name, e.g. `mouthSmileLeft`. */
export type Blendshapes = Readonly<Record<string, number>>;

/** One face frame: its emotion and the raw brow score that decides `isQuestion`. */
export type FaceSignal = { emotion: Emotion; browInnerUp: number };

/** Summary of the face over one sentence. */
export type SentenceFace = { emotion: Emotion; isQuestion: boolean };

type Rule = { avg: string[]; gte: number };
const RULES = config.rules as Record<Exclude<Emotion, 'netral'>, Rule>;
const ORDER = config.order as Emotion[];
const QUESTION_GTE = RULES.bertanya.gte;

const average = (b: Blendshapes, names: string[]) =>
  names.reduce((sum, n) => sum + (b[n] ?? 0), 0) / names.length;

/** First rule in `emotion.json` order whose average reaches its threshold wins. */
export function toEmotion(b: Blendshapes): FaceSignal {
  const browInnerUp = b.browInnerUp ?? 0;
  for (const emotion of ORDER) {
    if (emotion === 'netral') break;
    const rule = RULES[emotion];
    if (average(b, rule.avg) >= rule.gte) return { emotion, browInnerUp };
  }
  return { emotion: 'netral', browInnerUp };
}

/** Collects face frames of the open sentence; `summary` is read when the sentence ends. */
export class FaceTracker {
  private counts = new Map<Emotion, number>();
  private total = 0;
  /** Face frames of the last `questionWindowMs`, for isQuestion. */
  private recent: { t: number; up: boolean }[] = [];

  /** `null` = no face in this frame; it is not counted. */
  push(signal: FaceSignal | null, t: number): void {
    if (!signal) return;
    this.counts.set(signal.emotion, (this.counts.get(signal.emotion) ?? 0) + 1);
    this.total++;
    this.recent.push({ t, up: signal.browInnerUp >= QUESTION_GTE });
    this.prune(t);
  }

  summary(t: number): SentenceFace {
    const { minShareNonNeutral, questionMinShare } = config.sentence;
    let emotion: Emotion = 'netral';
    let best = 0;
    for (const e of ORDER) {
      const n = this.counts.get(e) ?? 0;
      if (e !== 'netral' && n > best && n / this.total >= minShareNonNeutral) {
        emotion = e;
        best = n;
      }
    }
    this.prune(t);
    const up = this.recent.filter((r) => r.up).length;
    const isQuestion = this.recent.length > 0 && up / this.recent.length >= questionMinShare;
    return { emotion, isQuestion };
  }

  reset(): void {
    this.counts.clear();
    this.total = 0;
    this.recent = [];
  }

  private prune(t: number): void {
    const from = t - config.sentence.questionWindowMs;
    while (this.recent.length > 0 && (this.recent[0]?.t ?? t) < from) this.recent.shift();
  }
}
