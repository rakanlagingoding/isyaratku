# Training — model isyarat IsyaratKu

Model dilatih dari **dataset publik** (PRD §11.1, DECISIONS #21); aplikasi tidak punya fitur rekam data.
Notebook dijalankan di **Google Colab** (gratis, tanpa instalasi). Hasilnya model TF.js yang disalin ke `public/models/`.

| Notebook | Model | Data | Output ke |
| --- | --- | --- | --- |
| `train_letters.ipynb` | abjad (MLP), 1 × 126 | Kaggle abjad BISINDO (+ Roboflow opsional) | `public/models/letters/` |
| `train_signs.ipynb` | kata (GRU), 30 × 126 — Fase 4 | WL-BISINDO | `public/models/signs/` |

## Alur abjad

1. Buka `train_letters.ipynb` di Colab (File → Upload notebook), lalu **Runtime → Run all**.
2. Saat diminta, unggah `src/data/vocab.json`.
3. Dataset Kaggle diunduh otomatis lewat `kagglehub`. Jika gagal, unduh zip dari
   [halaman Kaggle](https://www.kaggle.com/datasets/meisyavira/abjad-bahasa-isyarat-indonesia-bisindo) (perlu akun Kaggle),
   lalu unggah saat diminta.
4. Notebook mencatat persentase foto yang terdeteksi MediaPipe, melatih model, lalu mengunduh
   `letters-model.zip` (model) dan `letters-report.zip` (akurasi, confusion matrix, kurva latih).
5. Ekstrak `letters-model.zip` ke `public/models/letters/` sehingga ada `public/models/letters/model.json`.
   Muat ulang aplikasi: label **"Model belum dimuat"** di halaman Terjemah hilang.

**Roboflow (opsional):** set `USE_ROBOFLOW = True`, unggah zip *BISINDO Dataset* v3 format **YOLOv8**
(DECISIONS #17). Hanya ditambahkan ke data latih.

## Aturan yang wajib sama dengan aplikasi

- Urutan label = urutan di `src/data/vocab.json`. Jangan diubah tanpa melatih ulang.
- Fitur = `src/lib/features.ts`: 126 angka (kiri lalu kanan), dikurangi pergelangan, dibagi jarak titik 0–9,
  x dan z dikali rasio lebar/tinggi gambar (DECISIONS #19). Fungsi `normalize_hand` di notebook adalah salinannya.
- Kiri/kanan memakai label MediaPipe apa adanya pada gambar yang tidak dicerminkan (DECISIONS #10).

## Atribusi (cantumkan di laporan)

- Meisya Vira, *Abjad Bahasa Isyarat Indonesia (BISINDO)*, Kaggle — ODbL (memuat dataset Achmad Noer, *Alfabet BISINDO*).
- BISINDO, *BISINDO Dataset* v3, Roboflow Universe, 2022 — CC BY 4.0 (jika dipakai).
- G. O. Kindy, G. Leonali, H. Lucky, "Word-Level BISINDO: A Novel Video Indonesian Sign Language Dataset and Baseline
  Methods", *Procedia Computer Science* 269 (2025) 249–258, doi:10.1016/j.procs.2025.08.277 — CC BY-NC 4.0.
