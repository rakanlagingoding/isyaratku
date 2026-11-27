# Tim IsyaratKu — cara kerja bersama dan jobdesk

Anggota: **Rakan**, **Radja**, **Gilang**. Repo: `rakanlagingoding/isyaratku` (private, GitHub).
Semua aturan di `CLAUDE.md` (bagian "Aturan kode" dan "Larangan") berlaku untuk **semua anggota**, bukan hanya untuk Claude.

Panduan langkah demi langkah: [panduan/git-dasar.md](panduan/git-dasar.md) (semua anggota),
[panduan/gilang.md](panduan/gilang.md), [panduan/radja.md](panduan/radja.md).

## 1. Persiapan (sekali per anggota)

1. Rakan mengundang Radja dan Gilang: GitHub → repo → **Settings → Collaborators → Add people** (pakai username GitHub
   masing-masing). Terima undangan dari email/notifikasi GitHub.
2. Pasang [Node.js](https://nodejs.org) versi 22 LTS atau lebih baru, dan Git.
3. Clone dan jalankan:
   ```
   git clone https://github.com/rakanlagingoding/isyaratku.git
   cd isyaratku
   npm install
   npm run dev
   ```
   Buka alamat `https://…` yang muncul. Kamera butuh HTTPS; abaikan peringatan sertifikat lokal.
4. Sebelum mengerjakan apa pun, baca: `CLAUDE.md`, `docs/PROGRESS.md`, dan bagian PRD untuk tugas Anda.

## 2. Alur Git (wajib, agar kerja tidak saling menimpa)

- **Jangan push langsung ke `main`.** `main` = versi yang selalu jalan.
- Satu tugas = satu branch dari `main` yang terbaru:
  ```
  git checkout main
  git pull
  git checkout -b gilang/emotion-badge      # format: nama/tugas-singkat
  ```
- Commit kecil dan sering. Sebelum push, wajib lolos:
  ```
  npm test
  npm run lint
  npm run build
  ```
- Push lalu buka **Pull Request** ke `main`: `git push -u origin gilang/emotion-badge`, lalu klik "Compare & pull request"
  di GitHub. Tulis singkat: apa yang diubah dan cara mengujinya di HP.
- **Rakan me-review dan merge.** Kalau ada komentar, perbaiki di branch yang sama lalu push lagi.
- Sebelum mulai kerja tiap hari: `git checkout main && git pull`, lalu `git merge main` di branch Anda agar tidak
  tertinggal.

## 3. Pembagian folder (mengurangi konflik)

| Anggota | Folder utama | Hindari mengubah tanpa bicara dulu |
| --- | --- | --- |
| Gilang | `src/components/`, `src/pages/`, `src/index.css` | `src/lib/`, `src/workers/`, `training/` |
| Radja | `training/`, `eval/`, `docs/laporan/` | `src/` (kecuali `src/data/*.json` setelah diskusi) |
| Rakan | `src/lib/`, `src/workers/`, `src/store/`, `api/`, `src/data/` | — (integrasi + review semua PR) |

Butuh fungsi baru di `src/lib/` atau data baru di store? Tulis di grup/issue, Rakan yang menambahkannya, lalu Anda
memakainya dari komponen.

## 4. Jobdesk

### Rakan — inti sistem, integrasi, review (memakai Claude Code)

Sudah selesai: fondasi kamera + deteksi tangan, model abjad dan kata, segmenter, Mode A + evaluasi BLEU/chrF,
ekspresi wajah, suara Web Speech, PWA (lihat `docs/PROGRESS.md`). Berikutnya:
1. F5 **Mode B** (`api/translate.ts`, LLM + fallback Mode A) dan perbandingan Mode A vs B di `npm run eval`.
2. F6 suara Azure (`api/tts.ts`) + fallback Web Speech.
3. Logika untuk halaman Gilang: state Pengaturan (`settingsStore` persist), STT untuk Percakapan, kalibrasi wajah.
4. Optimasi FPS, review dan merge semua PR, menjaga `docs/PROGRESS.md` dan `docs/DECISIONS.md`.

### Gilang — frontend (prioritas)

Acuan: PRD **F7, F8, F9, F11**. Teks UI bahasa Indonesia, target sentuh ≥ 48 px, teks hasil ≥ 24 px, uji di lebar 360 px.
Urutan kerja:
1. **Rapikan layout halaman Terjemah** (bug "terlalu penuh" di `docs/PROGRESS.md`): StageBar, teks hasil, toggle,
   3 tombol, dan menu bawah harus muat di HP tanpa berdesakan.
2. F7 **`EmotionBadge`**: label emosi di atas kamera (data sudah ada: `useSessionStore().emotion`).
3. F7 **`TranslationText`**: kalimat hasil; kata tambahan diberi garis bawah (minta Rakan menyediakan daftar kata
   tambahan dari translator).
4. F11 **halaman Pengaturan**: tampilan semua pilihan di PRD F11 (ambang confidence, suara, ekspresi on/off, dsb.);
   Rakan menyambungkan ke store.
5. F8 **halaman Percakapan**: layout terbagi, tombol mikrofon tahan-untuk-bicara, bubble riwayat, "Hapus riwayat".
6. (Opsional) F9 **halaman Belajar**: daftar gloss dari `src/data/vocab.json` + deskripsi cara memperagakan.
Setiap komponen baru diberi tes kecil (`*.test.tsx`, contoh: `src/components/ConfidenceHint.test.tsx`).

### Radja — data, evaluasi, uji pengguna, laporan

Acuan: PRD bagian 2 (metrik), 11 (training & evaluasi), dan Fase 8.
1. **Perbaiki kata lemah model** (`training/train_signs.ipynb`, Colab): BERANGKAT (selalu tertebak CARI), AIR, HIJAU,
   BAGAIMANA. Bandingkan video WL-BISINDO kata-kata itu, coba bobot kelas / augmentasi, latih ulang, catat akurasi dan
   macro-F1 sebelum vs sesudah. Kirim `signs-model.zip` ke Rakan lewat PR atau grup.
2. **Panduan peragaan**: tabel 63 kata kamera + cara memperagakan (dari video dataset), dipakai Gilang untuk halaman
   Belajar dan untuk demo.
3. **Rubrik 3 dimensi** untuk Mesin Penerjemah (`eval/rubric.md`): menilai hasil Mode A (dan Mode B saat siap) dari `eval/results.csv`.
4. **Uji pengguna** 3–5 orang + kuesioner SUS, dan rekap metrik PRD bagian 2.
5. **Laporan dan slide** (`docs/laporan/`): latar belakang, dataset + atribusi (`training/README.md`), metode,
   hasil BLEU/chrF + rubrik, hasil uji pengguna.

## 5. Komunikasi

- Satu tugas = satu issue di GitHub (tab **Issues**), assign ke diri sendiri saat mulai.
- Laporkan di grup saat PR dibuka. Rakan usahakan review ≤ 1 hari.
- Jangan commit `.env`, API key, video/foto wajah, atau dataset mentah (sudah di `.gitignore`).
