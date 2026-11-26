import { describe, expect, it } from 'vitest';
import type { FeatureVector, Prediction } from '../types';
import { FEATURE_LENGTH } from './features';
import { fingerspellToWord, Segmenter, WordSegmenter } from './segmenter';

/** A frame marker: a letter with a confidence, or null for "no hand in view". */
type Step = [label: string, confidence: number] | null;

/**
 * Drive a Segmenter with one step every `dt` ms. Hand frames carry their step index in feature 63,
 * so the fake predictor can look up which letter the "model" sees.
 */
function run(steps: Step[], dt = 100, seg?: Segmenter, startT = 0) {
  const script = new Map<number, Prediction>();
  const predict = (f: FeatureVector): Prediction => {
    const p = script.get(f[63] ?? -1);
    if (!p) throw new Error('predict called for a frame without a hand');
    return p;
  };
  const s = seg ?? new Segmenter(predict);
  const accepted: string[] = [];
  const words: string[] = [];
  const glosses: string[] = [];
  const sentences: string[][] = [];
  s.on('letter', (e) => {
    if (e.holdProgress >= 1) accepted.push(e.label);
  });
  s.on('word', (e) => words.push(e.letters));
  s.on('gloss', (g) => glosses.push(g));
  s.on('sentenceEnd', (g) => sentences.push(g));
  steps.forEach((step, i) => {
    const f = new Float32Array(FEATURE_LENGTH);
    if (step) {
      const id = startT + i + 1;
      f[63] = id;
      script.set(id, { label: step[0], confidence: step[1] });
    }
    s.push(f, startT + i * dt);
  });
  return { s, accepted, words, glosses, sentences };
}

const hold = (label: string, ms: number, conf = 0.9): Step[] =>
  Array.from({ length: ms / 100 + 1 }, () => [label, conf] as Step);
const gap = (ms: number): Step[] => Array.from({ length: ms / 100 }, () => null);

describe('Segmenter (fingerspelling)', () => {
  it('accepts a letter held steadily for 500 ms', () => {
    const r = run(hold('R', 600));
    expect(r.words).toEqual(['R']);
  });

  it('ignores a letter below the confidence threshold', () => {
    const r = run(hold('R', 1000, 0.7));
    expect(r.words).toEqual([]);
  });

  it('restarts the hold on a noisy frame without adding a letter', () => {
    const steps: Step[] = [...hold('R', 200), ['B', 0.9], ...hold('R', 600)];
    const r = run(steps);
    expect(r.words).toEqual(['R']);
  });

  it('does not double an accepted letter after one noisy frame', () => {
    const r = run([...hold('R', 600), ['B', 0.9], ...hold('R', 600)]);
    expect(r.words).toEqual(['R']);
  });

  it('does not double an accepted letter after a one-frame hand dropout', () => {
    const r = run([...hold('R', 600), null, ...hold('R', 600)]);
    expect(r.words).toEqual(['R']);
  });

  it('a low-confidence frame of another letter does not release the accepted letter', () => {
    const r = run([...hold('R', 600), ['B', 0.4], ['B', 0.4], ['B', 0.4], ...hold('R', 600)]);
    expect(r.words).toEqual(['R']);
  });

  it('closes the word after a 1000 ms pause', () => {
    const r = run([...hold('R', 600), ...hold('A', 600), ...gap(1100)]);
    expect(r.glosses).toEqual(['FS:RA']);
  });

  it('accepts the same letter twice only after a release', () => {
    expect(run(hold('N', 1500)).words).toEqual(['N']);
    const r = run([...hold('N', 600), ...gap(200), ...hold('N', 600)]);
    expect(r.words.at(-1)).toBe('NN');
  });

  it('ends the sentence once after 2500 ms without hands following a gloss', () => {
    const r = run([...hold('R', 600), ...hold('A', 600), ...gap(3000)]);
    expect(r.sentences).toEqual([['FS:RA']]);
  });

  it('does not end a sentence when no gloss was made', () => {
    expect(run(gap(5000)).sentences).toEqual([]);
  });

  it('caps a word at 20 letters', () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
    const steps = letters.flatMap((l) => hold(l, 600));
    const r = run([...steps, ...gap(1100)]);
    expect(r.glosses).toEqual(['FS:ABCDEFGHIJKLMNOPQRST']);
  });

  it('forgets everything on reset, so time spent paused fires nothing', () => {
    const r = run(hold('R', 600));
    r.s.reset();
    const after = run(gap(3000), 100, r.s, 10_000);
    expect(after.glosses).toEqual([]);
    expect(after.sentences).toEqual([]);
  });
});

describe('Segmenter.resume (after a pause)', () => {
  it('speaks chips made before the pause once the hands rest again', () => {
    const r = run([...hold('R', 600), ...hold('A', 600), ...gap(1100)]);
    r.s.reset();
    r.s.resume(['FS:RA'], 10_000);
    const after = run(gap(3000), 100, r.s, 10_000);
    expect(after.sentences).toEqual([['FS:RA']]);
  });

  it('does not end the sentence before the full gap has passed since resuming', () => {
    const r = run(gap(100));
    r.s.resume(['FS:RA'], 10_000);
    const after = run(gap(2000), 100, r.s, 10_000);
    expect(after.sentences).toEqual([]);
  });
});

describe('fingerspellToWord', () => {
  it('writes fingerspelled glosses as capitalized words', () => {
    expect(fingerspellToWord('FS:RAKAN')).toBe('Rakan');
    expect(fingerspellToWord('TERIMA-KASIH')).toBe('terima kasih');
  });
});

