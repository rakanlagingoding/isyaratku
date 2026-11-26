# Evaluasi Mode A (BLEU + chrF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `npm run eval` scores Mode A on `eval/gloss_pairs.json` with corpus BLEU and chrF (overall, `mudah`, `sulit`) and writes `eval/results.csv`, leaving Mode B columns empty until Mode B exists.

**Architecture:** Metrics in a pure module `src/lib/metrics.ts` (tested against values computed by sacreBLEU); orchestration in `eval/evaluate.ts`; `eval/run_eval.mjs` loads the TS modules through Vite's module runner (no new dependency; Node cannot import the JSON files without import attributes).

**Tech Stack:** TypeScript, Vitest, Vite `createServer` + `ssrLoadModule`.

**Spec:** PRD §11.3 (`eval/run_eval.ts`: Mode A and Mode B, BLEU and chrF, `eval/results.csv`, split per difficulty); DECISIONS #7, #32.

## Global Constraints

- BLEU = sacreBLEU defaults: 4-gram, tokenizer `13a`, case-sensitive, corpus-level with brevity penalty, `exp` smoothing.
- chrF = sacreBLEU defaults: character 6-grams, word order 0, β = 2, whitespace removed.
- Scores on a 0–100 scale, rounded to 2 decimals in output.
- No new npm dependency. sacreBLEU is used only in a scratch venv to produce test fixtures.

## Review Focus

1. Hypothesis or reference empty (e.g. a Mode B column not filled) → score 0, no crash, no NaN (test in Task 1).
2. Punctuation attached to words (`makan.`, `Halo,`) tokenized like `13a` → BLEU matches sacreBLEU (test in Task 1).
3. Exact match → BLEU 100 and chrF 100 (test in Task 1).
4. CSV fields containing commas or quotes (`Halo, apa kabar?`) are quoted correctly (test in Task 2).

---

### Task 1: `src/lib/metrics.ts`

**Files:** Create `src/lib/metrics.ts`, `src/lib/metrics.test.ts`

**Interfaces — Produces:** `tokenize13a(s: string): string[]`, `corpusBleu(hyps: string[], refs: string[]): number`, `corpusChrf(hyps: string[], refs: string[]): number` (0–100; one reference per hypothesis).

- [ ] Step 1: compute fixtures with sacreBLEU (scratch venv): `corpus_bleu` / `corpus_chrf` on 3–4 small Indonesian corpora (exact, partial, zero-overlap, punctuation).
- [ ] Step 2: write failing tests asserting those numbers (`toBeCloseTo(x, 2)`), plus empty hypothesis → 0 and exact → 100.
- [ ] Step 3: run → FAIL (module missing).
- [ ] Step 4: implement; run → PASS.
- [ ] Step 5: commit `feat(eval): BLEU and chrF matching sacreBLEU`.

### Task 2: `eval/evaluate.ts` + `eval/run_eval.mjs` + `npm run eval`

**Files:** Create `eval/evaluate.ts`, `eval/evaluate.test.ts` (included in Vitest), `eval/run_eval.mjs`; modify `package.json` (`"eval": "node eval/run_eval.mjs"`), `vite.config.ts` test `include` (+ `eval/**/*.test.ts`).

**Interfaces — Consumes:** `translateRuleBased` (Mode A), Task 1 metrics. **Produces:** `evaluate(pairs): { rows: Row[]; summary: Summary[] }`, `toCsv(rows: Row[]): string`.

- [ ] Step 1: failing tests — `summary` has `semua`, `mudah`, `sulit` rows for Mode A with BLEU/chrF in 0–100 and Mode B `null`; `toCsv` quotes `Halo, apa kabar?` and doubles `"`.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: run → PASS.
- [ ] Step 5: `npm run eval` prints the summary table and writes `eval/results.csv`.
- [ ] Step 6: record the Mode A numbers in `docs/PROGRESS.md` (Hasil metrik) and commit `feat(eval): npm run eval scores Mode A`.
