import { useCallback, useEffect, useRef, useState } from 'react';
import CameraView from '../components/CameraView';
import CaptionBar from '../components/CaptionBar';
import ConfidenceHint from '../components/ConfidenceHint';
import GlossChips from '../components/GlossChips';
import StageBar from '../components/StageBar';
import { loadModels, type Classifier } from '../lib/classifier';
import { toFeatures } from '../lib/features';
import { fingerspellToWord, Segmenter, WordSegmenter, type GlossSegmenter } from '../lib/segmenter';
import { FaceTracker, toEmotion, type Blendshapes } from '../lib/emotion';
import { isSpeechSupported, speak, stopSpeaking, unlockSpeech } from '../lib/speech';
import { translateModeB } from '../lib/translator/modeB';
import { currentStage, useSessionStore, type Stage } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import type { Emotion, HandFrame } from '../types';
import vocab from '../data/vocab.json';
import emotionConfig from '../data/emotion.json';

const THRESHOLD = 0.8; // PRD F4 default; adjustable in F11 (Phase 7)
const IDLE = vocab.signs.at(-1);
const EMOTION_LABELS = emotionConfig.labels as Record<Emotion, string>;
const FACE_ENABLED = emotionConfig.enabled; // vocab.json: `_IDLE` is the last sign class

