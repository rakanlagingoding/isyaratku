# Panduan Radja — Data, evaluasi, uji pengguna, laporan

Peran: kualitas model isyarat, penilaian penerjemah (inti mata kuliah **Mesin Penerjemah**), uji ke pengguna, dan
laporan akhir. Sebagian besar kerja di **Google Colab**, `eval/`, dan dokumen; hampir tidak menyentuh kode aplikasi.

Sebelum mulai: selesaikan [git-dasar.md](git-dasar.md) bagian A. Setiap tugas = satu branch + satu PR (bagian B).

---

## 1. Peta yang Anda sentuh

| Path | Isi |
| --- | --- |
| `training/train_signs.ipynb` | Notebook Colab model kata (GRU, 63 kata + `_IDLE`). |
| `training/train_letters.ipynb` | Notebook model abjad (sudah 93,5%; tidak prioritas). |
| `training/README.md` | Cara menjalankan notebook + atribusi dataset (wajib dikutip di laporan). |
| `public/models/signs/` | Hasil ekspor model kata yang dipakai aplikasi (`model.json` + `group1-shard1of1.bin`). |
| `eval/gloss_pairs.json` | Korpus uji gloss → kalimat (72 pasangan). |
| `eval/results.csv` | Hasil `npm run eval`: BLEU/chrF per kalimat (Mode A; kolom Mode B menyusul). |
| `src/data/vocab.json` | Daftar kata; urutan = urutan output model. **Jangan diubah urutannya.** |
| `docs/laporan/` | Folder laporan Anda (buat baru). |
| `PRD.md` bagian 2, 11, Fase 8 | Metrik target, protokol training/evaluasi, uji pengguna. |

## 2. Tugas (kerjakan berurutan)

### Tugas 1 — Perbaiki kata lemah model (prioritas tertinggi)

Branch: `radja/model-kata-v2`

Hasil model sekarang (uji 1.009 sampel, peraga yang tidak ikut dilatih): **akurasi 92,7%, macro-F1 0,896**.
Kata yang lemah (recall = berapa persen kata itu dikenali benar):

| Kata | Recall | Paling sering tertebak sebagai |
| --- | --- | --- |
| BERANGKAT | 0,00 | CARI (7 dari 10) |
| AIR | 0,50 | MALAM (4 dari 10) |
| HIJAU | 0,50 | HITAM (4 dari 10) |
| BAGAIMANA | 0,58 | APA (5 dari 19) |

Langkah:
1. **Lihat videonya dulu.** Unduh beberapa video BERANGKAT dan CARI dari https://www.kaggle.com/datasets/glennleonali/wl-bisindo
   (tab Data; nomor folder → kata ada di `src/data/vocab.json` → `datasetLabels` → `wl-bisindo`). Pastikan labelnya
   benar dan catat bedanya gerakan. Kalau ternyata label tertukar, itu temuan penting: laporkan ke Rakan.
2. **Jalankan notebook** di Colab (File → Upload notebook → `training/train_signs.ipynb`, lalu Runtime → Run all;
   detail di `training/README.md`). Mendeley butuh `mendeley.zip` di Google Drive (`MyDrive/mendeley.zip`).
3. **Coba perbaikan**, satu per satu, catat hasilnya:
   - Bobot kelas: notebook sudah memakai `class_weight="balanced"` (bagian 8). Coba kalikan bobot kelas lemah (mis. ×2).
   - Augmentasi (bagian 7): tambah variasi untuk kelas lemah.
   - Arsitektur (bagian 8): jumlah unit GRU / dropout.
4. **Jangan ubah** tanpa diskusi: `TARGET_FPS = 15`, `WINDOW = 30`, fungsi fitur `to_features`/`normalize_hand`,
   urutan label, dan cara ekspor di bagian 10 (aplikasi bergantung pada semuanya).
5. Catat untuk tiap percobaan: akurasi, macro-F1, recall 4 kata di atas (dari `signs-report.zip` →
   `signs_classification_report.txt`). Simpan tabel perbandingan di `docs/laporan/eksperimen-model.md`.
6. Kalau ada versi yang **lebih baik** (macro-F1 naik dan tidak ada kata baru yang jatuh di bawah 0,5):
   - ekstrak `signs-model.zip` ke `public/models/signs/` (timpa 2 file lama);
   - simpan notebook dari Colab (File → Download → `.ipynb`) ke `training/train_signs.ipynb`;
   - `npm test` — tes `tfModel.test.ts` dan `nativeModel.test.ts` memuat model baru dan memastikan formatnya benar;
   - commit + PR dengan tabel sebelum/sesudah di deskripsi.
