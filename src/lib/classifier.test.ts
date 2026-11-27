import { describe, expect, it, vi } from 'vitest';
import vocab from '../data/vocab.json';
import {
  argmax,
  Classifier,
  LABELS,
  loadModels,
  MOCK_MAX_CONFIDENCE,
  MODEL_URLS,
  modelExists,
  SIGN_WINDOW,
  type ModelRunner,
} from './classifier';
import { FEATURE_LENGTH } from './features';

const features = () => new Float32Array(FEATURE_LENGTH);

/** Fake runner that always gives the highest score to `winner`. */
function fakeRunner(size: number, winner: number, score = 0.9): ModelRunner {
  return {
    outputSize: size,
    run: vi.fn(() => {
      const out = new Float32Array(size).fill((1 - score) / (size - 1));
      out[winner] = score;
      return out;
    }),
    dispose: vi.fn(),
  };
}

const response = (body: string, ok = true) => ({
  ok,
  headers: new Headers(),
  text: () => Promise.resolve(body),
});

const MODEL_JSON = JSON.stringify({ modelTopology: {}, weightsManifest: [] });
const INDEX_HTML = '<!doctype html><html></html>';

describe('labels', () => {
  it('come from vocab.json in the same order', () => {
    expect(LABELS.letters).toEqual(vocab.letters);
    expect(LABELS.signs).toEqual(vocab.signs);
  });
});

describe('argmax', () => {
  it('finds the index of the highest score', () => {
    expect(argmax([0.1, 0.7, 0.2])).toEqual({ index: 1, value: 0.7 });
  });
});

describe('Classifier in mock mode', () => {
  it('returns vocab labels with low confidence', () => {
    const classifier = new Classifier({});
    expect(classifier.status('letters')).toBe('mock');
    for (let i = 0; i < 50; i++) {
      const p = classifier.predictLetter(features());
      expect(vocab.letters).toContain(p.label);
      expect(p.confidence).toBeGreaterThanOrEqual(0);
      expect(p.confidence).toBeLessThan(MOCK_MAX_CONFIDENCE);
    }
  });

  it('picks labels from the injected random source', () => {
    const classifier = new Classifier({}, () => 0.999);
    expect(classifier.predictLetter(features()).label).toBe('Z');
    expect(classifier.predictSign(Array.from({ length: SIGN_WINDOW }, features)).label).toBe(
      '_IDLE',
    );
  });

  it('rejects inputs of the wrong size', () => {
    const classifier = new Classifier({});
    expect(() => classifier.predictLetter(new Float32Array(63))).toThrow();
    expect(() => classifier.predictSign([features()])).toThrow();
  });
});

describe('Classifier with a model', () => {
  it('maps the top output index to the vocab label', () => {
    const letters = fakeRunner(vocab.letters.length, vocab.letters.indexOf('R'));
    const classifier = new Classifier({ letters });
    expect(classifier.status('letters')).toBe('model');
    expect(classifier.status('signs')).toBe('mock');
    expect(classifier.predictLetter(features())).toMatchObject({
      label: 'R',
      confidence: expect.closeTo(0.9, 5) as number,
    });
    expect(letters.run).toHaveBeenCalledWith(expect.any(Float32Array), [1, FEATURE_LENGTH]);
  });

  it('lists the 3 best labels, highest first (debug view)', () => {
    const n = vocab.signs.length;
    const scores = new Float32Array(n);
    scores[vocab.signs.indexOf('APA')] = 0.6;
    scores[vocab.signs.indexOf('CARI')] = 0.25;
    scores[vocab.signs.indexOf('AIR')] = 0.1;
    scores[vocab.signs.indexOf('MAKAN')] = 0.05;
    const signs: ModelRunner = { outputSize: n, run: () => scores, dispose: () => {} };
    const window = Array.from({ length: SIGN_WINDOW }, features);
    const top = new Classifier({ signs }).predictSign(window).top;
    expect(top?.map((p) => p.label)).toEqual(['APA', 'CARI', 'AIR']);
    expect(top?.[1]?.confidence).toBeCloseTo(0.25, 5);
  });

  it('feeds a sign window as one [1, 30, 126] tensor', () => {
    const signs = fakeRunner(vocab.signs.length, vocab.signs.indexOf('MAKAN'));
    const classifier = new Classifier({ signs });
    const window = Array.from({ length: SIGN_WINDOW }, (_, i) => features().fill(i));
    expect(classifier.predictSign(window).label).toBe('MAKAN');
    const [input, shape] = vi.mocked(signs.run).mock.calls[0] ?? [];
    expect(shape).toEqual([1, SIGN_WINDOW, FEATURE_LENGTH]);
    expect(input?.[FEATURE_LENGTH * 5]).toBe(5);
  });

  it('refuses a model whose output size does not match vocab.json', () => {
    expect(() => new Classifier({ letters: fakeRunner(10, 0) })).toThrow(/vocab\.json/);
  });

  it('disposes its models', () => {
    const letters = fakeRunner(vocab.letters.length, 0);
    new Classifier({ letters }).dispose();
    expect(letters.dispose).toHaveBeenCalled();
  });
});

describe('modelExists', () => {
  it('accepts a TF.js model.json', async () => {
    expect(await modelExists('/m.json', () => Promise.resolve(response(MODEL_JSON)))).toBe(true);
  });

  it('rejects the SPA fallback page served with status 200', async () => {
    expect(await modelExists('/m.json', () => Promise.resolve(response(INDEX_HTML)))).toBe(false);
  });

  it('rejects 404 and network errors', async () => {
    expect(await modelExists('/m.json', () => Promise.resolve(response('', false)))).toBe(false);
    expect(await modelExists('/m.json', () => Promise.reject(new Error('offline')))).toBe(false);
  });
});

describe('loadModels', () => {
  it('uses mock mode when no model file exists, without calling the loader', async () => {
    const loader = vi.fn();
    const classifier = await loadModels({
      fetchImpl: () => Promise.resolve(response(INDEX_HTML)),
      loader,
    });
    expect(classifier.status('letters')).toBe('mock');
    expect(classifier.status('signs')).toBe('mock');
    expect(loader).not.toHaveBeenCalled();
  });

  it('loads only the models that exist', async () => {
    const classifier = await loadModels({
      fetchImpl: (url) =>
        Promise.resolve(response(url === MODEL_URLS.letters ? MODEL_JSON : INDEX_HTML)),
      loader: () => Promise.resolve(fakeRunner(vocab.letters.length, 0)),
    });
    expect(classifier.status('letters')).toBe('model');
    expect(classifier.status('signs')).toBe('mock');
  });

  it('falls back to mock when a model fails to load or does not match vocab.json', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrongSize = fakeRunner(5, 0);
    const classifier = await loadModels({
      fetchImpl: () => Promise.resolve(response(MODEL_JSON)),
      loader: (url) =>
        url === MODEL_URLS.letters ? Promise.resolve(wrongSize) : Promise.reject(new Error('bad')),
    });
    expect(classifier.status('letters')).toBe('mock');
    expect(classifier.status('signs')).toBe('mock');
    expect(wrongSize.dispose).toHaveBeenCalled();
  });
});