// F7: letters (fingerspelling) or words (signs) -> chips -> Mode A sentence -> voice, shown as the
// 4-stage StageBar. The face (F13) makes the sentence a question (R9) and sets the voice tone.
export default function TranslatePage() {
  const [classifier, setClassifier] = useState<Classifier | null>(null);
  const segmenterRef = useRef<GlossSegmenter | null>(null);
  const { running, mode, glosses, wordBuffer, active, sentence, speaking } = useSessionStore();
  const { emotion, sentenceFace, translating, sentenceFallback } = useSessionStore();
  const translator = useSettingsStore((s) => s.translator);
  const { start, pause, setMode, removeGloss, clear } = useSessionStore();
  const [speechOk] = useState(() => isSpeechSupported());
  const [face] = useState(() => new FaceTracker());
  const debug = useSettingsStore((s) => s.debug);

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

  const say = useCallback((text: string, emotion: Emotion) => {
    const { setSpeaking } = useSessionStore.getState();
    if (speak(text, { emotion, onEnd: () => setSpeaking(false) })) setSpeaking(true);
  }, []);

  useEffect(() => {
    if (!classifier) return;
    const s = useSessionStore.getState();
    const offs: Array<() => void> = [];
    let seg: GlossSegmenter;
    if (mode === 'letters') {
      const letters = new Segmenter((f) => classifier.predictLetter(f), { threshold: THRESHOLD });
      offs.push(
        letters.on('letter', ({ label, confidence }) => s.setActive({ label, confidence })),
        letters.on('word', ({ letters: spelled }) => s.setWordBuffer(spelled)),
      );
      seg = letters;
    } else {
      const words = new WordSegmenter((w) => classifier.predictSign(w), { threshold: THRESHOLD });
      offs.push(words.on('sign', (p) => s.setActive(p.label === IDLE ? null : p)));
      seg = words;
    }
    offs.push(
      seg.on('gloss', (gloss) => {
        s.addGloss(gloss);
        navigator.vibrate?.(50);
      }),
      seg.on('sentenceEnd', () => {
        // Use the chips, not the event payload: the user may have removed some.
        const summary = face.summary(performance.now());
        face.reset();
        if (useSettingsStore.getState().translator === 'llm') {
          const glosses = s.beginTranslation();
          if (glosses.length === 0) return;
          void translateModeB(glosses, summary).then(({ sentence: text, fallback }) => {
            s.endTranslation(text, summary, fallback);
            say(text, summary.emotion);
          });
          return;
        }
        const text = s.takeSentence(summary);
        if (text) say(text, summary.emotion);
      }),
    );
    // Switching mode while running: chips stay part of the open sentence.
    if (s.running) seg.resume(s.glosses, performance.now());
    segmenterRef.current = seg;
    return () => {
      offs.forEach((off) => off());
      segmenterRef.current = null;
    };
  }, [classifier, mode, say, face]);

  const onFrame = useCallback((frame: HandFrame, aspect: number) => {
    const seg = segmenterRef.current;
    if (!seg || !useSessionStore.getState().running) return;
    seg.push(toFeatures(frame, aspect), frame.timestamp);
  }, []);

  const onFace = useCallback(
    (blendshapes: Blendshapes | null, t: number) => {
      const s = useSessionStore.getState();
      if (!s.running) return;
      const signal = blendshapes ? toEmotion(blendshapes) : null;
      face.push(signal, t);
      const next = signal?.emotion ?? null;
      if (next !== s.emotion) s.setEmotion(next); // avoid a re-render on every face frame
    },
    [face],
  );

  const toggleRunning = () => {
    if (running) {
      pause();
      segmenterRef.current?.reset();
    } else {
      // Chips made before the pause stay part of the sentence and are spoken at its end.
      segmenterRef.current?.resume(useSessionStore.getState().glosses, performance.now());
      unlockSpeech(); // inside the tap: lets the sentence-end speech play on iOS
      start();
    }
  };

  const clearAll = () => {
    clear();
    segmenterRef.current?.reset();
    face.reset();
    stopSpeaking();
  };

  const mock = classifier?.status(mode) === 'mock';
  const signsReady = classifier?.status('signs') === 'model';

  const stageDetail = (stage: Stage) => {
    switch (stage) {
      case 'tangan':
        if (!running) return 'Tekan Mulai untuk mengenali isyarat.';
        return active
          ? `${mode === 'letters' ? 'Huruf' : 'Isyarat'} terlihat: ${active.label} (${Math.round(active.confidence * 100)}%)${
              wordBuffer ? ` · mengeja ${wordBuffer}` : ''
            }`
          : 'Tangan belum terlihat.';
      case 'ekspresi':
        if (!FACE_ENABLED) return 'Segera hadir: deteksi ekspresi wajah (emosi dan kalimat tanya).';
        if (!running) {
          return sentence
            ? `Kalimat terakhir: ${EMOTION_LABELS[sentenceFace.emotion]}${
                sentenceFace.isQuestion ? ' · kalimat tanya' : ''
              }`
            : 'Tekan Mulai untuk membaca ekspresi wajah.';
        }
        return emotion ? `Wajah: ${EMOTION_LABELS[emotion]}` : 'Wajah belum terlihat.';
      case 'interpretasi':
        if (translating) return 'Menerjemahkan dengan Mode B (LLM)…';
        if (glosses.length > 0)
          return `${glosses.map(fingerspellToWord).join(' ')} → menunggu akhir kalimat`;
        if (!sentence) return 'Belum ada isyarat untuk diterjemahkan.';
        if (translator === 'rule') return `Hasil terakhir (Mode A): ${sentence}`;
        return `Hasil terakhir (${sentenceFallback ? 'Mode A — Mode B gagal' : 'Mode B'}): ${sentence}`;
      case 'suara':
        if (!speechOk) return 'Suara tidak didukung browser ini.';
        return speaking ? `Berbicara: "${sentence}"` : 'Tidak sedang berbicara.';
    }
  };

  return (
    <section className="flex h-full flex-col" aria-label="Terjemah">
      <h1 className="sr-only">Terjemah</h1>
      <div className="relative min-h-0 flex-1">
        <CameraView onFrame={onFrame} onFace={onFace} />
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
          {running && debug && active?.top && (
            // Debug: what else the model considered, to compare a sign with the dataset.
            <p className="rounded bg-black/70 px-2 py-1 font-mono text-sm text-lime-300">
              {active.top.map((p) => `${p.label} ${Math.round(p.confidence * 100)}%`).join(' · ')}
            </p>
          )}
          {mock && (
            <span className="rounded-full bg-amber-500/90 px-3 py-1 text-sm font-semibold text-slate-950">
              Model belum dimuat
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <StageBar
          current={currentStage({ running, speaking, wordBuffer, glosses, translating })}
          renderDetail={stageDetail}
          comingSoon={FACE_ENABLED ? [] : ['ekspresi']}
        />
        <CaptionBar text={sentence} spelling={wordBuffer} />
        {!speechOk && <p className="text-sm text-amber-300">Suara tidak didukung browser ini.</p>}

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis isyarat">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'letters'}
            onClick={() => setMode('letters')}
            className={radioClass(mode === 'letters')}
          >
            Abjad
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'signs'}
            // aria-disabled (not disabled) stays focusable so screen readers hear why
            aria-disabled={!signsReady || undefined}
            onClick={() => signsReady && setMode('signs')}
            className={signsReady ? radioClass(mode === 'signs') : radioClass(false, true)}
          >
            Kata
            {!signsReady && <span className="block text-xs font-normal">Model kata belum ada</span>}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={toggleRunning}
            disabled={!classifier}
            className={`min-h-14 rounded-xl text-lg font-bold disabled:opacity-50 ${
              running
                ? 'bg-amber-500 text-slate-950 active:bg-amber-400'
                : 'bg-emerald-500 text-slate-950 active:bg-emerald-400'
            }`}
          >
            {running ? 'Jeda' : 'Mulai'}
          </button>
          <button
            type="button"
            onClick={() => say(sentence, sentenceFace.emotion)}
            disabled={!sentence || !speechOk}
            className="min-h-14 rounded-xl bg-slate-700 text-base font-semibold text-white active:bg-slate-600 disabled:opacity-50"
          >
            Ucapkan ulang
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="min-h-14 rounded-xl bg-slate-700 text-lg font-semibold text-red-300 active:bg-slate-600"
          >
            Hapus
          </button>
        </div>
      </div>
    </section>
  );
}

function radioClass(checked: boolean, unavailable = false): string {
  if (unavailable) return 'min-h-12 rounded-xl bg-slate-800 font-semibold text-slate-400';
  return `min-h-12 rounded-xl font-semibold ${
    checked ? 'bg-sky-500 text-slate-950' : 'bg-slate-700 text-white active:bg-slate-600'
  }`;
}
