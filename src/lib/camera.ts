// Camera access helpers. Pure TypeScript, no React.
// Video frames never leave the device: the stream is only attached to a local <video>.

export type CameraErrorKind =
  'denied' | 'not-found' | 'in-use' | 'insecure' | 'unsupported' | 'unknown';

export class CameraError extends Error {
  readonly kind: CameraErrorKind;

  constructor(kind: CameraErrorKind, cause?: unknown) {
    super(`Camera error: ${kind}`, { cause });
    this.name = 'CameraError';
    this.kind = kind;
  }
}

export const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 640 },
  height: { ideal: 480 },
};

/** Map a getUserMedia failure to a small set of cases the UI can explain. */
export function classifyCameraError(err: unknown): CameraErrorKind {
  if (err instanceof CameraError) return err.kind;
  const name = typeof err === 'object' && err !== null && 'name' in err ? String(err.name) : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'not-found';
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'in-use';
    default:
      return 'unknown';
  }
}

/** User-facing message (Indonesian) for each error kind. */
export function cameraErrorMessage(kind: CameraErrorKind): string {
  switch (kind) {
    case 'denied':
      return 'Izin kamera ditolak. Izinkan akses kamera di pengaturan browser, lalu coba lagi.';
    case 'not-found':
      return 'Kamera depan tidak ditemukan di perangkat ini.';
    case 'in-use':
      return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu, lalu coba lagi.';
    case 'insecure':
      return 'Kamera hanya bisa dibuka lewat HTTPS. Buka aplikasi dari alamat https://.';
    case 'unsupported':
      return 'Browser ini tidak mendukung akses kamera. Gunakan Chrome versi terbaru.';
    default:
      return 'Kamera gagal dibuka. Coba lagi.';
  }
}

type CameraEnv = {
  isSecureContext: boolean;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
};

function browserEnv(): CameraEnv {
  return {
    isSecureContext: typeof window !== 'undefined' && window.isSecureContext === true,
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  };
}

/** Open the front camera. Throws CameraError on failure. */
export async function openCamera(
  video: MediaTrackConstraints = DEFAULT_VIDEO_CONSTRAINTS,
  env: CameraEnv = browserEnv(),
): Promise<MediaStream> {
  if (!env.isSecureContext) throw new CameraError('insecure');
  if (!env.mediaDevices?.getUserMedia) throw new CameraError('unsupported');
  try {
    return await env.mediaDevices.getUserMedia({ video, audio: false });
  } catch (err) {
    throw new CameraError(classifyCameraError(err), err);
  }
}

export function stopStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
