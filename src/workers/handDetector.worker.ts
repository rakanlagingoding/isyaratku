// Runs MediaPipe HandLandmarker off the main thread so the UI and overlay keep
// rendering at display rate even when detection is slow (CPU delegate, weak devices).
//
// Flow: init -> load wasm + model -> (remembered delegate | calibrate GPU vs CPU on
// live frames) -> ready ->
// one result per frame. The main thread keeps at most one frame in flight, so the
// worker always processes the newest frame and never builds a queue.

import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { chooseDelegate, median, shouldTryCpu, type Delegate } from '../lib/delegate';
import { FACE_MODEL_PATH, HAND_MODEL_PATH, MEDIAPIPE_WASM_PATH } from '../lib/landmarks';
import emotionConfig from '../data/emotion.json';
import type { FromWorker, ToWorker } from './protocol';

type FrameMsg = Extract<ToWorker, { type: 'frame' }>;

// The app compiles with DOM types; describe just the worker scope we use.
const scope = self as unknown as {
  location: { origin: string };
  postMessage(message: FromWorker): void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
  close(): void;
};

// The landmarker is warmed up on a blank frame right after creation (see warmUp), so the
// benchmark needs only one extra warm-up run on real frames.
const WARMUP_RUNS = 1;
const MEASURED_RUNS = 8;

/**
 * Run one detection on a blank frame. The GPU delegate compiles its WebGL shaders on the
 * first inference (measured: ~9 s cold, ~0.6 s with Chrome's shader cache), so doing it
 * here overlaps that cost with the camera opening / permission prompt.
 * Note: a blank frame only exercises the palm detector; the landmark subgraph may still
 * compile when the first hand appears.
 */
function warmUp(candidate: HandLandmarker): number {
  const start = performance.now();
  // Timestamp 1 ms: real frames use the page's performance.now(), which is always larger.
  candidate.detectForVideo(new ImageData(256, 256), 1);
  return performance.now() - start;
}

let landmarker: HandLandmarker | null = null;
/** Optional (F13): if it fails to load, hands keep working without expressions. */
let face: FaceLandmarker | null = null;
let frameCount = 0;
let frameWaiter: ((frame: FrameMsg) => void) | null = null;
let closed = false;
/** When the first calibration frame arrived; calibration time excludes waiting for the camera. */
let firstFrameAt: number | null = null;

const post = (message: FromWorker) => scope.postMessage(message);

/** Ask the main thread for a frame and wait for it (calibration only). */
function requestFrame(): Promise<FrameMsg> {
  return new Promise((resolve) => {
    frameWaiter = resolve;
    post({ type: 'calibrating' });
  });
}

async function benchmark(candidate: HandLandmarker): Promise<number> {
  const times: number[] = [];
  for (let i = 0; i < WARMUP_RUNS + MEASURED_RUNS; i++) {
    const frame = await requestFrame();
    const start = performance.now();
    firstFrameAt ??= start;
    candidate.detectForVideo(frame.bitmap, frame.timestamp);
    times.push(performance.now() - start);
    frame.bitmap.close();
  }
  console.info('benchmark runs (ms)', times.map((t) => Math.round(t)).join(','));
  return median(times.slice(WARMUP_RUNS));
}

