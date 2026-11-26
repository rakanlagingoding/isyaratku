import { describe, expect, it } from 'vitest';
import { evaluate, toCsv } from './evaluate';

const pairs = [
  { id: 'p1', glosses: ['SAYA', 'MAKAN', 'SUDAH'], reference: 'Saya sudah makan.', difficulty: 'mudah' },
  { id: 'p2', glosses: ['HALO', 'APA-KABAR'], reference: 'Halo, apa kabar?', difficulty: 'mudah' },
  { id: 'p3', glosses: ['SAYA', 'CARI', 'MOTOR'], reference: 'Saya mencari motor.', difficulty: 'sulit' },
];

describe('evaluate', () => {
  it('translates every pair with Mode A and leaves Mode B empty', () => {
    const { rows } = evaluate(pairs);
    expect(rows.map((r) => r.modeA)).toEqual(['Saya sudah makan.', 'Halo, apa kabar?', 'Saya cari motor.']);
    expect(rows.every((r) => r.modeB === null)).toBe(true);
  });

  it('summarises BLEU and chrF for all pairs and per difficulty', () => {
    const { summary } = evaluate(pairs);
    expect(summary.map((s) => [s.subset, s.n])).toEqual([
      ['semua', 3],
      ['mudah', 2],
      ['sulit', 1],
    ]);
    const mudah = summary.find((s) => s.subset === 'mudah');
    expect(mudah?.bleuA).toBeCloseTo(100, 6); // both easy pairs are exact matches
    expect(mudah?.chrfA).toBeCloseTo(100, 6);
    const sulit = summary.find((s) => s.subset === 'sulit');
    expect(sulit?.bleuA).toBeGreaterThan(0);
    expect(sulit?.bleuA).toBeLessThan(100);
    expect(summary.every((s) => s.bleuB === null && s.chrfB === null)).toBe(true);
  });
});

describe('toCsv', () => {
  it('quotes fields with commas or quotes and doubles embedded quotes', () => {
    const csv = toCsv([
      {
        id: 'p2',
        difficulty: 'mudah',
        glosses: 'HALO APA-KABAR',
        reference: 'Halo, apa kabar?',
        modeA: 'Ia bilang "halo"',
        modeB: null,
      },
    ]);
    const [header, line] = csv.trim().split('\n');
    expect(header).toBe('id,difficulty,glosses,reference,mode_a,mode_b');
    expect(line).toBe('p2,mudah,HALO APA-KABAR,"Halo, apa kabar?","Ia bilang ""halo""",');
  });
});