7. Sesudah merge, uji di HP: mode **Kata** + Mode debug (Pengaturan) menampilkan 3 tebakan teratas.

### Tugas 2 — Panduan peragaan 63 kata

Branch: `radja/panduan-peragaan` · File: `docs/laporan/panduan-peragaan.md`
- Tabel: gloss · arti · cara memperagakan (bentuk tangan, gerakan, posisi, satu/dua tangan) · sumber (WL-BISINDO / Mendeley).
- Kata WL-BISINDO: dari video Kaggle. Kata Mendeley (tanpa video): dari sumber BISINDO lain, tulis sumbernya dan beri tanda
  "perlu dicek" karena variasi daerah.
- Dipakai Gilang untuk halaman Belajar dan untuk demo/uji pengguna.

### Tugas 3 — Rubrik 3 dimensi penerjemah (Mesin Penerjemah)

Branch: `radja/rubrik` · File: `eval/rubric.md` (nama sesuai PRD) + `eval/rubrik_mode_a.csv`
- Acuan: PRD bagian 11 — skala **1–5** untuk **morfosintaksis** (tata bahasa, imbuhan, urutan kata), **semantik**
  (makna sama dengan referensi), **pragmatik** (wajar dipakai dalam percakapan), mengacu paper *Beyond BLEU*
  (Shalawati, Nasution, dkk., MDPI Digital 2026).
- `eval/rubric.md`: definisi tiap skor 1–5 per dimensi, dengan contoh kalimat dari korpus.
- Jalankan `npm run eval` → `eval/results.csv` (kolom `difficulty` = `mudah` 61 / `sulit` 11, `reference`, `mode_a`).
- Nilai tiap kalimat Mode A di `eval/rubrik_mode_a.csv` (kolom: `id`, `morfosintaksis`, `semantik`, `pragmatik`, `catatan`).
  LLM boleh jadi penilai awal, tetapi **minimal 30% sampel dinilai ulang manusia** (PRD); idealnya 2 penilai lalu dirata-rata.
- Rekap per subset dan contoh kesalahan khas Mode A (mis. kata depan, urutan aspek) untuk laporan.
- Mode B menyusul setelah Rakan menyelesaikan `api/translate.ts`; rubrik yang sama dipakai untuk membandingkan.

### Tugas 4 — Uji pengguna + SUS

Branch: `radja/uji-pengguna` · Acuan: PRD Fase 8 dan bagian 2.
- 3–5 orang. Skenario tetap (mis. eja nama sendiri; peragakan "SAYA MAKAN SUDAH"). Ekspresi wajah sedang ditunda ("segera hadir"), jadi tidak diuji.
- Catat per skenario: berhasil/tidak, waktu, kata salah. Isi kuesioner **SUS** (10 pertanyaan standar, skor 0–100).
- **Privasi**: jangan merekam/menyimpan video wajah peserta; catat hasil saja, tanpa nama lengkap.
- Hasil: `docs/laporan/uji-pengguna.md` (tabel + skor SUS rata-rata + temuan utama).

### Tugas 5 — Laporan dan slide

Branch: `radja/laporan` · Folder: `docs/laporan/`
- Kerangka: latar belakang (BISINDO, Tuli), tujuan, arsitektur 4 tahap (Tangan → Ekspresi → Interpretasi → Suara),
  dataset + **atribusi** (salin dari `training/README.md`), metode (fitur 126, GRU, Mode A rule-based vs Mode B LLM),
  hasil (akurasi model, BLEU/chrF, rubrik, SUS), keterbatasan, kesimpulan.
- Angka terbaru ada di `docs/PROGRESS.md` (bagian Hasil metrik) dan `docs/DECISIONS.md`.
- Laporan Word/PDF final boleh dibuat di luar repo; versi Markdown/kerangka tetap di `docs/laporan/` agar tim bisa review.

## 3. Hal penting

- **Jangan commit dataset** (video, `.npy`, zip besar) — sudah di `.gitignore`. Yang di-commit hanya model hasil
  ekspor (±280 KB) dan notebook.
- Sebelum commit notebook, hapus output yang besar (Colab: Edit → Clear all outputs) agar file tidak membengkak.
- Model baru wajib menghasilkan **64 output** dengan urutan `vocab.json`; tes akan gagal kalau tidak.
- Angka di laporan harus bisa ditelusuri: sebut file sumbernya (mis. `signs_classification_report.txt`, `eval/results.csv`).
