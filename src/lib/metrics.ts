// Corpus BLEU and chrF with sacreBLEU 2.x default settings (PRD §11.3, DECISIONS #7). Pure TypeScript.
// Ported from sacrebleu/metrics/{bleu,chrf}.py and tokenizers/tokenizer_13a.py; metrics.test.ts checks
// the numbers against sacreBLEU 2.6.0. One reference per hypothesis.

const MAX_NGRAM = 4;
const CHAR_ORDER = 6;
const BETA = 2;

/** sacreBLEU "13a" tokenizer (mteval-v13a): splits punctuation off words. */
export function tokenize13a(text: string): string[] {
  let line = text.trimEnd().replaceAll('<skipped>', '').replaceAll('-\n', '').replaceAll('\n', ' ');
  if (line.includes('&')) {
    line = line
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
  }
  line = ` ${line} `
    .replace(/([{-~[-` -&(-+:-@/])/g, ' $1 ')
    .replace(/([^0-9])([.,])/g, '$1 $2 ')
    .replace(/([.,])([^0-9])/g, ' $1 $2')
    .replace(/([0-9])(-)/g, '$1 $2 ');
  return line.split(/\s+/).filter(Boolean);
}

function countNgrams(items: readonly string[], n: number, joiner: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i + n <= items.length; i++) {
    const key = items.slice(i, i + n).join(joiner);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function checkLengths(hyps: readonly string[], refs: readonly string[]): void {
  if (hyps.length !== refs.length) {
    throw new Error(`Got ${hyps.length} hypotheses but ${refs.length} references`);
  }
}

/** Corpus BLEU (0–100): 4-gram, 13a tokens, case-sensitive, brevity penalty, "exp" smoothing. */
export function corpusBleu(hyps: readonly string[], refs: readonly string[]): number {
  checkLengths(hyps, refs);
  const correct = new Array<number>(MAX_NGRAM).fill(0);
  const total = new Array<number>(MAX_NGRAM).fill(0);
  let sysLen = 0;
  let refLen = 0;
  hyps.forEach((hyp, k) => {
    const h = tokenize13a(hyp);
    const r = tokenize13a(refs[k] ?? '');
    sysLen += h.length;
    refLen += r.length;
    for (let n = 1; n <= MAX_NGRAM; n++) {
      const refCounts = countNgrams(r, n, ' ');
      for (const [gram, count] of countNgrams(h, n, ' ')) {
        total[n - 1]! += count;
        correct[n - 1]! += Math.min(count, refCounts.get(gram) ?? 0);
      }
    }
  });
  if (!correct.some((c) => c > 0)) return 0;
  const bp = sysLen < refLen ? (sysLen > 0 ? Math.exp(1 - refLen / sysLen) : 0) : 1;
  let smooth = 1;
  let logSum = 0;
  for (let n = 0; n < MAX_NGRAM; n++) {
    const t = total[n] ?? 0;
    if (t === 0) {
      logSum += -9999999999; // no n-grams of this order (all sentences shorter): sacreBLEU my_log(0), score ~0
      continue;
    }
    let p: number;
    if ((correct[n] ?? 0) === 0) {
      smooth *= 2;
      p = 100 / (smooth * t);
    } else {
      p = (100 * (correct[n] ?? 0)) / t;
    }
    logSum += Math.log(p);
  }
  return bp * Math.exp(logSum / MAX_NGRAM);
}

/** Corpus chrF (0–100): character 6-grams, whitespace removed, β = 2, effective-order averaging. */
export function corpusChrf(hyps: readonly string[], refs: readonly string[]): number {
  checkLengths(hyps, refs);
  // [hyp, ref, match] counts per order, summed over the corpus
  const stats = Array.from({ length: CHAR_ORDER }, () => [0, 0, 0]);
  hyps.forEach((hyp, k) => {
    const h = [...hyp.split(/\s+/).join('')];
    const r = [...(refs[k] ?? '').split(/\s+/).join('')];
    for (let n = 1; n <= CHAR_ORDER; n++) {
      const refCounts = countNgrams(r, n, '');
      let hypCount = 0;
      let match = 0;
      for (const [gram, count] of countNgrams(h, n, '')) {
        hypCount += count;
        match += Math.min(count, refCounts.get(gram) ?? 0);
      }
      const s = stats[n - 1]!;
      s[0]! += refCounts.size > 0 ? hypCount : 0;
      s[1]! += [...refCounts.values()].reduce((a, b) => a + b, 0);
      s[2]! += match;
    }
  });
  let avgPrec = 0;
  let avgRec = 0;
  let effective = 0;
  for (const [nHyp = 0, nRef = 0, nMatch = 0] of stats) {
    if (nHyp > 0 && nRef > 0) {
      avgPrec += nMatch / nHyp;
      avgRec += nMatch / nRef;
      effective++;
    }
  }
  if (effective === 0) return 0;
  avgPrec /= effective;
  avgRec /= effective;
  const f = BETA ** 2;
  return avgPrec + avgRec > 0 ? (100 * (1 + f) * avgPrec * avgRec) / (f * avgPrec + avgRec) : 0;
}
