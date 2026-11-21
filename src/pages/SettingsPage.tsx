import { useSettingsStore } from '../store/settingsStore';

// Phase 1 only exposes the debug toggle (needed for the FPS overlay in F1). Full F11 in Phase 7.
export default function SettingsPage() {
  const debug = useSettingsStore((s) => s.debug);
  const setDebug = useSettingsStore((s) => s.setDebug);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-white">Pengaturan</h1>

      <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-slate-800 px-4 py-3">
        <span>
          <span className="block text-base font-medium text-white">Mode debug</span>
          <span className="block text-sm text-slate-400">Tampilkan FPS di layar kamera</span>
        </span>
        <input
          type="checkbox"
          className="h-6 w-6 accent-sky-500"
          checked={debug}
          onChange={(e) => setDebug(e.target.checked)}
        />
      </label>

      <p className="text-sm text-slate-400">Pengaturan lain ditambahkan di Fase 7.</p>
    </section>
  );
}
