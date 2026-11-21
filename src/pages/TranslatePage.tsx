import CameraView from '../components/CameraView';

// Phase 1: camera + hand overlay only. Gloss chips, caption and controls come in Phase 3 (F7).
export default function TranslatePage() {
  return (
    <section className="h-full" aria-label="Terjemah">
      <h1 className="sr-only">Terjemah</h1>
      <CameraView />
    </section>
  );
}
