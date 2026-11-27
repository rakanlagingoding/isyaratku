import * as tf from '@tensorflow/tfjs';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildNativeModel, loadNativeModel, type LayersModelJson } from './nativeModel';

beforeAll(async () => {
  await tf.setBackend('cpu');
});

function readModel(kind: string): { json: LayersModelJson; weights: ArrayBuffer } {
  const dir = `public/models/${kind}`;
  const json = JSON.parse(readFileSync(`${dir}/model.json`, 'utf-8')) as LayersModelJson;
  const bin = readFileSync(`${dir}/${json.weightsManifest[0]?.paths[0] ?? ''}`);
  return { json, weights: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) };
}

describe('buildNativeModel', () => {
  // The committed models: the plain-TypeScript forward pass must match TF.js.
  it.each([
    ['signs', [1, 30, 126]],
    ['letters', [1, 126]],
  ] as const)('%s model matches TF.js outputs', async (kind, shape) => {
    const { json, weights } = readModel(kind);
    const native = buildNativeModel(json, weights);
    const reference = await tf.loadLayersModel(
      tf.io.fromMemory({
        modelTopology: json.modelTopology,
        weightSpecs: json.weightsManifest[0]?.weights,
        weightData: weights,
      }),
    );
    const size = shape.reduce<number>((a, b) => a * b, 1);
    for (let k = 0; k < 3; k++) {
      const x = Float32Array.from({ length: size }, (_, i) => Math.sin(i * 0.37 + k) * 0.8);
      const want = tf.tidy(() =>
        Array.from((reference.predict(tf.tensor(x, [...shape])) as tf.Tensor).dataSync()),
      );
      const got = Array.from(native.run(x, [...shape]));
      expect(got).toHaveLength(want.length);
      want.forEach((v, i) => expect(got[i]).toBeCloseTo(v, 4));
    }
    expect(native.outputSize).toBe(json.weightsManifest[0]?.weights.at(-1)?.shape[0]);
    reference.dispose();
    // TF.js reference needs ~0.6 s per GRU prediction; the default 5 s is too tight in a parallel run.
  }, 30_000);

  it('rejects layers it cannot run, so the caller falls back to TF.js', () => {
    const { json, weights } = readModel('letters');
    const layers = json.modelTopology.config.layers;
    const broken = structuredClone(json);
    broken.modelTopology.config.layers = [
      ...layers.slice(0, 1),
      { class_name: 'LSTM', config: {} },
    ];
    expect(() => buildNativeModel(broken, weights)).toThrow(/LSTM/);
  });

  it('rejects an input of the wrong size', () => {
    const { json, weights } = readModel('signs');
    expect(() => buildNativeModel(json, weights).run(new Float32Array(10), [1, 10])).toThrow();
  });

  it('loadNativeModel fetches model.json and its weights relative to the model URL', async () => {
    const { json, weights } = readModel('letters');
    const requested: string[] = [];
    const fetchImpl = ((input: string) => {
      requested.push(input);
      const body = input.endsWith('model.json') ? JSON.stringify(json) : weights;
      return Promise.resolve(new Response(body));
    }) as unknown as typeof fetch; // only the call shape loadNativeModel uses
    const runner = await loadNativeModel('https://app.test/models/letters/model.json', fetchImpl);
    expect(requested).toEqual([
      'https://app.test/models/letters/model.json',
      `https://app.test/models/letters/${json.weightsManifest[0]?.paths[0] ?? ''}`,
    ]);
    expect(runner.outputSize).toBe(26);
  });
});
