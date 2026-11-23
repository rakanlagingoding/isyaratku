import { fingerspellToWord } from '../lib/segmenter';

type Props = { glosses: readonly string[]; onRemove: (index: number) => void };

/** Accepted glosses of the current sentence; tap a chip to remove it before the sentence ends. */
export default function GlossChips({ glosses, onRemove }: Props) {
  if (glosses.length === 0) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label="Isyarat terdeteksi">
      {glosses.map((gloss, i) => {
        const word = fingerspellToWord(gloss);
        return (
          <li key={`${gloss}-${i}`}>
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Hapus ${word}`}
              className="min-h-12 rounded-full bg-sky-500 px-4 text-lg font-semibold text-slate-950 shadow active:bg-sky-400"
            >
              {word}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
