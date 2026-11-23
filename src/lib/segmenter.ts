// Realtime segmentation (PRD F4). Phase 3: fingerspelling mode only — stable letters become words,
// words become `FS:<LETTERS>` glosses (DECISIONS #5). Word mode (30-frame windows) comes in Phase 5.
// Pure TypeScript, no React. All timing comes from the `t` passed to push(), so it is testable.

import type { FeatureVector, Prediction } from '../types';
import { hasHand } from './features';
import vocab from '../data/vocab.json';

export type LetterPredictor = (f: FeatureVector) => Prediction;

export type SegmenterOptions = {
  /** Minimum confidence for a letter frame to count (PRD F4 default 0.8). */
  threshold?: number;
  /** A letter must stay the same this long before it is accepted. */
  letterHoldMs?: number;
  /** A pause this long closes the current word. */
  wordGapMs?: number;
  /** This long without hands after a gloss ends the sentence (longer than wordGapMs, DECISIONS #30). */
  sentenceGapMs?: number;
  /** Longest fingerspelled word (`^FS:[A-Z]{1,20}$`). */
  maxLetters?: number;
  /**
   * How long a "release" must last before the same letter can be accepted again: no hand for this
   * long, or another confident letter held this long. Single noisy frames never release.
   */
  releaseMs?: number;
};

export type SegmenterEvents = {
  /** Every frame with a hand: the letter the model sees and how far its hold is (1 = accepted now). */
  letter: { label: string; confidence: number; holdProgress: number };
  /** The word being spelled changed. */
  word: { letters: string };
  /** A word was closed into a gloss, e.g. `FS:RAKAN`. */
  gloss: string;
  /** The sentence ended; payload = glosses made since the last sentence. */
  sentenceEnd: string[];
};

type Listener<K extends keyof SegmenterEvents> = (payload: SegmenterEvents[K]) => void;

const DEFAULTS: Required<SegmenterOptions> = {
  threshold: 0.8,
  letterHoldMs: 500,
  wordGapMs: 1000,
  sentenceGapMs: 2500,
  maxLetters: 20,
  releaseMs: 200,
};

const FS = vocab.fingerspellPrefix;

export class Segmenter {
  private readonly predict: LetterPredictor;
  private readonly opts: Required<SegmenterOptions>;
  private readonly listeners: { [K in keyof SegmenterEvents]: Set<Listener<K>> } = {
    letter: new Set(),
    word: new Set(),
    gloss: new Set(),
    sentenceEnd: new Set(),
  };

  private holdLabel: string | null = null;
  private holdStart = 0;
  /** Last accepted letter; the same letter needs a release (no hand / other letter) to repeat. */
  private blocked: string | null = null;
  private letters = '';
  private lastSignalT = -Infinity; // last frame with a confident letter
  private lastHandT = -Infinity; // last frame with any hand
  private sentence: string[] = [];

  constructor(predict: LetterPredictor, opts: SegmenterOptions = {}) {
    this.predict = predict;
    this.opts = { ...DEFAULTS, ...opts };
  }

  on<K extends keyof SegmenterEvents>(event: K, cb: Listener<K>): () => void {
    this.listeners[event].add(cb);
    return () => this.listeners[event].delete(cb);
  }

  reset(): void {
    this.holdLabel = null;
    this.blocked = null;
    this.letters = '';
    this.lastSignalT = -Infinity;
    this.lastHandT = -Infinity;
    this.sentence = [];
  }

  /**
   * Continue after a pause: glosses already on screen (chips) belong to the open sentence, and the
   * sentence gap is measured from `t` (performance.now() at resume), not from before the pause.
   */
  resume(pendingGlosses: ReadonlyArray<string>, t: number): void {
    this.reset();
    this.sentence = [...pendingGlosses];
    this.lastHandT = t;
  }

  push(f: FeatureVector, t: number): void {
    if (hasHand(f)) {
      this.lastHandT = t;
      this.onHand(this.predict(f), t);
    } else {
      this.holdLabel = null;
      // lastHandT is still the previous hand frame here: release only after a real pause.
      if (this.blocked && t - this.lastHandT >= this.opts.releaseMs) this.blocked = null;
    }
    this.checkGaps(t);
  }

  private onHand({ label, confidence }: Prediction, t: number): void {
    const { threshold, letterHoldMs, maxLetters, releaseMs } = this.opts;
    if (confidence < threshold) {
      this.holdLabel = null;
      this.emit('letter', { label, confidence, holdProgress: 0 });
      return;
    }
    this.lastSignalT = t;
    if (label !== this.holdLabel) {
      this.holdLabel = label;
      this.holdStart = t;
    }
    if (this.blocked && label !== this.blocked && t - this.holdStart >= releaseMs) {
      this.blocked = null; // another letter has been held steadily: the previous one is released
    }
    if (label === this.blocked) {
      this.emit('letter', { label, confidence, holdProgress: 0 });
      return;
    }
    const held = t - this.holdStart;
    if (held >= letterHoldMs) {
      this.blocked = label;
      if (this.letters.length < maxLetters) {
        this.letters += label;
        this.emit('word', { letters: this.letters });
      }
      this.emit('letter', { label, confidence, holdProgress: 1 });
    } else {
      this.emit('letter', { label, confidence, holdProgress: held / letterHoldMs });
    }
  }

  private checkGaps(t: number): void {
    const { wordGapMs, sentenceGapMs } = this.opts;
    if (this.letters && t - this.lastSignalT >= wordGapMs) {
      const gloss = FS + this.letters;
      this.letters = '';
      this.sentence.push(gloss);
      this.emit('word', { letters: '' });
      this.emit('gloss', gloss);
    }
    if (this.sentence.length > 0 && !this.letters && t - this.lastHandT >= sentenceGapMs) {
      const glosses = this.sentence;
      this.sentence = [];
      this.emit('sentenceEnd', glosses);
    }
  }

  private emit<K extends keyof SegmenterEvents>(event: K, payload: SegmenterEvents[K]): void {
    this.listeners[event].forEach((cb) => cb(payload));
  }
}

/** `FS:RAKAN` → "Rakan"; other glosses → lower case words ("TERIMA-KASIH" → "terima kasih"). */
export function fingerspellToWord(gloss: string): string {
  if (gloss.startsWith(FS)) {
    const word = gloss.slice(FS.length).toLowerCase();
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return gloss.toLowerCase().replace(/-/g, ' ');
}

/**
 * Text to speak until the translator exists (Phase 6, Mode A rule R1 takes over):
 * words joined by spaces, capital first letter, final period.
 */
export function glossesToText(glosses: ReadonlyArray<string>): string {
  if (glosses.length === 0) return '';
  const text = glosses.map(fingerspellToWord).join(' ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
