// Realtime segmentation (PRD F4). `Segmenter`: fingerspelling — stable letters become words, words
// become `FS:<LETTERS>` glosses (DECISIONS #5). `WordSegmenter`: signs from 30-frame windows.
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

/** Typed event emitter shared by both segmenters. */
class Emitter<E> {
  private readonly listeners: { [K in keyof E]?: Set<(payload: E[K]) => void> } = {};

  on<K extends keyof E>(event: K, cb: (payload: E[K]) => void): () => void {
    const set = (this.listeners[event] ??= new Set());
    set.add(cb);
    return () => set.delete(cb);
  }

  protected emit<K extends keyof E>(event: K, payload: E[K]): void {
    this.listeners[event]?.forEach((cb) => cb(payload));
  }
}

const DEFAULTS: Required<SegmenterOptions> = {
  threshold: 0.8,
  letterHoldMs: 500,
  wordGapMs: 1000,
  sentenceGapMs: 2500,
  maxLetters: 20,
  releaseMs: 200,
};

const FS = vocab.fingerspellPrefix;

export class Segmenter extends Emitter<SegmenterEvents> implements GlossSegmenter {
  private readonly predict: LetterPredictor;
  private readonly opts: Required<SegmenterOptions>;

  private holdLabel: string | null = null;
  private holdStart = 0;
  /** Last accepted letter; the same letter needs a release (no hand / other letter) to repeat. */
  private blocked: string | null = null;
  private letters = '';
  private lastSignalT = -Infinity; // last frame with a confident letter
  private lastHandT = -Infinity; // last frame with any hand
  private sentence: string[] = [];

  constructor(predict: LetterPredictor, opts: SegmenterOptions = {}) {
    super();
    this.predict = predict;
    this.opts = { ...DEFAULTS, ...opts };
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
}

/** What the Translate page needs from either segmenter. */
export interface GlossSegmenter {
  on(event: 'gloss', cb: (gloss: string) => void): () => void;
  on(event: 'sentenceEnd', cb: (glosses: string[]) => void): () => void;
  push(f: FeatureVector, t: number): void;
  reset(): void;
  resume(pendingGlosses: ReadonlyArray<string>, t: number): void;
}

export type SignPredictor = (window: ReadonlyArray<FeatureVector>) => Prediction;

export type WordSegmenterOptions = {
  /** Minimum confidence for a prediction to count (PRD F4 default 0.8). */
  threshold?: number;
  /** Frames per prediction window (the signs model input). */
  window?: number;
  /** Predict every this many frames once the window is full. */
  stride?: number;
  /** Consecutive confident predictions of one sign needed to accept it. */
  stableCount?: number;
  /** No hand or `_IDLE` this long after a gloss ends the sentence (PRD F4: 1000 ms). */
  sentenceGapMs?: number;
};

export type WordSegmenterEvents = {
  /** Every prediction: what the model sees now (for the confidence hint). */
  sign: Prediction;
  /** A sign was accepted as a gloss. */
  gloss: string;
  /** The sentence ended; payload = glosses made since the last sentence. */
  sentenceEnd: string[];
};

const WORD_DEFAULTS: Required<WordSegmenterOptions> = {
  threshold: 0.8,
  window: 30,
  stride: 2,
  stableCount: 3,
  sentenceGapMs: 1000,
};

// vocab.json: `_IDLE` is the last sign class (see `_signsSource`).
const IDLE = vocab.signs.at(-1) ?? '';

export class WordSegmenter extends Emitter<WordSegmenterEvents> implements GlossSegmenter {
  private readonly predict: SignPredictor;
  private readonly opts: Required<WordSegmenterOptions>;

  private frames: FeatureVector[] = [];
  private framesSeen = 0;
  private lastLabel: string | null = null; // latest prediction, carried between strides
  private streakLabel: string | null = null;
  private streak = 0;
  /** Last accepted gloss; the same sign needs an `_IDLE` prediction in between to repeat. */
  private lastGloss: string | null = null;
  private lastActiveT = -Infinity; // last frame with a hand that is not `_IDLE`
  private sentence: string[] = [];

  constructor(predict: SignPredictor, opts: WordSegmenterOptions = {}) {
    super();
    this.predict = predict;
    this.opts = { ...WORD_DEFAULTS, ...opts };
  }

  reset(): void {
    this.frames = [];
    this.framesSeen = 0;
    this.lastLabel = null;
    this.streakLabel = null;
    this.streak = 0;
    this.lastGloss = null;
    this.lastActiveT = -Infinity;
    this.sentence = [];
  }

  /** Same contract as `Segmenter.resume`. */
  resume(pendingGlosses: ReadonlyArray<string>, t: number): void {
    this.reset();
    this.sentence = [...pendingGlosses];
    this.lastActiveT = t;
  }

  push(f: FeatureVector, t: number): void {
    const { window, stride } = this.opts;
    this.frames.push(f);
    if (this.frames.length > window) this.frames.shift();
    this.framesSeen++;

    if (hasHand(f)) {
      // Only frames with a hand are classified; a hand-less frame is a pause, handled by time.
      if (this.frames.length === window && (this.framesSeen - window) % stride === 0) {
        this.onPrediction(this.predict(this.frames));
      }
      if (this.lastLabel !== IDLE) this.lastActiveT = t;
    }

    if (this.sentence.length > 0 && t - this.lastActiveT >= this.opts.sentenceGapMs) {
      const glosses = this.sentence;
      this.sentence = [];
      this.lastGloss = null; // a new sentence may start with the same sign
      this.streak = 0;
      this.emit('sentenceEnd', glosses);
    }
  }

  private onPrediction(p: Prediction): void {
    const { threshold, stableCount } = this.opts;
    this.lastLabel = p.label;
    this.emit('sign', p);
    if (p.label === IDLE) {
      this.lastGloss = null; // the pause that allows repeating a sign
      this.streak = 0;
      return;
    }
    if (p.confidence < threshold) {
      this.streak = 0;
      return;
    }
    this.streak = p.label === this.streakLabel ? this.streak + 1 : 1;
    this.streakLabel = p.label;
    if (this.streak === stableCount && p.label !== this.lastGloss) {
      this.lastGloss = p.label;
      this.sentence.push(p.label);
      this.emit('gloss', p.label);
    }
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
