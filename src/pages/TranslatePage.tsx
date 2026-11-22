import { useCallback, useEffect, useRef, useState } from 'react';
import CameraView from '../components/CameraView';
import { loadModels, type Classifier } from '../lib/classifier';
import { hasHand, toFeatures } from '../lib/features';
import { useSettingsStore } from '../store/settingsStore';
import type { HandFrame, Prediction } from '../types';

const PREDICTION_UI_INTERVAL_MS = 250;

// Phase 2: camera + model status, plus a live letter prediction in debug mode (F3 check).
// Gloss chips, caption and controls come in Phase 3 (F7).
export default function TranslatePage() {
  const debug = useSettingsStore((s) => s.debug);
  const [classifier, setClassifier] = useState<Classifier | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const lastUiUpdate = useRef(0);

  useEffect(() => {
    let disposed = false;
    let loaded: Classifier | null = null;
    void loadModels().then((c) => {
      if (disposed) return c.dispose();
      loaded = c;
      setClassifier(c);
    });
    return () => {
      disposed = true;
      loaded?.dispose();
    };
  }, []);

  const onFrame = useCallback(
    (frame: HandFrame, aspect: number) => {
      if (!classifier || !debug) return;
      const now = performance.now();
      if (now - lastUiUpdate.current < PREDICTION_UI_INTERVAL_MS) return;
      lastUiUpdate.current = now;
      const features = toFeatures(frame, aspect);
      setPrediction(hasHand(features) ? classifier.predictLetter(features) : null);
    },
    [classifier, debug],
  );

  const mock = classifier?.status('letters') === 'mock';

  return (
    <section className="relative h-full" aria-label="Terjemah">
      <h1 className="sr-only">Terjemah</h1>
      <CameraView onFrame={onFrame} />
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col items-start gap-2">
        {mock && (
          <span className="rounded-full bg-amber-500/90 px-3 py-1 text-sm font-semibold text-slate-950">
            Model belum dimuat
          </span>
        )}
        {debug && prediction && (
          <span className="rounded bg-black/70 px-2 py-1 font-mono text-sm text-lime-300">
            huruf {prediction.label} · {(prediction.confidence * 100).toFixed(0)}%
            {mock ? ' (acak)' : ''}
          </span>
        )}
      </div>
    </section>
  );
}