async function init(preferred: Delegate | null): Promise<void> {
  const t0 = performance.now();
  post({ type: 'progress', stage: 'download' });
  // `true` loads the ES-module build of the wasm loader, required inside module workers.
  // Assets are same-origin (DECISIONS #15); resolve against the site root, not the worker URL.
  const origin = scope.location.origin;
  const [fileset, modelBytes] = await Promise.all([
    FilesetResolver.forVisionTasks(`${origin}${MEDIAPIPE_WASM_PATH}`, true),
    fetch(`${origin}${HAND_MODEL_PATH}`).then(async (res) => {
      if (!res.ok) throw new Error(`Hand model download failed: ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    }),
  ]);
  const t1 = performance.now();
  post({ type: 'progress', stage: 'init' });

  const create = async (delegate: Delegate): Promise<HandLandmarker | null> => {
    try {
      const created = await HandLandmarker.createFromOptions(fileset, {
        // Copy so each instance owns its buffer; the model is downloaded only once.
        baseOptions: { modelAssetBuffer: modelBytes.slice(), delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      });
      console.info(`HandLandmarker ${delegate} warm-up (ms)`, Math.round(warmUp(created)));
      return created;
    } catch (err) {
      console.warn(`HandLandmarker ${delegate} delegate failed`, err);
      return null;
    }
  };

  const finish = (
    active: HandLandmarker,
    delegate: Delegate,
    benchmarkMs: Record<Delegate, number | null>,
    cached: boolean,
    tInit: number,
  ) => {
    if (closed) {
      active.close();
      return;
    }
    landmarker = active;
    if (emotionConfig.enabled) void loadFace(fileset, delegate); // off = coming soon (DECISIONS #39)
    const now = performance.now();
    const timings = {
      downloadMs: t1 - t0,
      initMs: tInit - t1,
      calibrateMs: now - (firstFrameAt ?? now),
      waitCameraMs: (firstFrameAt ?? tInit) - tInit,
    };
    console.info('HandLandmarker ready', { delegate, cached, benchmarkMs, timings });
    post({ type: 'ready', delegate, benchmarkMs, cached, timings });
  };

  // Fast path: delegate remembered for this device (DECISIONS #15).
  if (preferred) {
    const remembered = await create(preferred);
    if (remembered) {
      finish(remembered, preferred, { GPU: null, CPU: null }, true, performance.now());
      return;
    }
  }

  // Pick the faster delegate for this device (DECISIONS #12).
  const gpu = await create('GPU');
  const tInit = performance.now();
  post({ type: 'progress', stage: 'calibrate' });
  const gpuMs = gpu ? await benchmark(gpu) : null;
  let cpu: HandLandmarker | null = null;
  let cpuMs: number | null = null;
  if (shouldTryCpu(gpuMs)) {
    cpu = await create('CPU');
    cpuMs = cpu ? await benchmark(cpu) : null;
  }
  const delegate = chooseDelegate(gpuMs, cpuMs); // throws if both failed
  (delegate === 'GPU' ? cpu : gpu)?.close();
  const active = delegate === 'GPU' ? gpu : cpu;
  if (!active) throw new Error('No HandLandmarker available');
  finish(active, delegate, { GPU: gpuMs, CPU: cpuMs }, false, tInit);
}

/** Load the face landmarker after hands are ready, so it never delays the first hand result. */
async function loadFace(
  fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  delegate: Delegate,
): Promise<void> {
  try {
    const res = await fetch(`${scope.location.origin}${FACE_MODEL_PATH}`);
    if (!res.ok) throw new Error(`Face model download failed: ${res.status}`);
    const created = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetBuffer: new Uint8Array(await res.arrayBuffer()), delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    if (closed) return created.close();
    face = created;
    console.info('FaceLandmarker ready', { delegate });
  } catch (err) {
    console.warn('FaceLandmarker unavailable; continuing without expressions', err);
  }
}

/** Face every N frames (PRD F13) to keep the frame rate; a face error never drops the hand result. */
function detectFace(frame: FrameMsg): Record<string, number> | null | undefined {
  if (!face || frameCount % emotionConfig.runEveryNFrames !== 0) return undefined;
  try {
    const categories = face.detectForVideo(frame.bitmap, frame.timestamp).faceBlendshapes[0]
      ?.categories;
    return categories
      ? Object.fromEntries(categories.map(({ categoryName, score }) => [categoryName, score]))
      : null;
  } catch (err) {
    console.error('Face detectForVideo failed', err);
    return undefined;
  }
}

function detect(frame: FrameMsg, active: HandLandmarker): void {
  try {
    frameCount++;
    const start = performance.now();
    const result = active.detectForVideo(frame.bitmap, frame.timestamp);
    const detectMs = performance.now() - start;
    const blendshapes = detectFace(frame);
    post({
      type: 'result',
      timestamp: frame.timestamp,
      detectMs,
      // Copy into plain objects so structured cloning stays cheap and predictable.
      landmarks: result.landmarks.map((hand) => hand.map(({ x, y, z }) => ({ x, y, z }))),
      handedness: result.handedness.map((cats) =>
        cats.map(({ categoryName, score }) => ({ categoryName, score })),
      ),
      ...(blendshapes === undefined ? {} : { blendshapes }),
    });
  } catch (err) {
    console.error('detectForVideo failed', err);
    post({ type: 'skipped' });
  } finally {
    frame.bitmap.close();
  }
}

scope.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      init(msg.preferred).catch((err: unknown) => {
        console.error('Hand detector init failed', err);
        post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      });
      break;
    case 'frame':
      if (frameWaiter) {
        const resolve = frameWaiter;
        frameWaiter = null;
        resolve(msg);
      } else if (landmarker) {
        detect(msg, landmarker);
      } else {
        msg.bitmap.close();
        post({ type: 'skipped' });
      }
      break;
    case 'close':
      closed = true;
      landmarker?.close();
      landmarker = null;
      face?.close();
      face = null;
      scope.close();
      break;
  }
};
