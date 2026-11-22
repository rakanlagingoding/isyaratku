# CLAUDE.md — IsyaratKu

Dibaca otomatis oleh Claude Code setiap sesi. Singkat dan wajib dipatuhi.

## Project dalam 4 kalimat

IsyaratKu adalah PWA mobile-first yang menerjemahkan isyarat tangan BISINDO menjadi suara bahasa Indonesia secara realtime, plus arah balik suara → teks.
Alurnya 4 tahap yang tampil di UI: **Tangan** (MediaPipe + TF.js → gloss) → **Ekspresi** (blendshapes wajah → emosi/kalimat tanya) → **Interpretasi** (gloss + emosi → kalimat) → **Suara** (TTS bernada emosi).
Tahap gloss → kalimat adalah inti mata kuliah **Mesin Penerjemah**: ada Mode A (rule-based, offline) dan Mode B (LLM, online) yang dibandingkan dengan BLEU, chrF, dan rubrik 3 dimensi.
Semua pengenalan isyarat dan wajah berjalan di browser; server hanya untuk Mode B (`api/translate.ts`) dan TTS Azure (`api/tts.ts`), keduanya punya fallback.

## Dokumen yang harus dibaca

| File | Isi | Kapan dibaca |
| --- | --- | --- |
| `PRD.md` | Fitur (F1–F13), kriteria terima, arsitektur, fase | Sebelum mengerjakan fitur apa pun |
| `docs/CONTEXT.md` | Rekap diskusi perencanaan: asal-usul ide, hal yang ditunda, yang bukan bagian project | Sesi pertama, dan saat ragu soal cakupan |
| `docs/PROGRESS.md` | Fase aktif, yang sudah selesai, bug | Awal setiap sesi |
| `docs/DECISIONS.md` | Keputusan teknis + alasannya | Sebelum mengubah pilihan teknis |
| `docs/REFERENCE-VIDEO.md` | Ringkasan video demo inspirasi (alur 4 tahap, yang ditiru dan tidak) | Dibaca saat Fase 3 dan Fase 7 |
| `src/data/*.json` | Kosakata, leksikon, aturan penerjemah, ambang emosi (`emotion.json`), nada suara (`prosody.json`) | Saat menyentuh classifier, translator, wajah, atau suara |
| `eval/gloss_pairs.json` | Korpus uji gloss → kalimat | Saat menulis tes/evaluasi translator |
| `eval/reference_rules.py` | Spesifikasi perilaku Mode A (Python). Output `ruleBased.ts` harus identik | Saat mengimplementasikan Mode A |
| `docs/examples/` | Contoh format `Sample` (hasil konversi dataset ke landmark) | Saat menyentuh training |

## Glosarium

- **BISINDO**: Bahasa Isyarat Indonesia, dipakai komunitas Tuli. Tata bahasanya berbeda dari bahasa Indonesia tulis.
- **Gloss**: label kata isyarat dalam huruf kapital, mis. `MAKAN`, `TERIMA-KASIH`. Urutan gloss mengikuti tata bahasa isyarat, bukan bahasa Indonesia: `SAYA MAKAN SUDAH` = "Saya sudah makan."
- **Isyarat statis**: satu pose (abjad jari A–Z), bisa satu atau dua tangan. Dikenali dari 1 frame, 126 fitur.
- **Isyarat dinamis**: gerakan (kata). Dikenali dari window 30 frame × 126 fitur.
- **`_IDLE`**: kelas "tidak ada isyarat". Dipakai untuk memisahkan gloss dan mendeteksi akhir kalimat.
- **Gloss eja (`FS:`)**: kata yang dieja dengan abjad jari ditulis `FS:RAKAN`. Translator menulisnya sebagai "Rakan".
- **Mode A**: penerjemah rule-based (`src/lib/translator/ruleBased.ts`) memakai `lexicon.json` + `rules.json`.
- **Mode B**: penerjemah LLM lewat `api/translate.ts`; fallback ke Mode A jika gagal.
- **Landmark**: 21 titik (x, y, z) per tangan dari MediaPipe HandLandmarker.
- **Blendshapes**: 52 skor ekspresi wajah (0–1) dari MediaPipe FaceLandmarker, mis. `mouthSmileLeft`, `browInnerUp`. Dipetakan ke emosi lewat `emotion.json`, tanpa melatih model.
- **Emosi**: `netral | senang | sedih | marah | bertanya`. `bertanya` (alis naik) membuat kalimat diakhiri `?`.
- **Prosody**: pengaturan pitch/rate suara per emosi (`prosody.json`), dipakai di SSML Azure dan Web Speech.
- **4 tahap**: Tangan · Ekspresi · Interpretasi · Suara, ditampilkan di `StageBar` halaman Terjemah.

## Perintah

```
npm run dev       # vite --host, buka dari HP di jaringan yang sama (butuh HTTPS untuk kamera)
npm run build
npm test          # vitest
npm run lint
npm run eval      # evaluasi Mode A vs Mode B
```

Setelah mengubah kode, jalankan `npm test` dan `npm run build`. Jangan menyatakan selesai jika salah satunya gagal.

## Aturan kode

- TypeScript `strict`. Hindari `any`; jika terpaksa, beri komentar alasannya.
- Teks UI dalam **bahasa Indonesia**. Nama file, variabel, fungsi, komentar kode dalam **bahasa Inggris**.
- Modul di `src/lib/` murni TypeScript tanpa React, dan punya unit test di sebelahnya (`*.test.ts`).
- Komponen React kecil dan fungsional; state global di Zustand (`src/store/`).
- Label kosakata hanya dari `src/data/vocab.json`. Jangan menulis daftar gloss di tempat lain.
- Tensor TF.js selalu dibungkus `tf.tidy` atau di-`dispose`.
- Mobile-first: target sentuh ≥ 48 px, teks hasil ≥ 24 px, uji di lebar 360 px.

## Larangan

- **Jangan** mengirim atau menyimpan video/gambar kamera ke server mana pun. Yang boleh dikirim ke server hanya array gloss + label emosi (`/api/translate`) dan kalimat + label emosi (`/api/tts`).
- **Jangan** menaruh API key (LLM, Azure Speech) di kode frontend atau meng-commit `.env`.
- **Jangan** memakai layanan suara berbayar (mis. ElevenLabs). Suara: Azure tier gratis F0 + fallback Web Speech.
- **Jangan** menambah dependency baru tanpa menyebut alasannya dan meminta persetujuan.
- **Jangan** mengerjakan fitur atau fase di luar yang diminta. Satu fase per permintaan.
- **Jangan** mengubah `PRD.md` tanpa diminta; usulkan perubahan di chat.
- **Jangan** membuat menu/halaman Rekam di aplikasi. Data latih dari dataset publik (PRD 11.1), diolah di notebook `training/`.

## Cara kerja per sesi

1. Baca `docs/PROGRESS.md`, lalu bagian PRD untuk fase yang diminta.
2. Jelaskan rencana singkat (file yang akan dibuat/diubah) sebelum menulis kode.
3. Kerjakan, jalankan tes dan build.
4. Perbarui `docs/PROGRESS.md` (centang tugas, catat bug). Keputusan teknis baru → `docs/DECISIONS.md`.
5. Akhiri dengan cara menguji hasilnya di HP.

Jika model TF.js belum ada di `public/models/`, classifier memakai **mode mock** (PRD F3) agar UI tetap bisa dikembangkan.
