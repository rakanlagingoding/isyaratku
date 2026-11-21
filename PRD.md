# PRD — IsyaratKu: Penerjemah Bahasa Isyarat BISINDO ke Suara

> Dokumen acuan pengembangan untuk vibe coding dengan Claude Code.
> Proyek mata kuliah **Mesin Penerjemah**, Teknik Informatika UIR.
> Pemilik: Rakan Ibnu Arega (243510441). Versi 1.0, 19 November 2026.

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
4. Mengucapkan kalimat itu dengan **text-to-speech** secara realtime.
5. Arah balik: ucapan lawan bicara diubah menjadi **teks besar** di layar (speech-to-text).

Pengenalan isyarat berjalan **di perangkat** (browser). Server hanya dipakai untuk mode penerjemah LLM (opsional).

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
- **Pengembang/peneliti (Rakan):** merekam dataset, melatih model, mengevaluasi terjemahan.

## 4. Cakupan

### 4.1 Dalam cakupan MVP

- Abjad jari BISINDO A–Z (isyarat statis).
- 25 kata isyarat (isyarat dinamis), lihat 4.3.
- Penerjemah gloss → kalimat: **Mode A** rule-based (offline) dan **Mode B** LLM (online).
- TTS dan STT bahasa Indonesia via Web Speech API.
- Halaman perekam dataset dan ekspor JSON.
- PWA installable, berjalan di Chrome Android.

### 4.2 Di luar cakupan

- Ekspresi wajah sebagai unsur tata bahasa.
- Kosakata > 100 kata, SIBI, bahasa isyarat negara lain.
- Akun pengguna, login, database server.
- Aplikasi native (Android/iOS).

### 4.3 Kosakata MVP (25 gloss + kelas diam)

```
Sapaan : HALO, TERIMA-KASIH, MAAF, TOLONG, SAMA-SAMA
Orang  : SAYA, KAMU, DIA, NAMA
Kerja  : MAKAN, MINUM, PERGI, PULANG, MAU, TIDAK, SUDAH, BELUM
Tanya  : APA, SIAPA, MANA, KAPAN
Lain   : SAKIT, RUMAH, KAMPUS, BAIK
Khusus : _IDLE (tidak ada isyarat)
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
| Inferensi model | `@tensorflow/tfjs` (backend WebGL, fallback WASM/CPU) |
| Penyimpanan lokal | IndexedDB via `idb` |
| Suara | Web Speech API: `speechSynthesis`, `SpeechRecognition` / `webkitSpeechRecognition` |
| Mode B (LLM) | Serverless function di `api/translate.ts` (Vercel) |
| Pelatihan model | Python + TensorFlow/Keras di Google Colab, ekspor `tensorflowjs_converter` |
| Tes | Vitest + Testing Library |
| Lint/format | ESLint + Prettier |
| Hosting | Vercel (HTTPS wajib untuk kamera dan mikrofon) |

## 6. Arsitektur

```
ARAH 1: isyarat -> suara
Kamera depan -> MediaPipe HandLandmarker -> normalisasi (126 fitur/frame)
  -> Segmenter (buffer 30 frame) -> Classifier TF.js -> gloss stabil
  -> daftar gloss kalimat -> [akhir kalimat] -> Translator (Mode A | Mode B -> /api/translate)
  -> kalimat -> tampil di layar + TTS

