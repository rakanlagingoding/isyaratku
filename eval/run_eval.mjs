// `npm run eval`: score Mode A (and Mode B when available) on eval/gloss_pairs.json.
// Node cannot import the project's JSON/TS modules directly (JSON needs import attributes), so the
// TypeScript code is loaded through Vite's module runner — no extra dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({
  mode: 'test', // skips the HTTPS and PWA plugins in vite.config.ts
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, ws: false },
});
try {
  const { evaluate, toCsv } = await server.ssrLoadModule('/eval/evaluate.ts');
  const { pairs } = JSON.parse(readFileSync('eval/gloss_pairs.json', 'utf8'));
  const { rows, summary } = evaluate(pairs);
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
