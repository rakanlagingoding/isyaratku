// Translation evaluation (PRD §11.3): Mode A vs Mode B with corpus BLEU and chrF, per difficulty.
// Mode B sentences come from eval/run_eval.mjs (Gemini, when LLM_API_KEY is set); Mode B is scored only
// when every pair has one, so A and B are always compared on the same sentences.

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

function score(rows: Row[], subset: string, scoreB: boolean): Summary {
  const refs = rows.map((r) => r.reference);
  const b = rows.map((r) => r.modeB);
  const hasB = scoreB && b.length > 0 && b.every((x): x is string => x !== null);
  return {
    subset,
    n: rows.length,
    bleuA: corpusBleu(rows.map((r) => r.modeA), refs),
    chrfA: corpusChrf(rows.map((r) => r.modeA), refs),
    bleuB: hasB ? corpusBleu(b, refs) : null,
    chrfB: hasB ? corpusChrf(b, refs) : null,
  };
}

export function evaluate(
  pairs: readonly Pair[],
  modeB: ReadonlyArray<string | null> = [],
): { rows: Row[]; summary: Summary[] } {
  const rows = pairs.map((p, i) => ({
    id: p.id,
    difficulty: p.difficulty,
    glosses: p.glosses.join(' '),
    reference: p.reference,
    modeA: translateRuleBased(p.glosses),
    modeB: modeB[i] ?? null,
  }));
  // One failed Mode B row voids Mode B for every subset: A and B must cover the same sentences.
  const allB = rows.every((r) => r.modeB !== null);
  const subsets = ['mudah', 'sulit'].map((d) =>
    score(
      rows.filter((r) => r.difficulty === d),
      d,
      allB,
    ),
  );
  return { rows, summary: [score(rows, 'semua', allB), ...subsets] };
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
