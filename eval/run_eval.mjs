// `npm run eval`: score Mode A (and Mode B when available) on eval/gloss_pairs.json.
// Node cannot import the project's JSON/TS modules directly (JSON needs import attributes), so the
// TypeScript code is loaded through Vite's module runner — no extra dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer, loadEnv } from 'vite';

const server = await createServer({
  mode: 'test', // skips the HTTPS and PWA plugins in vite.config.ts
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  const { evaluate, toCsv } = await server.ssrLoadModule('/eval/evaluate.ts');
  const { pairs } = JSON.parse(readFileSync('eval/gloss_pairs.json', 'utf8'));
  const modeB = await translateAllModeB(pairs);
  const { rows, summary } = evaluate(pairs, modeB);
  writeFileSync('eval/results.csv', toCsv(rows));
  const fmt = (v) => (v === null ? '-' : v.toFixed(2));
  console.table(
    summary.map((s) => ({
      subset: s.subset,
      n: s.n,
      'BLEU A': fmt(s.bleuA),
      'chrF A': fmt(s.chrfA),
      'BLEU B': fmt(s.bleuB),
      'chrF B': fmt(s.chrfB),
    })),
  );
  console.log(`eval/results.csv: ${rows.length} pasangan`);
} finally {
  await server.close();
}

/**
 * Mode B for every pair through the same Gemini call as api/translate.ts. Skipped without
 * LLM_API_KEY in .env. Requests are spaced (free-tier rate limits) and retried up to 3 times;
 * pairs that still fail stay null, which leaves the Mode B scores empty (eval/evaluate.ts).
 */
async function translateAllModeB(pairs) {
  const env = loadEnv('production', process.cwd(), 'LLM_');
  if (!env.LLM_API_KEY) {
    console.log('Mode B dilewati: LLM_API_KEY belum diisi di .env');
    return [];
  }
  const { callGemini } = await server.ssrLoadModule('/api/translate.ts');
  const delayMs = Number(env.LLM_EVAL_DELAY_MS) || 4500;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const out = [];
  const failed = [];
  for (const [i, p] of pairs.entries()) {
    let sentence = null;
    for (let attempt = 1; attempt <= 3 && sentence === null; attempt++) {
      try {
        sentence = await callGemini({ glosses: p.glosses, emotion: 'netral', isQuestion: false }, env);
      } catch (err) {
        console.warn(`${p.id} percobaan ${attempt}: ${err.message}`);
        await wait(delayMs * attempt);
      }
    }
    if (sentence === null) failed.push(p.id);
    out.push(sentence);
    process.stdout.write(`\rMode B ${i + 1}/${pairs.length}`);
    await wait(delayMs);
  }
  console.log('');
  if (failed.length) {
    console.log(`Mode B gagal untuk ${failed.length} pasangan (${failed.join(', ')}); skor Mode B dikosongkan.`);
  }
  return out;
}
