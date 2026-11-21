type Props = { title: string; phase: number; description: string };

/** Temporary screen for pages built in later phases. */
export default function PlaceholderPage({ title, phase, description }: Props) {
  return (
    <section className="mx-auto flex h-full max-w-md flex-col gap-3 p-4">
      <h1 className="text-2xl font-bold text-white">{title}</h1>
      <p className="text-base text-slate-300">{description}</p>
      <p className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300">
        Fitur ini dikerjakan di Fase {phase}.
      </p>
    </section>
  );
}