ARAH 2: suara -> teks
Mikrofon -> SpeechRecognition (id-ID) -> teks besar + riwayat percakapan
```

Prinsip:

- Video **tidak pernah** dikirim ke server. Yang dikirim ke `/api/translate` hanya array gloss.
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
│  │  ├─ RecordPage.tsx
│  │  └─ SettingsPage.tsx
│  ├─ components/
│  │  ├─ CameraView.tsx      # <video> + canvas overlay titik tangan
│  │  ├─ GlossChips.tsx      # chip gloss terdeteksi, bisa dihapus
│  │  ├─ CaptionBar.tsx      # kalimat hasil terjemahan
│  │  ├─ StatusIndicator.tsx # tangan terdeteksi / mengenali / menerjemahkan / berbicara
│  │  ├─ MicButton.tsx
│  │  └─ BottomNav.tsx
│  ├─ lib/
│  │  ├─ camera.ts
│  │  ├─ landmarks.ts
│  │  ├─ features.ts
│  │  ├─ classifier.ts
│  │  ├─ segmenter.ts
│  │  ├─ translator/
│  │  │  ├─ index.ts         # pilih mode A/B + fallback
│  │  │  ├─ ruleBased.ts
│  │  │  └─ llm.ts
│  │  ├─ speech.ts
│  │  └─ storage.ts          # IndexedDB
│  ├─ store/
│  │  ├─ sessionStore.ts     # gloss, kalimat, status
│  │  └─ settingsStore.ts    # persist ke localStorage
│  ├─ data/
│  │  ├─ vocab.json
│  │  ├─ lexicon.json        # gloss -> kata Indonesia
│  │  └─ rules.json          # aturan urutan & pola kalimat
│  └─ types.ts
├─ api/
│  └─ translate.ts           # serverless Mode B
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

export type TranslationResult = {
  glosses: string[];
  sentence: string;
  mode: TranslatorMode;
  latencyMs: number;
  fallback: boolean;            // true jika Mode B gagal lalu pakai Mode A
};

export type Sample = {
  id: string;                   // uuid
  label: string;
  kind: RecognitionMode;
  frames: number[][];           // letters: 1 x 63, signs: 30 x 126
  recordedBy: string;           // inisial perekam
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
- `toLetterFeatures(frame)` menghasilkan 63 angka dari tangan dominan (pengaturan kidal/kanan).
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
   - `SIAPA` dan `KAPAN` di akhir urutan dipindah ke awal kalimat; `APA` dan `MANA` tetap di akhir ("Kamu di mana?").
   - Tempat setelah `PERGI`/`PULANG` diberi "ke".
   - Subjek default `saya` jika kalimat tanpa subjek diawali kata kerja/aspek/negasi/sifat.
   - Sapaan di awal yang diikuti kata lain diberi koma.
   - Detail lengkap: `src/data/rules.json`; perilaku acuan: `eval/reference_rules.py`.
3. Rapikan: huruf kapital awal, `?` untuk kalimat tanya, `.` untuk lainnya; register santai konsisten (`kamu`, bukan `Anda`).

Contoh yang wajib lolos tes:

| Gloss | Kalimat |
| --- | --- |
| `SAYA MAKAN SUDAH` | Saya sudah makan. |
| `KAMU PULANG KAPAN` | Kapan kamu pulang? |
| `SAYA SAKIT TIDAK` | Saya tidak sakit. |
| `NAMA KAMU SIAPA` | Siapa nama kamu? |
| `TOLONG SAYA` | Tolong saya. |
| `SAYA MAU PERGI KAMPUS` | Saya mau pergi ke kampus. |

**Mode B — LLM (`llm.ts` + `api/translate.ts`):**

- `POST /api/translate` body `{ "glosses": string[] }` → `{ "sentence": string }`. Validasi: maksimal 20 gloss, hanya label dari `vocab.json` atau gloss eja yang cocok dengan `^FS:[A-Z]{1,20}$`.
- Prompt few-shot (minimal 6 contoh dari tabel di atas), instruksi: "Ubah urutan gloss BISINDO menjadi satu kalimat bahasa Indonesia baku santai. Pakai 'kamu', bukan 'Anda'. Jangan menambah informasi yang tidak ada di gloss. Keluarkan kalimatnya saja."
- `temperature` rendah (0–0,2) untuk konsistensi.
- API key hanya di server (`LLM_API_KEY`), tidak pernah di bundle frontend.
- Timeout 4 detik; gagal/timeout → otomatis Mode A dengan `fallback: true`.

**`translator/index.ts`:** `translate(glosses, mode): Promise<TranslationResult>`.

- **Terima jika:** semua contoh tabel lolos di Mode A (unit test); Mode B mengembalikan kalimat dan fallback bekerja saat jaringan diputus.

### F6 — Text-to-speech dan speech-to-text (`speech.ts`)

- `speak(text, { rate, voiceURI })` memilih suara `id-ID` (fallback suara default) dan membatalkan ucapan sebelumnya.
- `startListening(onPartial, onFinal)` / `stopListening()` dengan `lang = 'id-ID'`, `interimResults = true`.
- Deteksi dukungan: jika `SpeechRecognition` tidak ada, tombol mikrofon nonaktif dengan penjelasan.
- **Terima jika:** kalimat hasil terjemahan otomatis terucap; ucapan lawan bicara tampil sebagai teks ≤ 1 detik setelah selesai bicara (tergantung jaringan).

### F7 — Halaman Terjemah (layar utama)

- Kamera penuh layar dengan overlay; `StatusIndicator` di atas; `GlossChips` di atas `CaptionBar`.
- Tombol besar: **Mulai/Jeda**, **Ucapkan ulang**, **Hapus**; toggle **Kata / Abjad**.
- Tap chip gloss untuk menghapusnya sebelum kalimat dikirim.
- Getaran 50 ms (`navigator.vibrate`) saat gloss diterima.

### F8 — Halaman Percakapan

- Layar terbagi: atas kamera + teks hasil isyarat, bawah teks besar hasil STT.
- Tombol mikrofon tahan-untuk-bicara.
- Riwayat bubble (`ChatMessage[]`) tersimpan selama sesi; tombol **Hapus riwayat**.

### F9 — Halaman Belajar

- Daftar 25 gloss + abjad dengan deskripsi cara memperagakan (teks; slot video/GIF opsional di `public/learn/`).
- Mode latihan: pilih gloss, peragakan, tampilkan benar/salah dan confidence.

### F10 — Halaman Rekam Data

- Pilih jenis (abjad/kata) dan label, isi inisial perekam.
- Hitung mundur 3 detik, rekam 1 frame (abjad) atau 30 frame (kata), simpan `Sample` ke IndexedDB.
- Tabel jumlah sampel per label; tombol **Ekspor JSON** (unduh `dataset-<kind>-<tanggal>.json`) dan **Hapus semua** (dengan konfirmasi).
- **Terima jika:** file ekspor bisa langsung dibaca notebook di `training/`.

### F11 — Pengaturan

- Mode penerjemah (A/B), ambang confidence (0,5–0,95), tangan dominan, suara TTS, kecepatan bicara (0,7–1,3), mode gelap, debug (FPS + confidence).
- Disimpan di `localStorage` lewat Zustand `persist`.

### F12 — PWA dan offline

- Manifest (nama "IsyaratKu", tema gelap, orientasi potret, ikon 192/512).
- Service worker meng-cache aset app, file WASM MediaPipe, dan model TF.js agar Mode A berjalan offline setelah kunjungan pertama.

---

## 10. Kebutuhan non-fungsional

- **Performa:** ≥ 15 FPS; jika FPS < 12 selama 3 detik, turunkan resolusi ke 480×360 otomatis.
- **Privasi:** tidak ada video/gambar yang disimpan atau dikirim; dataset hanya berisi koordinat dan disimpan lokal sampai diekspor pengguna.
- **Aksesibilitas:** teks hasil ≥ 24 px, kontras ≥ 4.5:1, target sentuh ≥ 48 px, semua status penting juga tampil visual (pengguna Tuli tidak mendengar audio).
- **Kompatibilitas:** target utama Chrome Android terbaru; Safari iOS best effort (STT bisa tidak tersedia).
- **Keamanan:** API key hanya di environment server; validasi input di `/api/translate`; rate limit sederhana (mis. 30 request/menit per IP).
- **Kualitas kode:** TypeScript strict, tanpa `any` kecuali terpaksa dan diberi komentar; modul `lib/` punya unit test.

## 11. Pelatihan model dan evaluasi

### 11.1 Dataset

- Target 30–50 sampel per label dari ≥ 3 orang, variasi cahaya dan latar.
- Format ekspor = array `Sample` (bagian 8).

### 11.2 Model

| Model | Input | Arsitektur | Output |
| --- | --- | --- | --- |
| `letters` | 63 | Dense 128 → Dropout 0,3 → Dense 64 → Softmax | 26 |
| `signs` | 30 × 126 | GRU 64 (return seq) → GRU 64 → Dense 64 → Softmax | 26 (25 gloss + `_IDLE`) |

- Augmentasi: rotasi ±15°, skala ±10%, noise Gaussian kecil, mirror (pertukaran tangan kiri/kanan).
- Split 70/15/15, simpan confusion matrix dan classification report untuk laporan.
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
| 2 | 30 Nov–6 Des | F2 fitur, F10 rekam data + ekspor, F3 classifier (mode mock + model abjad) | Huruf terdeteksi realtime dengan model abjad |
| 3 | 7–13 Des | F6 TTS, mode eja di F4, F7 halaman Terjemah versi awal, F12 PWA | Eja nama lalu terucap; app bisa di-install |
| 4 | 14–20 Des | Rekam dataset 25 gloss, notebook `train_signs` | File dataset dan model `signs` terekspor |
| 5 | 21–27 Des | F4 segmenter penuh, integrasi model `signs` | Kalimat gloss terkumpul dan event akhir kalimat jalan |
| 6 | 28 Des–3 Jan | F5 Mode A + tes, Mode B + `api/translate`, korpus & `run_eval.ts` | Semua contoh F5 lolos; BLEU/chrF terhitung |
| 7 | 4–10 Jan | F8 Percakapan, F9 Belajar, F11 Pengaturan, optimasi performa | Percakapan dua arah berjalan ≥ 15 FPS |
| 8 | 11–17 Jan | Uji pengguna, perbaikan bug, video demo, laporan | Semua metrik bagian 2 tercatat |

## 13. Konfigurasi dan perintah

`.env.example`:

```
LLM_API_KEY=
LLM_MODEL=
LLM_BASE_URL=
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
| Dataset sedikit / satu orang | ≥ 3 perekam, augmentasi, kelas `_IDLE` |
| Isyarat mirip tertukar | Ambang confidence, chip gloss bisa dihapus |
| HP lambat | Resolusi adaptif, inferensi tiap 2 frame, backend WebGL |
| STT tidak didukung browser | Deteksi fitur, pesan jelas, fokus Chrome Android |
| Variasi BISINDO antardaerah | Satu referensi kosakata, disebut di laporan |
| API LLM gagal/berbayar | Mode A selalu jadi fallback |

## 15. Pertanyaan terbuka

- Tanggal pengumpulan final dari dosen (jadwal fase mengasumsikan pertengahan Januari 2027).
- Penyedia LLM untuk Mode B (isi `LLM_BASE_URL` dan `LLM_MODEL`).
- Referensi kosakata BISINDO yang dipakai (komunitas Tuli setempat / kamus daring) dan siapa yang memvalidasi.
