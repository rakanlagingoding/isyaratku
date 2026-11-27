// Plain-TypeScript forward pass for the two exported Keras models (DECISIONS #38).
// TF.js runs a 30-step GRU as hundreds of tiny ops on the main thread (measured 620 ms per
// prediction on its CPU backend); the same maths on Float32Arrays is ~2 M multiply-adds.
// Supports exactly what the notebooks export: InputLayer, Dense, Dropout, GRU (reset_after=False).
// Anything else throws, and the classifier falls back to TF.js.

import type { ModelRunner } from './classifier';

type LayerJson = { class_name: string; config: Record<string, unknown> };

/** The parts of a TF.js layers-model `model.json` this module reads. */
export type LayersModelJson = {
  modelTopology: { config: { layers: LayerJson[] } };
  weightsManifest: {
    paths: string[];
    weights: { name: string; shape: number[]; dtype: 'float32' }[];
  }[];
};

/** A value between layers: `steps` > 0 = a sequence of `steps` rows of `width`. */
type Value = { data: Float32Array; steps: number; width: number };
type Layer = (v: Value) => Value;

const sigmoid = (v: number) => 1 / (1 + Math.exp(-v));

function activate(name: unknown, out: Float32Array): void {
  switch (name) {
    case 'linear':
      return;
    case 'relu':
      for (let i = 0; i < out.length; i++) out[i] = Math.max(0, out[i] ?? 0);
      return;
    case 'tanh':
      for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] ?? 0);
      return;
    case 'sigmoid':
      for (let i = 0; i < out.length; i++) out[i] = sigmoid(out[i] ?? 0);
      return;
    case 'softmax': {
      let max = -Infinity;
      for (const v of out) max = Math.max(max, v);
      let sum = 0;
      for (let i = 0; i < out.length; i++) sum += out[i] = Math.exp((out[i] ?? 0) - max);
      for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) / sum;
      return;
    }
    default:
      throw new Error(`Unsupported activation: ${String(name)}`);
  }
}

/** out[j] = bias[j] + sum_i x[xOff + i] * kernel[i * cols + j], for `rows` inputs. */
function matVec(
  x: Float32Array,
  xOff: number,
  rows: number,
  kernel: Float32Array,
  cols: number,
  out: Float32Array,
  bias: Float32Array | null,
): void {
  if (bias) out.set(bias);
  else out.fill(0);
  for (let i = 0; i < rows; i++) {
    const v = x[xOff + i] ?? 0;
    if (v === 0) continue;
    const row = i * cols;
    for (let j = 0; j < cols; j++) out[j] = (out[j] ?? 0) + v * (kernel[row + j] ?? 0);
  }
}

function dense(
  units: number,
  activation: unknown,
  kernel: Float32Array,
  bias: Float32Array | null,
): Layer {
  return ({ data, steps, width }) => {
    if (steps > 0) throw new Error('Dense on a sequence is not supported');
    const out = new Float32Array(units);
    matVec(data, 0, width, kernel, units, out, bias);
    activate(activation, out);
    return { data: out, steps: 0, width: units };
  };
}

/**
 * Keras GRU, reset_after=False, gate order z | r | h:
 * z = σ(xWz + hUz + bz), r = σ(xWr + hUr + br), h~ = tanh(xWh + (r·h)Uh + bh), h' = z·h + (1−z)·h~.
 */
function gru(
  u: number,
  returnSequences: boolean,
  kernel: Float32Array,
  recurrent: Float32Array,
  bias: Float32Array | null,
): Layer {
  return ({ data, steps, width }) => {
    if (steps === 0) throw new Error('GRU needs a sequence');
    const h = new Float32Array(u);
    const xProj = new Float32Array(3 * u);
    const hProj = new Float32Array(3 * u);
    const rh = new Float32Array(u);
    const z = new Float32Array(u);
    const hCand = new Float32Array(u);
    const seq = returnSequences ? new Float32Array(steps * u) : null;
    for (let t = 0; t < steps; t++) {
      matVec(data, t * width, width, kernel, 3 * u, xProj, bias);
      matVec(h, 0, u, recurrent, 3 * u, hProj, null); // only the z and r columns are used
      for (let j = 0; j < u; j++) {
        z[j] = sigmoid((xProj[j] ?? 0) + (hProj[j] ?? 0));
        rh[j] = sigmoid((xProj[u + j] ?? 0) + (hProj[u + j] ?? 0)) * (h[j] ?? 0);
      }
      hCand.fill(0);
      for (let i = 0; i < u; i++) {
        const v = rh[i] ?? 0;
        if (v === 0) continue;
        const row = i * 3 * u + 2 * u;
        for (let j = 0; j < u; j++) hCand[j] = (hCand[j] ?? 0) + v * (recurrent[row + j] ?? 0);
      }
      for (let j = 0; j < u; j++) {
        const cand = Math.tanh((xProj[2 * u + j] ?? 0) + (hCand[j] ?? 0));
        const zj = z[j] ?? 0;
        h[j] = zj * (h[j] ?? 0) + (1 - zj) * cand;
      }
      seq?.set(h, t * u);
    }
    return seq
      ? { data: seq, steps, width: u }
      : { data: Float32Array.from(h), steps: 0, width: u };
  };
}

