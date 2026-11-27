// Mode B (PRD F5): gloss -> sentence with an LLM (Google Gemini). Pure functions only — input
// validation, prompt and response parsing — shared by api/translate.ts and the evaluation.
// No API key here: the key lives only on the server (api/translate.ts reads it from the environment).

import emotionConfig from '../../data/emotion.json';
import vocab from '../../data/vocab.json';
import type { Emotion } from '../../types';

export type TranslateInput = { glosses: string[]; emotion: Emotion; isQuestion: boolean };

const MAX_GLOSSES = 20;
export const MAX_SENTENCE_CHARS = 300;
const EMOTIONS = Object.keys(emotionConfig.labels) as Emotion[];
// Every gloss the app can produce: camera signs (minus _IDLE), text-only glosses, fingerspelling.
const KNOWN = new Set([...vocab.signs.filter((s) => !s.startsWith('_')), ...vocab.textOnly]);
const FINGERSPELL = new RegExp(`^${vocab.fingerspellPrefix}[A-Z]{1,20}$`);

/** Trust boundary: only known glosses + an emotion label + a flag may reach the LLM. */
export function validateTranslateInput(body: unknown): TranslateInput {
  if (typeof body !== 'object' || body === null) throw new Error('Body harus objek JSON');
  const { glosses, emotion = 'netral', isQuestion = false } = body as Record<string, unknown>;
  if (!Array.isArray(glosses) || glosses.length === 0 || glosses.length > MAX_GLOSSES) {
    throw new Error(`glosses harus array berisi 1–${MAX_GLOSSES} gloss`);
  }
  for (const g of glosses) {
    if (typeof g !== 'string' || !(KNOWN.has(g) || FINGERSPELL.test(g))) {
      throw new Error(`Gloss tidak dikenal: ${String(g).slice(0, 40)}`);
    }
  }
  if (typeof emotion !== 'string' || !EMOTIONS.includes(emotion as Emotion)) {
    throw new Error('emotion tidak valid');
  }
  if (typeof isQuestion !== 'boolean') throw new Error('isQuestion harus boolean');
  return { glosses: glosses as string[], emotion: emotion as Emotion, isQuestion };
}

/** Worked examples for the prompt. Deliberately NOT from eval/gloss_pairs.json (checked by a test). */
export const FEW_SHOT: ReadonlyArray<{ glosses: string[]; isQuestion: boolean; sentence: string }> =
  [
    {
      glosses: ['TEMAN', 'SAYA', 'DATANG', 'BELUM'],
      isQuestion: false,
      sentence: 'Teman saya belum datang.',
    },
    {
      glosses: ['MEREKA', 'PULANG', 'RUMAH', 'SUDAH'],
      isQuestion: false,
      sentence: 'Mereka sudah pulang ke rumah.',
    },
    { glosses: ['KALIAN', 'MINUM', 'SUDAH'], isQuestion: true, sentence: 'Kalian sudah minum?' },
    {
      glosses: ['FS:BUDI', 'BELAJAR', 'MALAM'],
      isQuestion: false,
      sentence: 'Budi belajar malam.',
    },
  ];

const SYSTEM = [
  'Kamu penerjemah gloss Bahasa Isyarat Indonesia (BISINDO) ke satu kalimat bahasa Indonesia.',
  'Gloss ditulis kapital dan mengikuti tata bahasa isyarat: penanda waktu/aspek (SUDAH, BELUM, MAU)',
  'dan negasi (TIDAK) sering di akhir; kata tanya (APA, SIAPA, KAPAN, MANA, MENGAPA, BAGAIMANA) sering di akhir.',
  'Aturan: susun ulang ke urutan bahasa Indonesia yang wajar; boleh menambah kata fungsi (ke, di, yang) seperlunya;',
  'jangan menambah makna baru; register santai (kamu, bukan Anda); gloss FS:NAMA adalah nama diri, tulis "Nama";',
  'akhiri dengan "?" jika ada kata tanya atau isQuestion true, selain itu ".".',
  'Jawab hanya JSON: {"sentence": "..."}.',
].join(' ');

const describe = (glosses: readonly string[], isQuestion: boolean, emotion: Emotion) =>
  `Gloss: ${glosses.join(' ')}\nisQuestion: ${isQuestion}\nemosi: ${emotion}`;

/** Request body for Gemini `models/{model}:generateContent`. */
export function buildGeminiRequest({ glosses, emotion, isQuestion }: TranslateInput) {
  const contents = FEW_SHOT.flatMap((ex) => [
    { role: 'user', parts: [{ text: describe(ex.glosses, ex.isQuestion, 'netral') }] },
    { role: 'model', parts: [{ text: JSON.stringify({ sentence: ex.sentence }) }] },
  ]);
  contents.push({ role: 'user', parts: [{ text: describe(glosses, isQuestion, emotion) }] });
  return {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  };
}

type GeminiPart = { text?: string; thought?: boolean };
type GeminiResponse = { candidates?: { content?: { parts?: GeminiPart[] } }[] };

/** The sentence from a Gemini reply; throws if the reply is not the JSON we asked for. */
export function parseGeminiResponse(json: unknown): string {
  const parts = (json as GeminiResponse).candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();
  let sentence: unknown;
  try {
    sentence = (JSON.parse(text) as { sentence?: unknown }).sentence;
  } catch {
    throw new Error('Jawaban LLM bukan JSON');
  }
  if (typeof sentence !== 'string' || !sentence.trim() || sentence.length > MAX_SENTENCE_CHARS) {
    throw new Error('Jawaban LLM tidak berisi kalimat yang valid');
  }
  return sentence.trim();
}
