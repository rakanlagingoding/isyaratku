import * as tf from '@tensorflow/tfjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { wrapLayersModel } from './tfModel';

// Runs on the TF.js CPU backend (no WebGL in jsdom).
beforeAll(async () => {
  await tf.setBackend('cpu');
});

function tinyModel(inputShape: number[], outputs: number): tf.LayersModel {
  const model = tf.sequential();
  if (inputShape.length > 1) model.add(tf.layers.flatten({ inputShape }));
  model.add(
    tf.layers.dense({
      units: outputs,
      activation: 'softmax',
      ...(inputShape.length > 1 ? {} : { inputShape }),
    }),
  );
  return model;
}

/**
 * model.json as written by save_tfjs_layers_model() in training/train_letters.ipynb:
 * tf_keras (Keras 2) `model.to_json()` + one weights file, without the tensorflowjs package.
 */
function kerasStyleArtifacts(sizes: number[]): {
  artifacts: tf.io.ModelArtifacts;
  weights: Float32Array[];
} {
  const initializer = (name: string) => ({
    module: 'keras.initializers',
    class_name: name,
    config: name === 'Zeros' ? {} : { seed: null },
    registered_name: null,
  });
  const dense = (i: number, units: number, activation: string, inputDim: number) => ({
    module: 'keras.layers',
    class_name: 'Dense',
    config: {
      name: i === 0 ? 'dense' : `dense_${i}`,
      trainable: true,
      dtype: 'float32',
      units,
      activation,
      use_bias: true,
      kernel_initializer: initializer('GlorotUniform'),
      bias_initializer: initializer('Zeros'),
      kernel_regularizer: null,
      bias_regularizer: null,
      activity_regularizer: null,
      kernel_constraint: null,
      bias_constraint: null,
    },
    registered_name: null,
    build_config: { input_shape: [null, inputDim] },
  });
  const [input = 0, ...units] = sizes;
  const layers: object[] = [
    {
      module: 'keras.layers',
      class_name: 'InputLayer',
      config: {
        batch_input_shape: [null, input],
        dtype: 'float32',
        sparse: false,
        ragged: false,
        name: 'input_1',
      },
      registered_name: null,
    },
  ];
  const weightSpecs: tf.io.WeightsManifestEntry[] = [];
  const weights: Float32Array[] = [];
  let inDim = input;
  units.forEach((u, i) => {
    const last = i === units.length - 1;
    layers.push(dense(i, u, last ? 'softmax' : 'relu', inDim));
    if (i === 0) {
      layers.push({
        module: 'keras.layers',
        class_name: 'Dropout',
        config: {
          name: 'dropout',
          trainable: true,
          dtype: 'float32',
          rate: 0.3,
          noise_shape: null,
          seed: null,
        },
        registered_name: null,
      });
    }
    const name = i === 0 ? 'dense' : `dense_${i}`;
    const kernel = Float32Array.from({ length: inDim * u }, (_, k) => Math.sin(k + i) * 0.1);
    const bias = Float32Array.from({ length: u }, (_, k) => Math.cos(k + i) * 0.01);
    weightSpecs.push({ name: `${name}/kernel`, shape: [inDim, u], dtype: 'float32' });
    weightSpecs.push({ name: `${name}/bias`, shape: [u], dtype: 'float32' });
    weights.push(kernel, bias);
    inDim = u;
  });
  const total = weights.reduce((n, w) => n + w.length, 0);
  const data = new Float32Array(total);
  let offset = 0;
  for (const w of weights) {
    data.set(w, offset);
    offset += w.length;
  }
  return {
    artifacts: {
      format: 'layers-model',
      modelTopology: {
        class_name: 'Sequential',
        config: { name: 'sequential', layers },
        keras_version: '2.19.0',
        backend: 'tensorflow',
      },
      weightSpecs,
      weightData: data.buffer,
    },
    weights,
  };
}

/** Plain forward pass (Dense relu ... Dense softmax) to check the weights were mapped correctly. */
function forward(x: number[], sizes: number[], weights: Float32Array[]): number[] {
  let h = x;
  for (let l = 0; l < sizes.length - 1; l++) {
    const [inDim = 0, outDim = 0] = [sizes[l], sizes[l + 1]];
    const kernel = weights[l * 2] ?? new Float32Array();
    const bias = weights[l * 2 + 1] ?? new Float32Array();
    const out = Array.from({ length: outDim }, (_, j) => {
      let s = bias[j] ?? 0;
      for (let i = 0; i < inDim; i++) s += (h[i] ?? 0) * (kernel[i * outDim + j] ?? 0);
      return s;
    });
    if (l < sizes.length - 2) {
      h = out.map((v) => Math.max(0, v));
    } else {
      const max = Math.max(...out);
      const exp = out.map((v) => Math.exp(v - max));
      const sum = exp.reduce((a, b) => a + b, 0);
      h = exp.map((v) => v / sum);
    }
  }
  return h;
}

describe('notebook export format', () => {
  it('loads a tf_keras Sequential model.json and reproduces its outputs', async () => {
    const sizes = [126, 128, 64, 26];
    const { artifacts, weights } = kerasStyleArtifacts(sizes);
    const runner = wrapLayersModel(await tf.loadLayersModel(tf.io.fromMemory(artifacts)));
    expect(runner.outputSize).toBe(26);
    const x = Array.from({ length: 126 }, (_, i) => Math.cos(i) * 0.5);
    const got = Array.from(runner.run(Float32Array.from(x), [1, 126]));
    forward(x, sizes, weights).forEach((v, i) => expect(got[i]).toBeCloseTo(v, 5));
    runner.dispose();
  });
});

describe('wrapLayersModel', () => {
  it('reports the output size and returns softmax scores', () => {
    const runner = wrapLayersModel(tinyModel([126], 26));
    expect(runner.outputSize).toBe(26);
    const scores = runner.run(new Float32Array(126).fill(0.1), [1, 126]);
    expect(scores).toHaveLength(26);
    expect(scores.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 4);
    runner.dispose();
  });

  it('does not leak tensors across many predictions', () => {
    const runner = wrapLayersModel(tinyModel([30, 126], 26));
    const input = new Float32Array(30 * 126).fill(0.2);
    runner.run(input, [1, 30, 126]); // warm-up may allocate lasting backend state
    const before = tf.memory().numTensors;
    for (let i = 0; i < 100; i++) runner.run(input, [1, 30, 126]);
    expect(tf.memory().numTensors).toBe(before);
    runner.dispose();
  });
});
