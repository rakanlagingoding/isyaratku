# CONTEXT — Rekap percakapan perencanaan IsyaratKu

> Ringkasan semua keputusan dari diskusi perencanaan (17–21 November 2026) antara pemilik project
> dan asisten AI, sebelum coding dimulai. Tujuannya agar agent di Claude Code memahami latar belakang
> tanpa salah tafsir. Jika ada pertentangan, urutan prioritas: **PRD.md > CLAUDE.md > dokumen ini**.

---

## 1. Siapa dan untuk apa

- **Pemilik:** Rakan Ibnu Arega (NIM 243510441), Teknik Informatika, Universitas Islam Riau (UIR).
- **Mata kuliah:** Mesin Penerjemah, kelas A. Dosen pengampu: Prof. Dr. Arbi Haza Nasution.
- **Jenis tugas:** project tugas akhir mata kuliah, dikerjakan dengan vibe coding (VS Code + Claude Code).
- **Platform target:** aplikasi web **mobile-first** (PWA), diutamakan dipakai lewat HP.

## 2. Ide project (asal-usul)

Ide awal dari pemilik: **menerjemahkan isyarat tangan untuk teman Tuli menjadi suara secara realtime**.

Hasil diskusi yang membentuk ide final:

1. Agar sesuai mata kuliah Mesin Penerjemah, project **tidak boleh berhenti di pengenalan gerakan**.
   Harus ada tahap penerjemahan: **urutan gloss isyarat → kalimat bahasa Indonesia yang wajar**.
   Contoh: `SAYA MAKAN SUDAH` → "Saya sudah makan."
2. Dipilih **BISINDO** (bukan SIBI), karena tata bahasanya berbeda dari bahasa Indonesia tulis,
   sehingga ada masalah penerjemahan yang nyata.
3. Ditambah **arah balik**: ucapan lawan bicara → teks besar di layar, supaya bisa dipakai untuk percakapan.
4. Nama kerja aplikasi: **IsyaratKu**.
   Judul project: *IsyaratKu: Penerjemah Bahasa Isyarat BISINDO ke Suara secara Realtime Berbasis Web Mobile*.

Alternatif ide yang sempat dibahas tetapi **tidak dipilih**: OCR kamera + terjemahan,
penerjemah Melayu Riau ↔ Indonesia, penerjemah Arab ↔ Indonesia. Jangan mengerjakan ini.

## 3. Arsitektur yang disepakati (ringkas)

```
Kamera HP -> MediaPipe HandLandmarker (21 titik/tangan) -> normalisasi 126 fitur
  -> segmenter (window 30 frame) -> classifier TF.js (MLP abjad / GRU kata) -> gloss
  -> penerjemah gloss->kalimat (Mode A rule-based | Mode B LLM) -> teks + TTS (Web Speech API)
Mikrofon -> SpeechRecognition id-ID -> teks besar
```

- Semua pengenalan isyarat **di browser HP**. Video tidak pernah dikirim ke server.
- Server hanya untuk Mode B (`api/translate.ts`), dan Mode A selalu jadi fallback.
- Detail lengkap: `PRD.md` (F1–F12) dan `docs/DECISIONS.md`.

## 4. Pengaruh paper "Beyond BLEU" terhadap project

Pemilik menganalisis paper berikut untuk tugas Pertemuan 6:
*Beyond BLEU: GPT-5, Human Judgment, and Classroom Validation for Multidimensional Machine Translation Evaluation*
(Shalawati, Nasution, dkk., MDPI *Digital* 6(1):8, 2026).

Temuan paper yang **diterapkan di project**:

