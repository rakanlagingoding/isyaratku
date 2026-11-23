type Props = { text: string; spelling: string };

/** The sentence result (≥ 24 px), or the word being spelled while fingerspelling. */
export default function CaptionBar({ text, spelling }: Props) {
  return (
    <div aria-live="polite" className="min-h-16 rounded-xl bg-slate-800 px-4 py-3">
      {spelling ? (
        <p className="text-2xl font-semibold tracking-widest text-sky-300">Mengeja: {spelling}</p>
      ) : text ? (
        <p className="text-3xl font-bold text-white">{text}</p>
      ) : (
        <p className="text-xl text-slate-400">Mulai, lalu eja dengan abjad jari</p>
      )}
    </div>
  );
}
