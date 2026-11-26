import { describe, expect, it } from 'vitest';
import pairsFile from '../../../eval/gloss_pairs.json';
import referenceOutputs from '../../../eval/reference_outputs.json';
import rules from '../../data/rules.json';
import vocab from '../../data/vocab.json';
import { translateRuleBased } from './ruleBased';

const reference = referenceOutputs as Record<string, string>;

describe('translateRuleBased (Mode A)', () => {
  it.each(rules.mustPass)('mustPass: $glosses', ({ glosses, expected }) => {
    expect(translateRuleBased(glosses)).toBe(expected);
  });

  it.each(rules.mustPassWithFace)(
    'mustPassWithFace: $glosses, isQuestion=$face.isQuestion',
    ({ glosses, face, expected }) => {
      expect(translateRuleBased(glosses, { isQuestion: face.isQuestion })).toBe(expected);
    },
  );

  it('matches eval/reference_rules.py exactly on every corpus pair', () => {
    const mismatches = pairsFile.pairs
      .map((p) => ({ id: p.id, got: translateRuleBased(p.glosses), want: reference[p.id] }))
      .filter((m) => m.got !== m.want);
    expect(mismatches).toEqual([]);
    expect(Object.keys(reference)).toHaveLength(pairsFile.pairs.length);
  });

  it('writes fingerspelled names with a capital letter', () => {
    expect(translateRuleBased(['NAMA', 'SAYA', 'FS:RAKAN'])).toBe('Nama saya Rakan.');
  });

  it('returns an empty string for no glosses', () => {
    expect(translateRuleBased([])).toBe('');
  });

  it('knows every gloss the app can produce (vocab signs + textOnly)', () => {
    const glosses = [...vocab.signs.filter((g) => g !== '_IDLE'), ...vocab.textOnly];
    for (const g of glosses) expect(() => translateRuleBased([g]), g).not.toThrow();
  });

  it('rejects a gloss that is not in lexicon.json instead of guessing', () => {
    expect(() => translateRuleBased(['SAYA', 'TERBANG'])).toThrow(/TERBANG/);
  });
});
