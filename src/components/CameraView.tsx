import { useEffect, useRef, useState } from 'react';
import {
  CameraError,
  cameraErrorMessage,
  openCamera,
  stopStream,
  type CameraErrorKind,
} from '../lib/camera';
import { drawHands, handCount, toHandFrame } from '../lib/landmarks';
import { FpsMeter } from '../lib/fps';
import { webglRendererName } from '../lib/delegate';
import { delegateCacheKey, loadCachedDelegate, saveCachedDelegate } from '../lib/delegateCache';
import { HandSmoother, tweenHands } from '../lib/smoothing';
import { useSettingsStore } from '../store/settingsStore';
import type { FromWorker, LoadStage, ToWorker } from '../workers/protocol';
import type { HandFrame } from '../types';

type Status = 'starting' | 'loading-model' | 'running' | 'error';

type DebugStats = {
  fps: number;
  detectMs: number;
  delegate: string;
  resolution: string;
  loadInfo: string;
};

type Props = {
  /**
   * Called once per detection with One-Euro-smoothed landmarks.
   * Later phases feed this into features/segmenter.
   */
  onFrame?: (frame: HandFrame) => void;
};

const STAGE_TEXT: Record<LoadStage, string> = {
  download: 'Mengunduh model deteksi tangan…',
  init: 'Menyiapkan detektor… (pertama kali bisa sampai ±10 detik)',
  calibrate: 'Menyesuaikan dengan perangkat…',
};

/** The detector runs in a module worker; without Worker support the camera page cannot work. */
const WORKER_SUPPORTED = typeof Worker !== 'undefined';

