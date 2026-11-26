import { describe, expect, it } from 'vitest';
import { corpusBleu, corpusChrf, tokenize13a } from './metrics';

// Expected numbers computed with sacreBLEU 2.6.0 (corpus_bleu / corpus_chrf, default settings).
const FIXTURES = {
  exact: {
    hyps: ['Saya sudah makan.', 'Kapan kamu pulang?'],
    refs: ['Saya sudah makan.', 'Kapan kamu pulang?'],
    bleu: 100,
    chrf: 100,
  },
  partial: {
    hyps: ['Saya makan sudah.', 'Kamu pulang kapan?', 'Halo, nama saya Gilang.'],
    refs: ['Saya sudah makan.', 'Kapan kamu pulang?', 'Halo, nama saya Gilang.'],
    bleu: 58.4707,
    chrf: 74.6935,
  },
  zero: { hyps: ['xyz qrs'], refs: ['Saya sudah makan.'], bleu: 0, chrf: 2.5253 },
  punct: {
    hyps: ['Saya cari motor.', 'Malam saya belajar.', 'Terima kasih, teman.'],
    refs: ['Saya mencari motor.', 'Malam ini saya belajar.', 'Terima kasih, teman.'],
    bleu: 60.6959,
    chrf: 78.1672,
  },
};

describe('tokenize13a', () => {
  it('splits punctuation from words like sacreBLEU 13a', () => {
    expect(tokenize13a('Halo, nama saya Gilang.')).toEqual([
      'Halo',
      ',',
      'nama',
      'saya',
      'Gilang',
      '.',
    ]);
  });
});

describe('corpusBleu / corpusChrf match sacreBLEU', () => {
  it.each(Object.entries(FIXTURES))('%s', (_, f) => {
    expect(corpusBleu(f.hyps, f.refs)).toBeCloseTo(f.bleu, 2);
    expect(corpusChrf(f.hyps, f.refs)).toBeCloseTo(f.chrf, 2);
  });
});

describe('empty input', () => {
  it('scores an empty hypothesis as 0 without NaN', () => {
    expect(corpusBleu([''], ['Saya sudah makan.'])).toBe(0);
    expect(corpusChrf([''], ['Saya sudah makan.'])).toBe(0);
    expect(corpusBleu([], [])).toBe(0);
  });

  it('rejects hypothesis and reference lists of different length', () => {
    expect(() => corpusBleu(['a'], [])).toThrow();
  });
});
