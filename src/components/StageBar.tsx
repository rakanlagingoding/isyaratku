import { useState, type ReactNode } from 'react';
import type { Stage } from '../store/sessionStore';

const STAGES: ReadonlyArray<{ id: Stage; label: string }> = [
  { id: 'tangan', label: 'Tangan' },
  { id: 'ekspresi', label: 'Ekspresi' },
  { id: 'interpretasi', label: 'Interpretasi' },
  { id: 'suara', label: 'Suara' },
];

type Props = { current: Stage | null; renderDetail: (stage: Stage) => ReactNode };

/**
 * PRD F7: the 4 pipeline stages under the camera. The running stage is highlighted (color + dot +
 * aria-current); tapping a stage opens its detail below the bar.
 */
export default function StageBar({ current, renderDetail }: Props) {
  const [open, setOpen] = useState<Stage | null>(null);
  return (
    <nav aria-label="Tahap penerjemahan">
      <ol className="grid grid-cols-4 gap-1">
        {STAGES.map(({ id, label }, i) => {
          const isCurrent = id === current;
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                aria-expanded={open === id}
                aria-controls="stage-detail"
                onClick={() => setOpen(open === id ? null : id)}
                className={`flex min-h-12 w-full flex-col items-center justify-center rounded-lg px-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:outline-none ${
                  isCurrent
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 active:bg-slate-700'
                } ${open === id ? 'ring-2 ring-white' : ''}`}
              >
                <span aria-hidden={!isCurrent} className="text-[0.7rem] leading-none">
                  {isCurrent ? '●' : ''}
                  {i + 1}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>
      {open && (
        <div
          id="stage-detail"
          role="region"
          aria-label={`Detail ${STAGES.find((s) => s.id === open)?.label}`}
          className="mt-2 rounded-lg bg-slate-800 px-3 py-2 text-base text-slate-200"
        >
          {renderDetail(open)}
        </div>
      )}
    </nav>
  );
}
