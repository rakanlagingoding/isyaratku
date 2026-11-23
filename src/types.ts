export type Point3 = { x: number; y: number; z: number };

export type HandFrame = {
  timestamp: number; // ms, from performance.now()
  left: Point3[] | null; // 21 points or null
  right: Point3[] | null;
};

export type FeatureVector = Float32Array; // 126 = 2 hands x 21 points x 3

export type Prediction = {
  label: string; // gloss or letter
  confidence: number; // 0..1
};

export type RecognitionMode = 'letters' | 'signs';
export type TranslatorMode = 'rule' | 'llm';

export type Emotion = 'netral' | 'senang' | 'sedih' | 'marah' | 'bertanya';

export type TranslationResult = {
  glosses: string[];
  sentence: string;
  mode: TranslatorMode;
  latencyMs: number;
  fallback: boolean; // true when Mode B failed and Mode A was used
};

export type Sample = {
  id: string; // uuid
  label: string;
  kind: RecognitionMode;
  frames: number[][]; // letters: 1 x 126, signs: 30 x 126
  recordedBy: string; // recorder initials
  createdAt: string; // ISO
};

export type ChatMessage = {
  id: string;
  from: 'signer' | 'speaker';
  text: string;
  createdAt: string;
};