/** Drive a WordSegmenter one frame every `dt` ms; the fake model "sees" the step's prediction. */
// Module-level so a segmenter reused across runWords calls (resume, reset) sees the new script.
let current: Prediction | null = null;
let windows: number[] = [];
const predictWindow = (w: ReadonlyArray<FeatureVector>): Prediction => {
  if (!current) throw new Error('predict called for a frame without a hand');
  windows.push(w.length);
  return current;
};

function runWords(steps: Step[], dt = 50, seg?: WordSegmenter, startT = 0) {
  windows = [];
  const s = seg ?? new WordSegmenter(predictWindow);
  const glosses: string[] = [];
  const sentences: string[][] = [];
  const signs: string[] = [];
  s.on('sign', (e) => signs.push(e.label));
  s.on('gloss', (g) => glosses.push(g));
  s.on('sentenceEnd', (g) => sentences.push(g));
  steps.forEach((step, i) => {
    const f = new Float32Array(FEATURE_LENGTH);
    if (step) f[0] = 1;
    current = step ? { label: step[0], confidence: step[1] } : null;
    s.push(f, startT + i * dt);
  });
  return { s, glosses, sentences, signs, windows: [...windows] };
}

const frames = (label: string, n: number, conf = 0.9): Step[] =>
  Array.from({ length: n }, () => [label, conf] as Step);
const noHand = (n: number): Step[] => Array.from({ length: n }, () => null);

describe('WordSegmenter (signs)', () => {
  it('predicts only once 30 frames are buffered, then every 2 frames', () => {
    expect(runWords(frames('_IDLE', 29)).windows).toEqual([]);
    expect(runWords(frames('_IDLE', 30)).windows).toEqual([30]);
    expect(runWords(frames('_IDLE', 33)).windows).toEqual([30, 30]);
  });

  it('accepts a sign after 3 consecutive confident predictions, once', () => {
    // Predictions at frames 30, 32, 34 -> accepted on the third; holding it longer adds nothing.
    expect(runWords(frames('MAKAN', 33)).glosses).toEqual([]);
    expect(runWords(frames('MAKAN', 34)).glosses).toEqual(['MAKAN']);
    expect(runWords(frames('MAKAN', 60)).glosses).toEqual(['MAKAN']);
  });

  it('ignores predictions below the confidence threshold', () => {
    expect(runWords(frames('MAKAN', 60, 0.7)).glosses).toEqual([]);
  });

  it('needs the 3 predictions to be consecutive', () => {
    const steps = [...frames('MAKAN', 32), ...frames('MINUM', 2), ...frames('MAKAN', 3)];
    expect(runWords(steps).glosses).toEqual([]);
  });

  it('accepts a different sign right after the previous one', () => {
    const steps = [...frames('SAYA', 34), ...frames('MAKAN', 6)];
    expect(runWords(steps).glosses).toEqual(['SAYA', 'MAKAN']);
  });

  it('repeats the same sign only after an _IDLE pause', () => {
    const noPause = [...frames('MAKAN', 34), ...frames('MINUM', 2), ...frames('MAKAN', 6)];
    expect(runWords(noPause).glosses).toEqual(['MAKAN']);
    const withIdle = [...frames('MAKAN', 34), ...frames('_IDLE', 2), ...frames('MAKAN', 6)];
    expect(runWords(withIdle).glosses).toEqual(['MAKAN', 'MAKAN']);
  });

  it('never accepts _IDLE as a gloss', () => {
    expect(runWords(frames('_IDLE', 60)).glosses).toEqual([]);
  });

  it('reports every prediction for the UI', () => {
    expect(runWords(frames('MAKAN', 32)).signs).toEqual(['MAKAN', 'MAKAN']);
  });

  it('ends the sentence after 1000 ms without a hand', () => {
    // 50 ms per frame: 20 no-hand frames reach 1000 ms after the last hand frame only at the 20th.
    const r = runWords([...frames('SAYA', 34), ...frames('MAKAN', 6), ...noHand(20)]);
    expect(r.sentences).toEqual([['SAYA', 'MAKAN']]);
    expect(runWords([...frames('SAYA', 34), ...noHand(19)]).sentences).toEqual([]);
  });

  it('ends the sentence after 1000 ms of _IDLE', () => {
    const r = runWords([...frames('SAYA', 34), ...frames('_IDLE', 24)]);
    expect(r.sentences).toEqual([['SAYA']]);
  });

  it('does not end an empty sentence', () => {
    expect(runWords([...frames('_IDLE', 40), ...noHand(40)]).sentences).toEqual([]);
  });

  it('allows the same sign again in the next sentence', () => {
    const r = runWords([...frames('SAYA', 34), ...noHand(20), ...frames('SAYA', 34)]);
    expect(r.glosses).toEqual(['SAYA', 'SAYA']);
  });

  it('resume keeps pending glosses in the open sentence', () => {
    const first = runWords(frames('SAYA', 34));
    first.s.resume(['SAYA'], 10_000);
    const r = runWords([...frames('MAKAN', 34), ...noHand(20)], 50, first.s, 10_000);
    expect(r.sentences).toEqual([['SAYA', 'MAKAN']]);
  });

  it('reset drops the buffered frames and the open sentence', () => {
    const r = runWords(frames('SAYA', 34));
    r.s.reset();
    const after = runWords([...frames('MAKAN', 29), ...noHand(30)], 50, r.s, 10_000);
    expect(after.windows).toEqual([]);
    expect(after.sentences).toEqual([]);
  });
});
