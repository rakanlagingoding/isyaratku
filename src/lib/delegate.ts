// Picks the faster MediaPipe delegate (GPU vs CPU) for this device from measured timings.
// Some devices report a working GPU delegate that is slower than CPU/WASM
// (weak integrated GPUs, software WebGL, low-end Android), so we measure instead of assuming.

export type Delegate = 'GPU' | 'CPU';

/** GPU at or below this median time (ms) is good enough; CPU is not benchmarked then. */
export const GPU_GOOD_ENOUGH_MS = 30;

export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? Number.NaN)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/** True when the CPU delegate should also be benchmarked. */
export function shouldTryCpu(gpuMs: number | null): boolean {
  return gpuMs === null || !(gpuMs <= GPU_GOOD_ENOUGH_MS);
}

/**
 * Choose a delegate from median timings. `null` means that delegate failed to load.
 * Ties go to GPU because it leaves the CPU free for the rest of the app.
 */
export function chooseDelegate(gpuMs: number | null, cpuMs: number | null): Delegate {
  if (gpuMs === null && cpuMs === null) throw new Error('No delegate available');
  if (cpuMs === null) return 'GPU';
  if (gpuMs === null) return 'CPU';
  return cpuMs < gpuMs ? 'CPU' : 'GPU';
}

/** Best-effort WebGL renderer name, for the debug overlay (e.g. "ANGLE (Intel, ...)"). */
export function webglRendererName(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return 'tanpa WebGL';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch {
    return 'tidak diketahui';
  }
}
