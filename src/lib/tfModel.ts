// TF.js adapter for the classifier. Imported lazily by classifier.ts, only when a model file exists,
// so the TF.js bundle is not downloaded while the app runs in mock mode.

import * as tf from '@tensorflow/tfjs';
import type { ModelRunner } from './classifier';

/** Wrap a Keras-converted LayersModel. Every run is inside tf.tidy, so no tensor outlives it. */
export function wrapLayersModel(model: tf.LayersModel): ModelRunner {
  const output = model.outputs[0];
  if (!output) throw new Error('Model has no output');
  const outShape = output.shape;
  const outputSize = outShape[outShape.length - 1];
  if (typeof outputSize !== 'number') throw new Error('Model output size is unknown');

  return {
    outputSize,
    run(input, shape) {
      return tf.tidy(() => {
        const result = model.predict(tf.tensor(input, shape));
        const tensor = Array.isArray(result) ? result[0] : result;
        if (!tensor) throw new Error('Model returned no output');
        return Float32Array.from(tensor.dataSync());
      });
    },
    dispose() {
      model.dispose();
    },
  };
}

/** Load model.json + weights from `url` (PRD §11.2: tensorflowjs_converter, Keras format). */
export async function loadTfModel(url: string): Promise<ModelRunner> {
  await tf.ready(); // WebGL when available, otherwise the CPU backend
  return wrapLayersModel(await tf.loadLayersModel(url));
}
