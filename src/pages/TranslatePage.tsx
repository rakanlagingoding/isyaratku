import { useCallback, useEffect, useRef, useState } from 'react';
import CameraView from '../components/CameraView';
import CaptionBar from '../components/CaptionBar';
import ConfidenceHint from '../components/ConfidenceHint';
import GlossChips from '../components/GlossChips';
import { loadModels, type Classifier } from '../lib/classifier';
import { toFeatures } from '../lib/features';
import { Segmenter } from '../lib/segmenter';
import { isSpeechSupported, speak, stopSpeaking } from '../lib/speech';
import { useSessionStore } from '../store/sessionStore';
import type { HandFrame } from '../types';

const THRESHOLD = 0.8; // PRD F4 default; adjustable in F11 (Phase 7)

// Phase 3 (F7 v1): fingerspelling -> FS: chips -> spoken sentence. StageBar/face/translator come later.
export default function TranslatePage() {
  const [classifier, setClassifier] = useState<Classifier | null>(null);
  const segmenterRef = useRef<Segmenter | null>(null);
  const { running, glosses, wordBuffer, active, sentence } = useSessionStore();
  const { start, pause, removeGloss, clear } = useSessionStore();
  const [speechOk] = useState(() => isSpeechSupported());

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

  useEffect(() => {
    if (!classifier) return;
    const seg = new Segmenter((f) => classifier.predictLetter(f), { threshold: THRESHOLD });
    const s = useSessionStore.getState();
    const offs = [
      seg.on('letter', ({ label, confidence }) => s.setActive({ label, confidence })),
      seg.on('word', ({ letters }) => s.setWordBuffer(letters)),
      seg.on('gloss', (gloss) => {
        s.addGloss(gloss);
        navigator.vibrate?.(50);
      }),
      seg.on('sentenceEnd', () => {
        // Use the chips, not the event payload: the user may have removed some.
        const text = s.takeSentence();
        if (text) speak(text);
      }),
    ];
    segmenterRef.current = seg;
    return () => {
      offs.forEach((off) => off());
      segmenterRef.current = null;
    };
  }, [classifier]);

  const onFrame = useCallback((frame: HandFrame, aspect: number) => {
    const seg = segmenterRef.current;
    if (!seg || !useSessionStore.getState().running) return;
    seg.push(toFeatures(frame, aspect), frame.timestamp);
  }, []);

  const toggleRunning = () => {
    if (running) {
      pause();
      segmenterRef.current?.reset();
    } else {
      // Chips made before the pause stay part of the sentence and are spoken at its end.
      segmenterRef.current?.resume(useSessionStore.getState().glosses, performance.now());
      start();
    }
  };

  const clearAll = () => {
    clear();
    segmenterRef.current?.reset();
    stopSpeaking();
  };

  const mock = classifier?.status('letters') === 'mock';

  return (
    <section className="flex h-full flex-col" aria-label="Terjemah">
      <h1 className="sr-only">Terjemah</h1>
      <div className="relative min-h-0 flex-1">
        <CameraView onFrame={onFrame} />
        <div className="pointer-events-none absolute inset-x-3 top-14 [&_button]:pointer-events-auto">
          <GlossChips glosses={glosses} onRemove={removeGloss} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex flex-col items-center gap-2">
          {running && active && (
            <ConfidenceHint
              label={active.label}
              confidence={active.confidence}
              threshold={THRESHOLD}
            />
          )}
          {mock && (
            <span className="rounded-full bg-amber-500/90 px-3 py-1 text-sm font-semibold text-slate-950">
              Model belum dimuat
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <CaptionBar text={sentence} spelling={wordBuffer} />
        {!speechOk && <p className="text-sm text-amber-300">Suara tidak didukung browser ini.</p>}

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis isyarat">
          <button
            type="button"
            role="radio"
            aria-checked="true"
            className="min-h-12 rounded-xl bg-sky-500 font-semibold text-slate-950"
          >
            Abjad
          </button>
          <button
            type="button"
            role="radio"
            aria-checked="false"
            disabled
            title="Model kata belum ada"
            className="min-h-12 rounded-xl bg-slate-800 font-semibold text-slate-500"
          >
            Kata <span className="block text-xs font-normal">Model kata belum ada</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={toggleRunning}
            disabled={!classifier}
            className={`min-h-14 rounded-xl text-lg font-bold disabled:opacity-50 ${
              running ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {running ? 'Jeda' : 'Mulai'}
          </button>
          <button
            type="button"
            onClick={() => speak(sentence)}
            disabled={!sentence || !speechOk}
            className="min-h-14 rounded-xl bg-slate-700 text-base font-semibold text-white disabled:opacity-50"
          >
            Ucapkan ulang
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="min-h-14 rounded-xl bg-slate-700 text-lg font-semibold text-red-300"
          >
            Hapus
          </button>
        </div>
      </div>
    </section>
  );
}
