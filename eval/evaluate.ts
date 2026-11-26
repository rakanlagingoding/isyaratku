// Translation evaluation (PRD §11.3): Mode A vs Mode B with corpus BLEU and chrF, per difficulty.
// Mode B columns stay null until api/translate.ts exists. Run with `npm run eval` (eval/run_eval.mjs).

import { corpusBleu, corpusChrf } from '../src/lib/metrics';
import { translateRuleBased } from '../src/lib/translator/ruleBased';

export type Pair = { id: string; glosses: string[]; reference: string; difficulty: string };

export type Row = {
  id: string;
  difficulty: string;
  glosses: string;
  reference: string;
  modeA: string;
  modeB: string | null;
};

export type Summary = {
  subset: string; // 'semua' | 'mudah' | 'sulit'
  n: number;
  bleuA: number;
  chrfA: number;
  bleuB: number | null;
  chrfB: number | null;
};

function score(rows: Row[], subset: string): Summary {
  const refs = rows.map((r) => r.reference);
  const b = rows.map((r) => r.modeB);
  const hasB = b.length > 0 && b.every((x): x is string => x !== null);
  return {
    subset,
    n: rows.length,
    bleuA: corpusBleu(rows.map((r) => r.modeA), refs),
    chrfA: corpusChrf(rows.map((r) => r.modeA), refs),
    bleuB: hasB ? corpusBleu(b, refs) : null,
    chrfB: hasB ? corpusChrf(b, refs) : null,
  };
}

export function evaluate(pairs: readonly Pair[]): { rows: Row[]; summary: Summary[] } {
  const rows = pairs.map((p) => ({
    id: p.id,
    difficulty: p.difficulty,
    glosses: p.glosses.join(' '),
    reference: p.reference,
    modeA: translateRuleBased(p.glosses),
    modeB: null,
  }));
  const subsets = ['mudah', 'sulit'].map((d) => score(rows.filter((r) => r.difficulty === d), d));
  return { rows, summary: [score(rows, 'semua'), ...subsets] };
}

const csvField = (v: string | null) =>
  v === null ? '' : /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v;

export function toCsv(rows: readonly Row[]): string {
  const header = 'id,difficulty,glosses,reference,mode_a,mode_b';
  const lines = rows.map((r) =>
    [r.id, r.difficulty, r.glosses, r.reference, r.modeA, r.modeB].map(csvField).join(','),
  );
  return [header, ...lines].join('\n') + '\n';
}
