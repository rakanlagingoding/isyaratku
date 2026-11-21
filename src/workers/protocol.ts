// Messages between CameraView (main thread) and handDetector.worker.ts.
// Only ImageBitmaps of camera frames cross this boundary; they stay on the device.

import type { Delegate } from '../lib/delegate';
import type { LandmarkerOutput } from '../lib/landmarks';

export type LoadStage = 'download' | 'init' | 'calibrate';

export type ToWorker =
  /** `preferred`: delegate remembered for this device; skips calibration if it loads. */
  | { type: 'init'; preferred: Delegate | null }
  | { type: 'frame'; bitmap: ImageBitmap; timestamp: number }
  | { type: 'close' };

export type FromWorker =
  | { type: 'progress'; stage: LoadStage }
  /** Worker wants another frame for delegate calibration. */
  | { type: 'calibrating' }
  | {
      type: 'ready';
      delegate: Delegate;
      /** Median detect time per delegate; null = failed or not measured. */
      benchmarkMs: Record<Delegate, number | null>;
      /** True when the remembered delegate was used and calibration was skipped. */
      cached: boolean;
      /** Time spent per loading stage (ms), for the debug overlay. */
      timings: {
        downloadMs: number;
        initMs: number;
        /** Pure calibration time, from the first camera frame. */
        calibrateMs: number;
        /** Time the detector sat idle waiting for the camera's first frame. */
        waitCameraMs: number;
      };
    }
  | ({ type: 'result'; timestamp: number; detectMs: number } & LandmarkerOutput)
  /** Frame arrived while the worker could not use it; send another later. */
  | { type: 'skipped' }
  | { type: 'error'; message: string };