| Temuan paper | Penerapan di IsyaratKu |
| --- | --- |
| BLEU lemah menggambarkan kualitas | Evaluasi pakai BLEU + chrF + rubrik 3 dimensi (morfosintaksis, semantik, pragmatik, skala 1–5) |
| GPT-5 sebagai penilai berkorelasi r = 0,82 dengan manusia, tapi skornya terlalu tinggi | LLM boleh jadi penilai awal; minimal 30% sampel divalidasi manusia; dipakai untuk membandingkan peringkat, bukan skor absolut |
| Prompt zero-shot tidak konsisten soal kamu/Anda | Prompt Mode B few-shot + instruksi register santai ("kamu") |
| Kesalahan khas: imbuhan me- hilang, register campur | Dijadikan poin pengecekan di evaluasi |
| Temperature 0,8 terlalu tinggi untuk terjemahan | Mode B memakai temperature 0–0,2 |

## 5. Status saat dokumen ini dibuat (21 Nov 2026)

- ✅ Rancangan + rencana kerja 8 minggu (23 Nov 2026 – 17 Jan 2027).
- ✅ `PRD.md`, `CLAUDE.md`, dan starter kit (`docs/`, `src/data/`, `eval/`) sudah dibuat.
- ✅ Aturan Mode A sudah diverifikasi dengan `eval/reference_rules.py`: mustPass 8/8, mudah 34/34, sulit 2/6.
- ⬜ **Belum ada kode aplikasi.** Repo baru berisi dokumen dan data awal.
- ⬜ Sesi 0 (cek pemahaman agent) belum dijalankan.
- ⬜ Fase berikutnya: **Fase 1** (lihat `docs/PROGRESS.md`).

> **Pembaruan 21 Nov 2026:** daftar di atas adalah kondisi saat perencanaan. Kode Fase 1 (setup, layout + BottomNav,
> F1 kamera + overlay MediaPipe) sudah ditulis; tinggal deploy Vercel dan verifikasi di HP.
> Status terkini selalu ada di `docs/PROGRESS.md`, bukan di dokumen ini.

## 6. Hal yang DITUNDA (jangan dikerjakan tanpa diminta)

- **LFM3-Omni via Ollama** (`ollama.com/library/lfm3-omni`), saran dari asisten dosen.
  Kesimpulan diskusi: hanya relevan untuk **Mode B** (gloss → kalimat), karena teks bahasa Indonesia didukung.
  Tidak cocok untuk pengenalan isyarat (video hanya 2 fps, tidak mengenal BISINDO) dan tidak cocok untuk suara
  (speech bahasa Indonesia tidak didukung). Pemilik memutuskan **menunda**; Mode B tetap memakai API LLM sesuai PRD.
  Jika nanti diaktifkan, kemungkinan bentuknya: Ollama di laptop + `LLM_BASE_URL` diarahkan ke sana,
  plus eksperimen pembanding antar-model untuk laporan.
- Validasi kosakata BISINDO dengan komunitas Tuli (dikerjakan manual oleh pemilik).

## 7. Yang BUKAN bagian project ini

Percakapan perencanaan juga membahas hal lain yang **tidak boleh** dicampur ke repo ini:

- Naskah video dan slide analisis paper (tugas terpisah, sudah selesai).
- Slide dan naskah atas nama mahasiswa lain (bukan project ini).
- Project mata kuliah lain (PBO, Pemrograman Web, dll.).

## 8. Pertanyaan terbuka (tanyakan ke pemilik jika dibutuhkan)

- Tenggat final pengumpulan dari dosen (jadwal mengasumsikan pertengahan Januari 2027).
- Penyedia LLM untuk Mode B (`LLM_BASE_URL`, `LLM_MODEL`).
- Referensi kosakata BISINDO dan siapa yang memvalidasi.
- Spesifikasi laptop dan HP yang dipakai untuk uji.
- Apakah project ini individu atau kelompok (sejauh ini diasumsikan **individu**).

## 9. Preferensi kerja pemilik

- Bahasa komunikasi: **bahasa Indonesia**.
- Pemilik ingin **berdiskusi dulu sebelum eksekusi** untuk keputusan besar. Untuk perubahan arsitektur,
  dependency baru, atau keluar dari PRD: jelaskan opsi, lalu tunggu persetujuan.
- Kerjakan **satu fase per permintaan**, jelaskan cara menguji di HP di akhir setiap fase.
