import { describe, expect, it } from 'vitest';
import type { FeatureVector, Prediction } from '../types';
import { FEATURE_LENGTH } from './features';
import { fingerspellToWord, glossesToText, Segmenter } from './segmenter';

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

describe('fingerspellToWord / glossesToText', () => {
  it('writes fingerspelled glosses as capitalized words', () => {
    expect(fingerspellToWord('FS:RAKAN')).toBe('Rakan');
    expect(fingerspellToWord('TERIMA-KASIH')).toBe('terima kasih');
  });

  it('builds a spoken sentence', () => {
    expect(glossesToText(['FS:RAKAN', 'FS:ADI'])).toBe('Rakan Adi.');
    expect(glossesToText([])).toBe('');
  });
});