const formatMs = (ms: number | null) => (ms === null ? 'gagal' : `${ms.toFixed(0)}ms`);
const formatSec = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export default function CameraView({ onFrame }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFrameRef = useRef(onFrame);
  const [status, setStatus] = useState<Status>(WORKER_SUPPORTED ? 'starting' : 'error');
  const [stage, setStage] = useState<LoadStage>('download');
  const [errorKind, setErrorKind] = useState<CameraErrorKind | 'model'>(
    WORKER_SUPPORTED ? 'unknown' : 'unsupported',
  );
  const [attempt, setAttempt] = useState(0);
  const [stats, setStats] = useState<DebugStats>({
    fps: 0,
    detectMs: 0,
    delegate: '-',
    resolution: '-',
    loadInfo: '',
  });
  const [hands, setHands] = useState(0);
  const debug = useSettingsStore((s) => s.debug);
  // Renderer name is part of the delegate cache key; computed once per mount.
  const [renderer] = useState(() => webglRendererName());

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!WORKER_SUPPORTED) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId = 0;

    // Camera and detector load in parallel; status is derived from both.
    let cameraReady = false;
    let detectorReady = false;
    let failed = false;
    const updateStatus = () => {
      if (cancelled || failed) return;
      setStatus(
        cameraReady && detectorReady ? 'running' : cameraReady ? 'loading-model' : 'starting',
      );
    };
    const fail = (kind: CameraErrorKind | 'model') => {
      if (cancelled) return;
      failed = true;
      setErrorKind(kind);
      setStatus('error');
    };

    // Frame pipeline state.
    let acceptingFrames = false; // worker asked for frames (calibrating or ready)
    let frameInFlight = false; // at most one frame at a time -> always the newest frame
    let lastVideoTime = -1;

    // Rendering state.
    const smoother = new HandSmoother();
    let target: HandFrame | null = null; // latest smoothed detection
    let display: HandFrame | null = null; // what is drawn, tweened toward target
    let lastRender = performance.now();

    // Debug stats.
    const meter = new FpsMeter();
    let delegateText = '-';
    let loadInfo = '';
    let detectMsAvg = 0;
    let lastUiUpdate = 0;

    const cacheKey = delegateCacheKey(renderer, navigator.userAgent);
    const mountedAt = performance.now();
    let cameraMs: number | null = null; // includes the permission prompt on first visit
    let firstResultMs: number | null = null;

    // Start the detector immediately so the model downloads while the camera opens.
    const worker = new Worker(new URL('../workers/handDetector.worker.ts', import.meta.url), {
      type: 'module',
    });

    const sendFrame = (video: HTMLVideoElement) => {
      frameInFlight = true;
      lastVideoTime = video.currentTime;
      const timestamp = performance.now();
      createImageBitmap(video)
        .then((bitmap) => {
          if (cancelled) return bitmap.close();
          const msg: ToWorker = { type: 'frame', bitmap, timestamp };
          worker.postMessage(msg, [bitmap]);
        })
        .catch(() => {
          frameInFlight = false; // e.g. video not ready yet; retry next display frame
        });
    };

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      if (acceptingFrames && !frameInFlight && video.currentTime !== lastVideoTime) {
        sendFrame(video);
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const dt = now - lastRender;
      lastRender = now;
      if (target) {
        display = tweenHands(display, target, dt);
        const ctx = canvas.getContext('2d');
        if (ctx) drawHands(ctx, display, canvas.width, canvas.height);
      }
    };

    worker.onmessage = (event: MessageEvent<FromWorker>) => {
      const msg = event.data;
      switch (msg.type) {
        case 'progress':
          if (!cancelled) setStage(msg.stage);
          break;
        case 'calibrating':
          acceptingFrames = true;
          frameInFlight = false;
          break;
        case 'skipped':
          frameInFlight = false;
          break;
        case 'ready': {
          frameInFlight = false;
          acceptingFrames = true;
          detectorReady = true;
          if (!msg.cached) saveCachedDelegate(cacheKey, msg.delegate);
          const { GPU, CPU } = msg.benchmarkMs;
          if (msg.cached) {
            delegateText = `${msg.delegate} (tersimpan)`;
          } else {
            const cpuPart = CPU === null && msg.delegate === 'GPU' ? '' : ` / CPU ${formatMs(CPU)}`;
            delegateText = `${msg.delegate} (GPU ${formatMs(GPU)}${cpuPart})`;
          }
          const t = msg.timings;
          loadInfo = [
            cameraMs === null ? null : `kamera ${formatSec(cameraMs)}`,
            `unduh ${formatSec(t.downloadMs)}`,
            `siap ${formatSec(t.initMs)}`,
            msg.cached ? null : `kalibrasi ${formatSec(t.calibrateMs)}`,
          ]
            .filter(Boolean)
            .join(' · ');
          updateStatus();
          break;
        }
        case 'result': {
          frameInFlight = false;
          if (firstResultMs === null) {
            // The metric users feel: page open -> first hand detection.
            firstResultMs = performance.now() - mountedAt;
            loadInfo = `deteksi pertama ${formatSec(firstResultMs)} · ${loadInfo}`;
            console.info('First detection', { firstResultMs });
          }
          const frame = smoother.apply(toHandFrame(msg, msg.timestamp));
          target = frame;
          onFrameRef.current?.(frame);

          detectMsAvg = detectMsAvg === 0 ? msg.detectMs : detectMsAvg * 0.9 + msg.detectMs * 0.1;
          const fps = meter.tick(msg.timestamp);
          if (msg.timestamp - lastUiUpdate > 250 && !cancelled) {
            // Throttle React updates; the canvas itself is drawn every display frame.
            lastUiUpdate = msg.timestamp;
            const video = videoRef.current;
            setHands(handCount(frame));
            setStats({
              fps,
              detectMs: detectMsAvg,
              delegate: delegateText,
              resolution: video ? `${video.videoWidth}×${video.videoHeight}` : '-',
              loadInfo,
            });
          }
          break;
        }
        case 'error':
          fail('model');
          break;
      }
    };
    worker.onerror = (event) => {
      console.error('Hand detector worker crashed', event);
      fail('model');
    };
    const init: ToWorker = { type: 'init', preferred: loadCachedDelegate(cacheKey) };
    worker.postMessage(init);

    const startCamera = async () => {
      try {
        stream = await openCamera();
        if (cancelled) return stopStream(stream);
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        if (cancelled) return;
        cameraReady = true;
        cameraMs = performance.now() - mountedAt;
        console.info('Camera ready', { cameraMs });
        updateStatus();
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        console.error('Camera failed to open', err);
        fail(err instanceof CameraError ? err.kind : 'unknown');
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stopStream(stream);
      const close: ToWorker = { type: 'close' };
      worker.postMessage(close);
      worker.terminate();
    };
  }, [attempt, renderer]);

  const errorText =
    errorKind === 'model'
      ? 'Model deteksi tangan gagal dimuat. Periksa koneksi internet, lalu coba lagi.'
      : cameraErrorMessage(errorKind);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Video and overlay are mirrored together so the user sees a selfie view. */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
        playsInline
        muted
        autoPlay
      />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover"
        aria-hidden="true"
      />

      {status === 'running' && (
        <div className="absolute top-3 left-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
          {hands === 0 ? 'Tangan tidak terlihat' : `${hands} tangan terdeteksi`}
        </div>
      )}

      {debug && status === 'running' && (
        <div className="absolute top-3 right-3 rounded bg-black/70 px-2 py-1 text-right font-mono text-sm leading-tight text-lime-300">
          <div>{stats.fps.toFixed(0)} FPS deteksi</div>
          <div>deteksi {stats.detectMs.toFixed(0)} ms</div>
          <div>{stats.delegate}</div>
          <div>{stats.resolution}</div>
          <div className="text-xs text-slate-300">{stats.loadInfo}</div>
          <div className="max-w-56 truncate text-xs text-slate-300">{renderer}</div>
        </div>
      )}

      {(status === 'starting' || status === 'loading-model') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-6 text-center text-lg text-white">
          {status === 'starting' ? 'Membuka kamera…' : STAGE_TEXT[stage]}
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900 p-6 text-center"
        >
          <p className="text-lg text-white">{errorText}</p>
          <button
            type="button"
            onClick={() => {
              setStatus('starting');
              setAttempt((n) => n + 1);
            }}
            className="min-h-12 rounded-xl bg-sky-500 px-6 text-lg font-semibold text-slate-950 active:bg-sky-400"
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  );
}
