# PRD — IsyaratKu: Penerjemah Bahasa Isyarat BISINDO ke Suara

> Dokumen acuan pengembangan untuk vibe coding dengan Claude Code.
> Proyek mata kuliah **Mesin Penerjemah**, Teknik Informatika UIR.
> Pemilik: Rakan Ibnu Arega (243510441). Versi 1.2, 21 November 2026 (v1.1: ekspresi wajah, suara bernada emosi, tampilan 4 tahap; v1.2: menu Rekam dihapus dari aplikasi; v1.3 (22 Nov): abjad 126 fitur, data latih dari dataset publik, kosakata kamera WL-BISINDO, lihat DECISIONS #16, #21, #22).

---

## 0. Cara memakai dokumen ini (untuk Claude Code)

- Baca seluruh PRD sebelum menulis kode. Jangan menambah fitur di luar dokumen ini.
- Kerjakan **per fase** (bagian 12). Satu fase selesai jika semua kriteria terima (acceptance criteria) terpenuhi.
- Contoh perintah: `Baca PRD.md, kerjakan Fase 1 saja, lalu jelaskan cara mengujinya di HP.`
- Jika ada keputusan yang tidak diatur PRD, pilih opsi paling sederhana dan catat di `docs/DECISIONS.md`.
- Semua teks UI dalam bahasa Indonesia. Nama file, variabel, fungsi, dan komentar kode dalam bahasa Inggris.

---

## 1. Ringkasan produk

IsyaratKu adalah Progressive Web App (PWA) mobile-first yang:

1. Menangkap isyarat tangan **BISINDO** lewat kamera HP.
2. Mengenali isyarat menjadi urutan **gloss** (label kata isyarat, misalnya `SAYA MAKAN SUDAH`).
3. **Menerjemahkan** urutan gloss menjadi kalimat bahasa Indonesia yang wajar (`Saya sudah makan.`). Ini inti "mesin penerjemah".
4. Membaca **ekspresi wajah** (senang, sedih, marah, bertanya, netral) karena di BISINDO ekspresi wajah ikut menentukan makna, misalnya kalimat tanya.
5. Mengucapkan kalimat itu dengan **text-to-speech** yang nadanya menyesuaikan emosi, secara realtime.
6. Arah balik: ucapan lawan bicara diubah menjadi **teks besar** di layar (speech-to-text).

Pengenalan isyarat dan ekspresi wajah berjalan **di perangkat** (browser). Server hanya dipakai untuk Mode B (LLM) dan suara neural (Azure), keduanya punya fallback offline.

Inspirasi tampilan: demo "AI sign language to voice" (bcho, TikTok) dengan alur 4 tahap **Hand Tracking → Emotion Detection → LLM Interpretation → Voice Output**. IsyaratKu mengadaptasinya untuk BISINDO dan bahasa Indonesia, di HP.

## 2. Tujuan dan metrik keberhasilan

| Tujuan | Metrik | Target MVP |
| --- | --- | --- |
| Mengenali abjad jari | Akurasi data uji | ≥ 90% |
| Mengenali kata isyarat | Akurasi dan macro-F1 | ≥ 80% |
| Menerjemahkan gloss → kalimat | BLEU, chrF, rubrik 3 dimensi | Mode B > Mode A |
| Realtime di HP | FPS deteksi | ≥ 15 FPS di HP kelas menengah |
| Respons cepat | Latensi akhir isyarat → suara | ≤ 2 detik |
| Mudah dipakai | Skor SUS (3–5 penguji) | ≥ 68 |

## 3. Pengguna

- **Teman Tuli (pengguna utama):** memperagakan isyarat di depan kamera depan HP, membaca balasan sebagai teks.
- **Lawan bicara (orang dengar):** mendengar suara hasil terjemahan, menjawab dengan bicara.
- **Pengembang/peneliti (Rakan):** menyiapkan dataset publik, melatih model, mengevaluasi terjemahan.

## 4. Cakupan

### 4.1 Dalam cakupan MVP

- Abjad jari BISINDO A–Z (isyarat statis).
- 32 kata isyarat (isyarat dinamis) dari dataset WL-BISINDO, lihat 4.3.
- Penerjemah gloss → kalimat: **Mode A** rule-based (offline) dan **Mode B** LLM (online).
- STT bahasa Indonesia via Web Speech API.
- Model dilatih dari dataset publik (bagian 11.1); **tidak ada** menu Rekam di aplikasi.
- PWA installable, berjalan di Chrome Android.
- Deteksi ekspresi wajah (5 kelas) dari blendshapes MediaPipe, dipakai untuk tanda tanya dan nada kalimat.
- Suara neural Azure (tier gratis) dengan nada sesuai emosi, fallback Web Speech API.
- Tampilan 4 tahap di halaman Terjemah.

### 4.2 Di luar cakupan

- Ekspresi wajah sebagai unsur tata bahasa yang lengkap (mis. penanda negasi lewat gelengan kepala, intensitas). MVP hanya memakai: kalimat tanya dan emosi.
- Suara berbayar (ElevenLabs, dll.).
- Kosakata > 100 kata, SIBI, bahasa isyarat negara lain.
- Akun pengguna, login, database server.
- Aplikasi native (Android/iOS).

### 4.3 Kosakata MVP

**Dikenali kamera (`signs`, 32 gloss + kelas diam)** — mengikuti dataset WL-BISINDO (variasi Banten), DECISIONS #22:

```
Sapaan : TERIMA-KASIH, MAAF
Orang  : SAYA, TEMAN, KELUARGA, TULI
Kerja  : MAKAN, BELAJAR, CARI, INGAT, DENGAR, BERANGKAT, DATANG
Tanya  : APA, SIAPA, MANA, KAPAN, MENGAPA, BAGAIMANA
Waktu  : HARI, PAGI, SIANG, SORE, MALAM
Lain   : AIR, MOTOR, RUMAH, LAGI, MERAH, KUNING, HIJAU, HITAM
Khusus : _IDLE (tidak ada isyarat)
```

**Hanya teks (`textOnly`)** — dipahami penerjemah dan dipakai di korpus evaluasi, tetapi tidak dikenali kamera karena
tidak ada di dataset publik; bisa dieja dengan abjad (`FS:`):

```
HALO, TOLONG, SAMA-SAMA, KAMU, DIA, NAMA, MINUM, PERGI, PULANG, MAU, TIDAK, SUDAH, BELUM, SAKIT, KAMPUS, BAIK
```

Sumber tunggal label: `src/data/vocab.json`.

---

## 5. Tech stack

| Lapisan | Pilihan |
| --- | --- |
| Build | Vite + React 18 + TypeScript (strict) |
| Styling | Tailwind CSS |
| Routing | React Router |
| State | Zustand |
| PWA | vite-plugin-pwa (cache model + aset) |
| Deteksi tangan | `@mediapipe/tasks-vision` (`HandLandmarker`, mode VIDEO, `numHands: 2`) |
| Deteksi wajah | `@mediapipe/tasks-vision` (`FaceLandmarker`, `outputFaceBlendshapes: true`, `numFaces: 1`) |
| Inferensi model | `@tensorflow/tfjs` (backend WebGL, fallback WASM/CPU) |
| Suara (TTS) | Utama: Azure Speech tier gratis F0 (neural `id-ID-GadisNeural` / `id-ID-ArdiNeural`, SSML `prosody`) lewat `api/tts.ts`. Fallback: Web Speech API `speechSynthesis` |
| Suara (STT) | Web Speech API `SpeechRecognition` / `webkitSpeechRecognition` |
| Mode B (LLM) | Serverless function di `api/translate.ts` (Vercel) |
| TTS neural | Serverless function di `api/tts.ts` (Vercel), key Azure hanya di server |
| Dataset latih | Publik: Kaggle (abjad), WL-BISINDO (kata); diubah ke landmark di notebook Colab (bagian 11.1) |
| Pelatihan model | Python + TensorFlow/Keras di Google Colab, ekspor `tensorflowjs_converter` |
| Tes | Vitest + Testing Library |
| Lint/format | ESLint + Prettier |
| Hosting | Vercel (HTTPS wajib untuk kamera dan mikrofon) |

## 6. Arsitektur

```
ARAH 1: isyarat -> suara (4 tahap, tampil di UI)
[1 Tangan]    Kamera depan -> HandLandmarker -> normalisasi (126 fitur/frame)
              -> Segmenter (buffer 30 frame) -> Classifier TF.js -> gloss stabil
[2 Ekspresi]  Frame yang sama (tiap 3 frame) -> FaceLandmarker -> blendshapes
              -> emotion.ts -> emosi per frame -> ringkasan emosi per kalimat
[3 Interpretasi] [akhir kalimat] -> Translator(gloss + emosi)
              (Mode A | Mode B -> /api/translate) -> kalimat
[4 Suara]     kalimat + emosi -> /api/tts (Azure SSML) | fallback Web Speech -> audio

ARAH 2: suara -> teks
Mikrofon -> SpeechRecognition (id-ID) -> teks besar + riwayat percakapan
```

Prinsip:

- Video **tidak pernah** dikirim ke server. Yang dikirim ke `/api/translate` hanya array gloss + label emosi; ke `/api/tts` hanya kalimat + label emosi.
- Mode A selalu tersedia sebagai fallback jika offline atau API gagal.
- Setiap modul di `src/lib/` murni TypeScript tanpa React, agar mudah dites.

## 7. Struktur folder

```
isyaratku/
├─ public/
│  ├─ models/
│  │  ├─ letters/            # model.json + *.bin (abjad, MLP)
│  │  └─ signs/              # model.json + *.bin (kata, GRU)
│  └─ icons/                 # ikon PWA
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                # router + layout
│  ├─ pages/
│  │  ├─ TranslatePage.tsx
│  │  ├─ ConversationPage.tsx
│  │  ├─ LearnPage.tsx
│  │  └─ SettingsPage.tsx
│  ├─ components/
│  │  ├─ CameraView.tsx      # <video> + canvas overlay titik tangan
│  │  ├─ GlossChips.tsx      # chip gloss terdeteksi, bisa dihapus
│  │  ├─ CaptionBar.tsx      # kalimat hasil terjemahan
│  │  ├─ StatusIndicator.tsx # tangan terdeteksi / mengenali / menerjemahkan / berbicara
│  │  ├─ StageBar.tsx        # 4 tahap: Tangan, Ekspresi, Interpretasi, Suara
│  │  ├─ EmotionBadge.tsx    # kotak wajah + label emosi
│  │  ├─ TranslationText.tsx # kalimat, kata tambahan LLM diberi garis bawah
│  │  ├─ MicButton.tsx
│  │  └─ BottomNav.tsx
│  ├─ lib/
│  │  ├─ camera.ts
│  │  ├─ landmarks.ts
│  │  ├─ face.ts              # FaceLandmarker + blendshapes
│  │  ├─ emotion.ts           # blendshapes -> emosi (aturan dari data/emotion.json)
│  │  ├─ features.ts
│  │  ├─ classifier.ts
│  │  ├─ segmenter.ts
│  │  ├─ translator/
│  │  │  ├─ index.ts         # pilih mode A/B + fallback
│  │  │  ├─ ruleBased.ts
│  │  │  └─ llm.ts
│  │  └─ speech.ts            # TTS (Azure | Web Speech) + STT
│  ├─ store/
│  │  ├─ sessionStore.ts     # gloss, kalimat, status
│  │  └─ settingsStore.ts    # persist ke localStorage
│  ├─ data/
│  │  ├─ vocab.json
│  │  ├─ lexicon.json        # gloss -> kata Indonesia
│  │  ├─ rules.json          # aturan urutan & pola kalimat
│  │  ├─ emotion.json        # ambang blendshapes per emosi
│  │  └─ prosody.json        # emosi -> pitch/rate (Azure SSML & Web Speech)
│  └─ types.ts
├─ api/
│  ├─ translate.ts           # serverless Mode B
│  └─ tts.ts                 # serverless TTS Azure
├─ training/
│  ├─ train_letters.ipynb
│  ├─ train_signs.ipynb
│  └─ README.md
├─ eval/
│  ├─ gloss_pairs.json       # korpus uji gloss -> kalimat referensi
│  ├─ run_eval.ts            # hitung BLEU & chrF mode A vs B
│  └─ rubric.md              # rubrik morfosintaksis/semantik/pragmatik
├─ docs/DECISIONS.md
├─ .env.example
└─ PRD.md
```

---

## 8. Model data (`src/types.ts`)

```ts
export type Point3 = { x: number; y: number; z: number };

export type HandFrame = {
  timestamp: number;            // ms, dari performance.now()
  left: Point3[] | null;        // 21 titik atau null
  right: Point3[] | null;
};

export type FeatureVector = Float32Array; // 126 = 2 tangan x 21 titik x 3

export type Prediction = {
  label: string;                // gloss atau huruf
  confidence: number;           // 0..1
};

export type RecognitionMode = 'letters' | 'signs';
export type TranslatorMode = 'rule' | 'llm';

export type Emotion = 'netral' | 'senang' | 'sedih' | 'marah' | 'bertanya';

export type FaceSignal = {
  emotion: Emotion;             // emosi dominan per frame
  confidence: number;           // 0..1
  browRaise: number;            // 0..1, dari browInnerUp, untuk kalimat tanya
};

export type SentenceFace = {
  emotion: Emotion;             // emosi dominan selama kalimat (selain 'bertanya')
  isQuestion: boolean;          // alis naik di >= 30% frame 1 detik terakhir
};

export type TranslationResult = {
  glosses: string[];
  sentence: string;
  addedWords: string[];         // kata yang tidak berasal dari lexicon (untuk garis bawah di UI)
  face: SentenceFace;
  mode: TranslatorMode;
  latencyMs: number;
  fallback: boolean;            // true jika Mode B gagal lalu pakai Mode A
};

export type Sample = {
  id: string;                   // uuid
  label: string;
  kind: RecognitionMode;
  frames: number[][];           // letters: 1 x 126, signs: 30 x 126
  recordedBy: string;           // sumber data, mis. kaggle, roboflow, wl-bisindo
  createdAt: string;            // ISO
};

export type ChatMessage = {
  id: string;
  from: 'signer' | 'speaker';
  text: string;
  createdAt: string;
};
```

---

## 9. Kebutuhan fungsional

Setiap fitur punya ID untuk dirujuk di commit dan percakapan dengan Claude Code.

### F1 — Kamera dan deteksi tangan

- Membuka kamera depan (`facingMode: 'user'`), resolusi 640×480, mode potret.
- Menjalankan `HandLandmarker` per frame via `requestAnimationFrame`, menggambar 21 titik + garis tulang di canvas overlay (cermin horizontal).
- Menampilkan FPS di pojok (hanya saat `debug` aktif di Pengaturan).
- **Terima jika:** di Chrome Android titik tangan mengikuti gerakan ≥ 15 FPS; izin kamera ditolak menampilkan pesan dan tombol coba lagi.

### F2 — Ekstraksi fitur (`features.ts`)

- `toFeatures(frame: HandFrame): FeatureVector` menghasilkan 126 angka: tangan kiri lalu kanan; tangan tidak terdeteksi diisi 0.
- Normalisasi per tangan: kurangi koordinat pergelangan (titik 0), lalu bagi dengan jarak titik 0 ke titik 9.
- Abjad memakai `toFeatures` yang sama (126 angka), karena banyak abjad BISINDO memakai dua tangan (DECISIONS #16). x dan z dikali rasio lebar/tinggi video sebelum normalisasi (DECISIONS #19).
- **Terima jika:** unit test membuktikan hasil tidak berubah saat tangan digeser atau diskalakan.

### F3 — Klasifikasi isyarat (`classifier.ts`)

- `loadModels()` memuat `/models/letters/model.json` dan `/models/signs/model.json`, label dari `vocab.json`.
- `predictLetter(f: FeatureVector): Prediction` dan `predictSign(window: FeatureVector[]): Prediction` (window 30 frame).
- **Mode mock:** jika file model belum ada, classifier mengembalikan prediksi acak dari kosakata dengan confidence rendah, dan UI menampilkan label "Model belum dimuat". UI harus tetap bisa dikembangkan tanpa model.
- **Terima jika:** model yang dimuat dari Colab berjalan di browser; tensor dibersihkan (`tf.tidy` / `dispose`) tanpa kebocoran memori setelah 5 menit.

### F4 — Segmentasi realtime (`segmenter.ts`)

- Sliding window 30 frame, prediksi setiap 2 frame.
- Gloss diterima jika `confidence ≥ threshold` (default 0,8) **dan** label sama di 3 prediksi berturut-turut **dan** berbeda dari gloss terakhir yang diterima (kecuali sudah ada jeda `_IDLE`).
- Akhir kalimat: tangan tidak terdeteksi atau `_IDLE` selama ≥ 1000 ms → event `sentenceEnd(glosses)`.
- API: `class Segmenter { push(f: FeatureVector, t: number): void; on(event, cb); reset(); }` dengan event `gloss` dan `sentenceEnd`.
- Mode abjad: huruf yang stabil 500 ms ditambahkan ke buffer kata; jeda 1000 ms menutup kata, lalu kata masuk sebagai satu gloss eja berformat `FS:<HURUF>` (mis. `FS:RAKAN`), lihat `docs/DECISIONS.md` #5.
- **Terima jika:** unit test dengan urutan prediksi sintetis menghasilkan gloss dan event akhir kalimat yang benar.

### F5 — Penerjemah gloss → kalimat (inti mata kuliah)

**Mode A — rule-based (`ruleBased.ts`), offline:**

1. Petakan gloss ke kata lewat `lexicon.json` (contoh: `TERIMA-KASIH → terima kasih`, `MANA → di mana`). Gloss hasil eja ditulis kapital awal.
2. Terapkan aturan dari `rules.json`, berurutan:
   - Penanda waktu/aspek `SUDAH`, `BELUM`, `MAU` dipindah tepat sebelum kata kerja pertama.
   - `TIDAK` diletakkan sebelum kata kerja/kata sifat yang mengikutinya atau mendahuluinya.
   - `SIAPA`, `KAPAN`, `MENGAPA`, dan `BAGAIMANA` di akhir urutan dipindah ke awal kalimat; `APA` dan `MANA` tetap di akhir ("Kamu di mana?").
   - Tempat setelah kata kerja gerak (`PERGI`, `PULANG`, `BERANGKAT`, `DATANG`) diberi "ke".
   - Subjek default `saya` jika kalimat tanpa subjek diawali kata kerja/aspek/negasi/sifat.
   - Sapaan di awal yang diikuti kata lain diberi koma.
   - Detail lengkap: `src/data/rules.json`; perilaku acuan: `eval/reference_rules.py`.
3. Rapikan: huruf kapital awal, `?` untuk kalimat tanya, `.` untuk lainnya; register santai konsisten (`kamu`, bukan `Anda`).
4. **Sinyal wajah (R9):** jika `face.isQuestion` bernilai `true`, kalimat diakhiri `?` walaupun tidak ada kata tanya. `KAMU MAKAN SUDAH` + alis naik → "Kamu sudah makan?". Emosi tidak mengubah kata di Mode A, hanya nada suara.

Contoh yang wajib lolos tes:

| Gloss | Kalimat |
| --- | --- |
| `SAYA MAKAN SUDAH` | Saya sudah makan. |
| `KAMU PULANG KAPAN` | Kapan kamu pulang? |
| `SAYA SAKIT TIDAK` | Saya tidak sakit. |
| `NAMA KAMU SIAPA` | Siapa nama kamu? |
| `TOLONG SAYA` | Tolong saya. |
| `SAYA MAU PERGI KAMPUS` | Saya mau pergi ke kampus. |
| `TEMAN DATANG KAPAN` | Kapan teman datang? |
| `SAYA DATANG RUMAH TEMAN` | Saya datang ke rumah teman. |

Dua contoh terakhir hanya memakai kosakata kamera, jadi bisa didemokan langsung dari isyarat.

**Mode B — LLM (`llm.ts` + `api/translate.ts`):**

- `POST /api/translate` body `{ "glosses": string[], "emotion": Emotion, "isQuestion": boolean }` → `{ "sentence": string }`. Validasi: maksimal 20 gloss, hanya label `signs`/`textOnly` dari `vocab.json` atau gloss eja yang cocok dengan `^FS:[A-Z]{1,20}$`.
- Prompt few-shot (minimal 6 contoh dari tabel di atas), instruksi: "Ubah urutan gloss BISINDO menjadi satu kalimat bahasa Indonesia baku santai. Pakai 'kamu', bukan 'Anda'. Jangan menambah informasi yang tidak ada di gloss. Sesuaikan pilihan kata secukupnya dengan emosi penutur (mis. 'sedang', 'sekali', 'tolong'). Jika isQuestion true, jadikan kalimat tanya. Keluarkan kalimatnya saja."
- `addedWords` dihitung di klien: kata pada kalimat yang bukan hasil `lexicon.json` dari gloss input.
- `temperature` rendah (0–0,2) untuk konsistensi.
- API key hanya di server (`LLM_API_KEY`), tidak pernah di bundle frontend.
- Timeout 4 detik; gagal/timeout → otomatis Mode A dengan `fallback: true`.

**`translator/index.ts`:** `translate(glosses, face: SentenceFace, mode): Promise<TranslationResult>`.

- **Terima jika:** semua contoh tabel lolos di Mode A (unit test); Mode B mengembalikan kalimat dan fallback bekerja saat jaringan diputus.

### F6 — Text-to-speech dan speech-to-text (`speech.ts`)

- `speak(text, { emotion, provider })` membatalkan ucapan sebelumnya. Nada diambil dari `src/data/prosody.json`.
- **Provider `azure` (utama):** `POST /api/tts` body `{ "text", "emotion", "voice" }` → `audio/mpeg`. Server membuat SSML `<voice name="id-ID-GadisNeural"><prosody pitch=".." rate="..">`. Batas tier gratis F0: 0,5 juta karakter/bulan.
- **Provider `webspeech` (fallback):** `speechSynthesis` dengan suara `id-ID`; `pitch` dan `rate` dari `prosody.json`. Dipakai otomatis jika offline, `/api/tts` gagal, atau timeout 3 detik.
- Isi awal `prosody.json`: netral (pitch 0%, rate 0%), senang (+8%, +5%), sedih (−8%, −12%), marah (+3%, +8%), bertanya (+4%, 0%). Web Speech: pitch = 1 + persen/100.
- `startListening(onPartial, onFinal)` / `stopListening()` dengan `lang = 'id-ID'`, `interimResults = true`.
- Deteksi dukungan: jika `SpeechRecognition` tidak ada, tombol mikrofon nonaktif dengan penjelasan.
- **Terima jika:** kalimat hasil terjemahan otomatis terucap; ucapan lawan bicara tampil sebagai teks ≤ 1 detik setelah selesai bicara (tergantung jaringan).

### F7 — Halaman Terjemah (layar utama, tampilan 4 tahap)

- Kamera penuh layar dengan overlay titik tangan **dan** kotak wajah + label emosi (`EmotionBadge`).
- `StageBar` di bawah kamera berisi 4 tahap: **Tangan · Ekspresi · Interpretasi · Suara**. Tahap yang sedang berjalan disorot, dan bisa diketuk untuk melihat detailnya (titik tangan, skor emosi, gloss → kalimat, status audio).
- `GlossChips` di atas kamera (seperti chip isyarat di demo); indikator keyakinan di bawah gloss aktif, mis. "58% — tahan lebih stabil".
- `TranslationText` menampilkan kalimat hasil; kata dari `addedWords` diberi garis bawah agar terlihat bagian yang "diterjemahkan", bukan sekadar disalin.
- Tombol besar: **Mulai/Jeda**, **Ucapkan ulang**, **Hapus**; toggle **Kata / Abjad**.
- Tap chip gloss untuk menghapusnya sebelum kalimat dikirim.
- Getaran 50 ms (`navigator.vibrate`) saat gloss diterima.

### F8 — Halaman Percakapan

- Layar terbagi: atas kamera + teks hasil isyarat, bawah teks besar hasil STT.
- Tombol mikrofon tahan-untuk-bicara.
- Riwayat bubble (`ChatMessage[]`) tersimpan selama sesi; tombol **Hapus riwayat**.

### F9 — Halaman Belajar (opsional, dikerjakan jika waktu tersisa)

- Daftar 32 gloss kamera + abjad dengan deskripsi cara memperagakan (teks; slot video/GIF opsional di `public/learn/`).
- Mode latihan: pilih gloss, peragakan, tampilkan benar/salah dan confidence.

### F10 — Data latih (dataset publik, bukan menu aplikasi)

Menu **Rekam** dihapus dari aplikasi (DECISIONS #21, #28). Aplikasi hanya punya menu Terjemah, Percakapan,
Belajar (opsional), dan Pengaturan. Data latih berasal dari dataset publik (bagian 11.1) dan diolah di notebook Colab
(`training/`). Skrip perekam laptop (`training/record_dataset.py`, kit v1.2) **ditunda**.

- Notebook menjalankan MediaPipe HandLandmarker pada foto/video dataset, lalu mengubahnya ke 126 fitur yang **identik**
  dengan F2 (`features.ts`): kurangi pergelangan (titik 0), bagi jarak titik 0 → 9, x dan z dikali rasio lebar/tinggi,
  urutan tangan kiri lalu kanan, tangan kosong = 0.
- Hasil antara disimpan sebagai array `Sample` (format `docs/examples/*.example.json`, `recordedBy` = nama sumber).
- Label divalidasi terhadap `src/data/vocab.json`; persentase gambar/video yang terdeteksi MediaPipe dicatat.
- **Terima jika:** notebook menghasilkan model TF.js yang termuat di aplikasi, dan normalisasi Python vs TypeScript
  pada contoh yang sama berselisih ≤ pembulatan 3 desimal.

### F11 — Pengaturan

- Mode penerjemah (A/B), ambang confidence (0,5–0,95), tangan dominan, suara TTS (Gadis/Ardi), provider TTS (Azure/Web Speech), deteksi ekspresi aktif/nonaktif, mode gelap, debug (FPS + confidence + skor blendshapes).
- Disimpan di `localStorage` lewat Zustand `persist`.

### F13 — Deteksi ekspresi wajah (`face.ts`, `emotion.ts`)

- `FaceLandmarker` dijalankan **setiap 3 frame** (bukan tiap frame) untuk menjaga FPS.
- `toEmotion(blendshapes): FaceSignal` memakai ambang di `src/data/emotion.json`, diperiksa berurutan:
  1. `senang`: rata-rata `mouthSmileLeft/Right` ≥ 0,5
  2. `marah`: rata-rata `browDownLeft/Right` ≥ 0,5
  3. `sedih`: rata-rata `mouthFrownLeft/Right` ≥ 0,4
  4. `bertanya`: `browInnerUp` ≥ 0,5
  5. selain itu `netral`
- Ringkasan per kalimat (`SentenceFace`): emosi terbanyak selama kalimat (abaikan `netral` jika ada emosi lain ≥ 30% frame); `isQuestion` jika `browInnerUp` ≥ ambang di ≥ 30% frame dalam 1 detik terakhir sebelum akhir kalimat.
- Ambang bisa dikalibrasi per pengguna di Pengaturan (tombol "Kalibrasi wajah netral" mengambil 2 detik wajah netral sebagai baseline).
- **Terima jika:** unit test dengan blendshapes sintetis menghasilkan emosi yang benar; di HP, FPS tetap ≥ 15 dengan tangan + wajah aktif; senyum, cemberut, dan alis naik terdeteksi dalam ≤ 0,5 detik.

### F12 — PWA dan offline

- Manifest (nama "IsyaratKu", tema gelap, orientasi potret, ikon 192/512).
- Service worker meng-cache aset app, file WASM MediaPipe, dan model TF.js agar Mode A berjalan offline setelah kunjungan pertama.

---

## 10. Kebutuhan non-fungsional

- **Performa:** ≥ 15 FPS dengan tangan + wajah aktif; wajah diproses tiap 3 frame; jika FPS < 12 selama 3 detik, turunkan resolusi ke 480×360, lalu wajah tiap 5 frame.
- **Privasi:** tidak ada video/gambar yang disimpan atau dikirim; aplikasi tidak menyimpan data kamera; data latih berasal dari dataset publik dan diolah di notebook.
- **Aksesibilitas:** teks hasil ≥ 24 px, kontras ≥ 4.5:1, target sentuh ≥ 48 px, semua status penting juga tampil visual (pengguna Tuli tidak mendengar audio).
- **Kompatibilitas:** target utama Chrome Android terbaru; Safari iOS best effort (STT bisa tidak tersedia).
- **Keamanan:** API key (LLM dan Azure) hanya di environment server; validasi input di `/api/translate` dan `/api/tts` (teks ≤ 300 karakter, emosi dari daftar tetap); rate limit sederhana (mis. 30 request/menit per IP).
- **Kualitas kode:** TypeScript strict, tanpa `any` kecuali terpaksa dan diberi komentar; modul `lib/` punya unit test.

## 11. Pelatihan model dan evaluasi

### 11.1 Dataset (publik, DECISIONS #21)

| Model | Sumber | Isi | Lisensi |
| --- | --- | --- | --- |
| `letters` | Kaggle "Abjad Bahasa Isyarat Indonesia (BISINDO)" (Meisya Vira, gabungan dataset Achmad Noer) | 26 huruf × 25 foto | ODbL |
| `letters` (opsional) | Roboflow "BISINDO Dataset" v3 | 22 huruf, grayscale 244×244 | CC BY 4.0 |
| `signs` | WL-BISINDO (Kindy, Leonali & Lucky, Procedia CS 269, 2025) | 32 kata × 10 sampel × 5 peraga, video RGB | CC BY-NC 4.0 |

- Foto/video diubah ke landmark di notebook (`training/`), hasil antara = array `Sample` (bagian 8).
- Video kata di-*resample* ke laju deteksi aplikasi sebelum dipotong menjadi window 30 frame (DECISIONS #22).
- Atribusi semua sumber wajib di laporan; WL-BISINDO hanya untuk penggunaan non-komersial.

### 11.2 Model

| Model | Input | Arsitektur | Output |
| --- | --- | --- | --- |
| `letters` | 126 | Dense 128 → Dropout 0,3 → Dense 64 → Softmax | 26 |
| `signs` | 30 × 126 | GRU 64 (return seq) → GRU 64 → Dense 64 → Softmax | 33 (32 gloss + `_IDLE`) |

- Augmentasi: rotasi ±15°, skala ±10%, noise Gaussian kecil, mirror (pertukaran tangan kiri/kanan).
- Split 70/15/15 (untuk `signs`: protokol signer-independent WL-BISINDO bila memungkinkan), simpan confusion matrix dan classification report untuk laporan.
- Ekspor: `tensorflowjs_converter --input_format=keras model.h5 public/models/<name>/`.
- Urutan label di notebook **harus sama** dengan `vocab.json`.

### 11.3 Evaluasi penerjemahan (untuk laporan)

- `eval/gloss_pairs.json`: 50–100 pasangan `{ "glosses": [...], "reference": "..." }` buatan sendiri.
- `eval/run_eval.ts`: jalankan Mode A dan Mode B pada korpus, hitung **BLEU** dan **chrF**, simpan ke `eval/results.csv`.
- Penilaian manual memakai rubrik 3 dimensi skala 1–5 (morfosintaksis, semantik, pragmatik), mengacu pada paper *Beyond BLEU* (Shalawati, Nasution, dkk., MDPI Digital 2026). LLM boleh dipakai sebagai penilai awal, tetapi minimal 30% sampel divalidasi manusia karena LLM cenderung memberi skor terlalu tinggi.

---

## 12. Rencana implementasi per fase

Kerjakan berurutan. Setiap fase diakhiri: aplikasi bisa dibuka di HP lewat URL deploy, `npm run build` dan `npm test` lolos.

| Fase | Minggu | Isi | Selesai jika |
| --- | --- | --- | --- |
| 1 | 23–29 Nov | Setup Vite+React+TS+Tailwind+Router+Zustand, layout + BottomNav, F1 kamera & overlay, deploy Vercel | Titik tangan tampil di HP via HTTPS |
| 2 | 30 Nov–6 Des | F2 fitur, F3 classifier (mode mock + model abjad), notebook `train_letters` dari dataset publik (F10) | Huruf terdeteksi realtime dengan model abjad |
| 3 | 7–13 Des | F6 TTS, mode eja di F4, F7 halaman Terjemah versi awal, F12 PWA | Eja nama lalu terucap; app bisa di-install |
| 4 | 14–20 Des | Konversi video WL-BISINDO ke landmark, notebook `train_signs` | Model `signs` terekspor |
| 5 | 21–27 Des | F4 segmenter penuh, integrasi model `signs` | Kalimat gloss terkumpul dan event akhir kalimat jalan |
| 6 | 28 Des–3 Jan | F5 Mode A + tes, Mode B + `api/translate`, korpus & `run_eval.ts` | Semua contoh F5 lolos; BLEU/chrF terhitung |
| 7 | 4–10 Jan | **F13 ekspresi wajah**, emosi ke Mode A/B, **TTS Azure + prosody**, **F7 tampilan 4 tahap**, F8 Percakapan, F11 Pengaturan, optimasi performa. F9 Belajar hanya jika waktu cukup | Demo 4 tahap berjalan di HP ≥ 15 FPS; kalimat tanya dari alis naik; nada suara berubah sesuai emosi |
| 8 | 11–17 Jan | Uji pengguna, perbaikan bug, video demo, laporan | Semua metrik bagian 2 tercatat |

## 13. Konfigurasi dan perintah

`.env.example`:

```
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=southeastasia
AZURE_TTS_VOICE=id-ID-GadisNeural
```

Script `package.json` yang diharapkan:

```
npm run dev       # vite --host (agar bisa dibuka dari HP di jaringan yang sama)
npm run build
npm run preview
npm test          # vitest
npm run lint
npm run eval      # tsx eval/run_eval.ts
```

Catatan uji di HP: kamera butuh HTTPS. Untuk dev lokal, pakai `vite --host` dengan plugin `@vitejs/plugin-basic-ssl`, atau langsung uji di URL deploy Vercel.

## 14. Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Dataset publik kecil / peraga sedikit | Gabung beberapa sumber, augmentasi landmark, uji signer-independent, kelas `_IDLE` |
| Isyarat mirip tertukar | Ambang confidence, chip gloss bisa dihapus |
| HP lambat | Resolusi adaptif, inferensi tiap 2 frame, backend WebGL |
| STT tidak didukung browser | Deteksi fitur, pesan jelas, fokus Chrome Android |
| Variasi BISINDO antardaerah (WL-BISINDO = Banten) | Satu referensi kosakata, disebut di laporan sebagai keterbatasan |
| API LLM gagal/berbayar | Mode A selalu jadi fallback |
| Tangan + wajah membuat HP lambat | Wajah tiap 3–5 frame, resolusi adaptif, bisa dimatikan di Pengaturan |
| Emosi salah terbaca (pencahayaan, wajah tertutup tangan) | Kalibrasi wajah netral, emosi diringkas per kalimat, bukan per frame |
| Kuota Azure F0 habis / tanpa internet | Fallback otomatis ke Web Speech API |
| Fase 7 terlalu padat | F9 Belajar dijadikan opsional |

## 15. Pertanyaan terbuka

- Tanggal pengumpulan final dari dosen (jadwal fase mengasumsikan pertengahan Januari 2027).
- Penyedia LLM untuk Mode B (isi `LLM_BASE_URL` dan `LLM_MODEL`).
- Akun Azure untuk Speech tier F0 (pembuatan resource bisa meminta verifikasi; cek opsi akun pelajar).
- Referensi kosakata BISINDO yang dipakai (komunitas Tuli setempat / kamus daring) dan siapa yang memvalidasi.
