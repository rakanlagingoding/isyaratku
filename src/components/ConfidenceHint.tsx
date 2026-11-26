type Props = { label: string; confidence: number; threshold: number };

/**
 * Live feedback under the active letter, e.g. "58% — tahan lebih stabil" (docs/REFERENCE-VIDEO.md).
 * Not an aria-live region: it changes every frame and would flood screen readers.
 */
export default function ConfidenceHint({ label, confidence, threshold }: Props) {
  const pct = Math.round(confidence * 100);
  const steady = confidence >= threshold;
  return (
    <p
      className={`rounded-full px-4 py-1 text-lg font-semibold ${
        steady ? 'bg-emerald-500/90 text-slate-950' : 'bg-black/70 text-amber-300'
      }`}
    >
      {steady ? `${label} ${pct}%` : `${pct}% — tahan lebih stabil`}
    </p>
  );
}
