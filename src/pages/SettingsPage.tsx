import { useSettingsStore } from '../store/settingsStore';

// F11. Minimal controls wired to settingsStore; the full layout is Gilang's task (docs/panduan/gilang.md).
export default function SettingsPage() {
  const debug = useSettingsStore((s) => s.debug);
  const setDebug = useSettingsStore((s) => s.setDebug);
  const translator = useSettingsStore((s) => s.translator);
  const setTranslator = useSettingsStore((s) => s.setTranslator);

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-white">Pengaturan</h1>

      <fieldset className="flex flex-col gap-2 rounded-xl bg-slate-800 px-4 py-3">
        <legend className="sr-only">Mode penerjemah</legend>
        <span className="text-base font-medium text-white" aria-hidden="true">
          Mode penerjemah
        </span>
        {(
          [
            ['rule', 'Mode A — aturan (offline)'],
            ['llm', 'Mode B — LLM (butuh internet, jatuh ke Mode A jika gagal)'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex min-h-12 items-center gap-3 text-base text-slate-200">
            <input
              type="radio"
              name="translator"
              value={value}
              checked={translator === value}
              onChange={() => setTranslator(value)}
              className="h-5 w-5 accent-sky-500"
            />
            {label}
          </label>
        ))}
      </fieldset>

      <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-slate-800 px-4 py-3">
        <span>
          <span className="block text-base font-medium text-white">Mode debug</span>
          <span className="block text-sm text-slate-400">Tampilkan FPS di layar kamera</span>
        </span>
        <input
          type="checkbox"
          {...{ switch: '' }} // native switch (HTML `switch` attribute); unsupported browsers show a checkbox
          className="h-6 w-6 accent-sky-500"
          checked={debug}
          onChange={(e) => setDebug(e.target.checked)}
        />
      </label>

      <p className="text-sm text-slate-400">Pengaturan lain ditambahkan di Fase 7.</p>
    </section>
  );
}