/** Build a runner from `model.json` and its weight bytes (all weight groups concatenated). */
export function buildNativeModel(json: LayersModelJson, weightData: ArrayBuffer): ModelRunner {
  const specs = json.weightsManifest.flatMap((g) => g.weights);
  let offset = 0;
  let specIndex = 0;
  const take = (shape: number[]): Float32Array => {
    const spec = specs[specIndex++];
    if (!spec || spec.dtype !== 'float32' || spec.shape.join() !== shape.join()) {
      throw new Error(
        `Unexpected weight ${spec?.name ?? '(missing)'}; expected [${shape.join(', ')}]`,
      );
    }
    const length = shape.reduce((a, b) => a * b, 1);
    const view = new Float32Array(weightData, offset, length);
    offset += length * 4;
    return view;
  };

  let inputShape: number[] = [];
  let width = 0;
  const layers: Layer[] = [];
  for (const { class_name: kind, config: c } of json.modelTopology.config.layers) {
    switch (kind) {
      case 'InputLayer': {
        inputShape = ((c.batch_input_shape ?? c.batchInputShape) as (number | null)[])
          .slice(1)
          .map(Number);
        width = inputShape.at(-1) ?? 0;
        break;
      }
      case 'Dropout': // inference: identity
        break;
      case 'Dense': {
        const units = Number(c.units);
        const kernel = take([width, units]);
        layers.push(
          dense(units, c.activation, kernel, c.use_bias === false ? null : take([units])),
        );
        width = units;
        break;
      }
      case 'GRU': {
        const u = Number(c.units);
        if (c.reset_after !== false || c.go_backwards === true) {
          throw new Error('Only GRU with reset_after=False, forward direction is supported');
        }
        if (c.activation !== 'tanh' || c.recurrent_activation !== 'sigmoid') {
          throw new Error('Only GRU with tanh / sigmoid activations is supported');
        }
        const kernel = take([width, 3 * u]);
        const recurrent = take([u, 3 * u]);
        const bias = c.use_bias === false ? null : take([3 * u]);
        layers.push(gru(u, c.return_sequences === true, kernel, recurrent, bias));
        width = u;
        break;
      }
      default:
        throw new Error(`Unsupported layer: ${kind}`);
    }
  }
  if (specIndex !== specs.length) throw new Error('model.json has unused weights');

  const inputSize = inputShape.reduce((a, b) => a * b, 1);
  return {
    outputSize: width,
    run(input) {
      if (input.length !== inputSize) {
        throw new Error(`Expected ${inputSize} input values, got ${input.length}`);
      }
      let v: Value =
        inputShape.length > 1
          ? { data: input, steps: inputShape[0] ?? 0, width: inputShape[1] ?? 0 }
          : { data: input, steps: 0, width: inputSize };
      for (const layer of layers) v = layer(v);
      return v.data;
    },
    dispose() {},
  };
}

/** Fetch `model.json` and its weight files from `url` and build a runner. */
export async function loadNativeModel(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelRunner> {
  const base = new URL(url, globalThis.location?.href);
  const res = await fetchImpl(base.href);
  if (!res.ok) throw new Error(`model.json: HTTP ${res.status}`);
  const json = (await res.json()) as LayersModelJson;
  const parts = await Promise.all(
    json.weightsManifest
      .flatMap((g) => g.paths)
      .map(async (p) => {
        const r = await fetchImpl(new URL(p, base).href);
        if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      }),
  );
  const all = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  parts.reduce((at, p) => (all.set(p, at), at + p.length), 0);
  return buildNativeModel(json, all.buffer);
}
