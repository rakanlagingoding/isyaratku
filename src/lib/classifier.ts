// Sign classification (PRD F3). Pure TypeScript, no React.
// Labels come only from src/data/vocab.json; the output index of each model = index in that list.
// When a model file is missing, that model runs in mock mode so the UI can still be developed.

import vocab from '../data/vocab.json';
import type { FeatureVector, Prediction, RecognitionMode } from '../types';
import { FEATURE_LENGTH } from './features';

export const MODEL_URLS: Record<RecognitionMode, string> = {
  letters: '/models/letters/model.json',
  signs: '/models/signs/model.json',
};

export const LABELS: Record<RecognitionMode, readonly string[]> = {
  letters: vocab.letters,
  signs: vocab.signs,
};

/** Frames per sign window (PRD F4, §11.2). */
export const SIGN_WINDOW = 30;

/** Mock predictions never exceed this, so they stay below any acceptance threshold (≥ 0.5). */
export const MOCK_MAX_CONFIDENCE = 0.3;

export type ModelStatus = 'model' | 'mock';

/** A loaded model reduced to what the classifier needs; keeps TF.js out of this module. */
export type ModelRunner = {
  /** Size of the softmax output. */
  readonly outputSize: number;
  /** Run one input of the given shape and return the softmax scores. */
  run(input: Float32Array, shape: number[]): Float32Array;
  dispose(): void;
};

export type ModelLoader = (url: string) => Promise<ModelRunner>;

type FetchLike = (url: string) => Promise<Pick<Response, 'ok' | 'headers' | 'text'>>;

export type LoadOptions = {
  fetchImpl?: FetchLike;
  /** Defaults to the TF.js loader, imported lazily so the mock path never downloads TF.js. */
  loader?: ModelLoader;
  random?: () => number;
};

/** Index and value of the highest score. */
export function argmax(scores: ArrayLike<number>): { index: number; value: number } {
  let index = -1;
  let value = -Infinity;
  for (let i = 0; i < scores.length; i++) {
    const score = scores[i];
    if (score !== undefined && score > value) {
      value = score;
      index = i;
    }
  }
  return { index, value };
}

function labelAt(labels: readonly string[], index: number): string {
  const label = labels[index];
  if (label === undefined) throw new Error(`No label at index ${index}`);
  return label;
}

export class Classifier {
  private readonly runners: Partial<Record<RecognitionMode, ModelRunner>>;
  private readonly random: () => number;

  constructor(runners: Partial<Record<RecognitionMode, ModelRunner>>, random = Math.random) {
    for (const kind of Object.keys(runners) as RecognitionMode[]) {
      const runner = runners[kind];
      if (runner && runner.outputSize !== LABELS[kind].length) {
        throw new Error(
          `Model "${kind}" has ${runner.outputSize} outputs but vocab.json has ${LABELS[kind].length} labels`,
        );
      }
    }
    this.runners = runners;
    this.random = random;
  }

  status(kind: RecognitionMode): ModelStatus {
    return this.runners[kind] ? 'model' : 'mock';
  }

  predictLetter(features: FeatureVector): Prediction {
    if (features.length !== FEATURE_LENGTH) {
      throw new Error(`Expected ${FEATURE_LENGTH} features, got ${features.length}`);
    }
    return this.predict('letters', features, [1, FEATURE_LENGTH]);
  }

  predictSign(window: ReadonlyArray<FeatureVector>): Prediction {
    if (window.length !== SIGN_WINDOW) {
      throw new Error(`Expected a window of ${SIGN_WINDOW} frames, got ${window.length}`);
    }
    const input = new Float32Array(SIGN_WINDOW * FEATURE_LENGTH);
    window.forEach((frame, i) => {
      if (frame.length !== FEATURE_LENGTH) {
        throw new Error(`Frame ${i} has ${frame.length} features, expected ${FEATURE_LENGTH}`);
      }
      input.set(frame, i * FEATURE_LENGTH);
    });
    return this.predict('signs', input, [1, SIGN_WINDOW, FEATURE_LENGTH]);
  }

  dispose(): void {
    Object.values(this.runners).forEach((runner) => runner?.dispose());
  }

  private predict(kind: RecognitionMode, input: Float32Array, shape: number[]): Prediction {
    const labels = LABELS[kind];
    const runner = this.runners[kind];
    if (!runner) {
      const index = Math.min(labels.length - 1, Math.floor(this.random() * labels.length));
      return { label: labelAt(labels, index), confidence: this.random() * MOCK_MAX_CONFIDENCE };
    }
    const scores = runner.run(input, shape);
    const { index, value } = argmax(scores);
    const top = Array.from(scores, (confidence, i) => ({ label: labelAt(labels, i), confidence }))
      .toSorted((a, b) => b.confidence - a.confidence)
      .slice(0, 3);
    return { label: labelAt(labels, index), confidence: value, top };
  }
}

/**
 * True when `url` serves a TF.js model.json. The dev server and the Vercel rewrite answer
 * missing files with index.html (status 200), so the body is checked, not only the status.
 */
export async function modelExists(url: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return false;
    const json: unknown = JSON.parse(await res.text());
    return typeof json === 'object' && json !== null && 'modelTopology' in json;
  } catch {
    return false;
  }
}

const defaultLoader: ModelLoader = async (url) => {
  const { loadTfModel } = await import('./tfModel');
  return loadTfModel(url);
};

/** Load both models; each one that is missing or fails to load falls back to mock mode. */
export async function loadModels(options: LoadOptions = {}): Promise<Classifier> {
  const { fetchImpl = fetch, loader = defaultLoader, random = Math.random } = options;
  const runners: Partial<Record<RecognitionMode, ModelRunner>> = {};

  await Promise.all(
    (Object.keys(MODEL_URLS) as RecognitionMode[]).map(async (kind) => {
      const url = MODEL_URLS[kind];
      if (!(await modelExists(url, fetchImpl))) return;
      try {
        const runner = await loader(url);
        if (runner.outputSize !== LABELS[kind].length) {
          console.error(`Model "${kind}" does not match vocab.json; using mock mode`);
          runner.dispose();
          return;
        }
        runners[kind] = runner;
      } catch (err) {
        console.error(`Model "${kind}" failed to load; using mock mode`, err);
      }
    }),
  );
  return new Classifier(runners, random);
}
