// Mode A: rule-based gloss -> Indonesian sentence (PRD F5). Pure TypeScript, offline.
// Port of eval/reference_rules.py; output must be identical (ruleBased.test.ts checks every corpus pair).

import lexicon from '../../data/lexicon.json';
import rules from '../../data/rules.json';

type Token = { gloss: string; word: string; cat: string };

const ENTRIES: Record<string, { word: string; cat: string }> = lexicon.entries;
const RULE = Object.fromEntries(rules.rules.map((r) => [r.id, r]));
const FRONT_QUESTIONS: readonly string[] = RULE['R4_question_front']?.glosses ?? [];
const MOTION_VERBS: readonly string[] = RULE['R5_place_preposition']?.afterGlosses ?? [];
const FINGERSPELL = /^FS:([A-Z]{1,20})$/;

const isPredicate = (t: Token) => t.cat === 'verb' || t.cat === 'adj';

/** Move every token of `cat` to just before the first predicate (index chosen by `adjust`). */
function moveBeforePredicate(
  toks: Token[],
  cat: string,
  adjust: (rest: Token[], i: number) => number = (_, i) => i,
): Token[] {
  const moved = toks.filter((t) => t.cat === cat);
  if (moved.length === 0 || !toks.some(isPredicate)) return toks;
  const rest = toks.filter((t) => t.cat !== cat);
  const i = adjust(rest, rest.findIndex(isPredicate));
  return [...rest.slice(0, i), ...moved, ...rest.slice(i)];
}

export function translateRuleBased(
  glosses: readonly string[],
  { isQuestion = false }: { isQuestion?: boolean } = {},
): string {
  if (glosses.length === 0) return '';

  // R1 fingerspelling + lexicon lookup
  let toks: Token[] = glosses.map((gloss) => {
    const fs = FINGERSPELL.exec(gloss);
    if (fs?.[1]) {
      const w = fs[1].toLowerCase();
      return { gloss, word: w.charAt(0).toUpperCase() + w.slice(1), cat: 'name' };
    }
    const entry = ENTRIES[gloss];
    if (!entry) throw new Error(`Gloss not in lexicon.json: ${gloss}`);
    return { gloss, word: entry.word, cat: entry.cat };
  });

  // R2 aspect (SUDAH, BELUM, MAU) before the first predicate
  toks = moveBeforePredicate(toks, 'aspect');

  // R3 negation before the predicate, and before any aspect directly in front of it
  toks = moveBeforePredicate(toks, 'neg', (rest, i) => {
    let j = i;
    while (j > 0 && rest[j - 1]?.cat === 'aspect') j--;
    return j;
  });

  // R4 SIAPA / KAPAN / MENGAPA / BAGAIMANA at the end move to the front
  const last = toks[toks.length - 1];
  if (last && FRONT_QUESTIONS.includes(last.gloss)) toks = [last, ...toks.slice(0, -1)];

  // R5 'ke' before a place right after a motion verb
  toks = toks.flatMap((t, i) =>
    t.cat === 'place' && i > 0 && MOTION_VERBS.includes(toks[i - 1]?.gloss ?? '')
      ? [{ gloss: '', word: 'ke', cat: 'prep' }, t]
      : [t],
  );

  // R6 default subject when the sentence (after greetings/requests) starts with a predicate
  let j = 0;
  while (j < toks.length && ['greeting', 'request'].includes(toks[j]?.cat ?? '')) j++;
  if (j < toks.length && ['verb', 'aspect', 'neg', 'adj'].includes(toks[j]?.cat ?? '')) {
    toks.splice(j, 0, { gloss: '', word: rules.defaultSubject, cat: 'pronoun' });
  }

  // R7 comma after a leading greeting; R8 capital + punctuation; R9 raised brows -> question
  const words = toks.map((t) => t.word);
  if (toks[0]?.cat === 'greeting' && toks.length > 1) words[0] += ',';
  const s = words.join(' ');
  const question = isQuestion || toks.some((t) => t.cat === 'question');
  return s.charAt(0).toUpperCase() + s.slice(1) + (question ? '?' : '.');
}
