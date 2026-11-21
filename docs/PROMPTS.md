# PROMPTS — perintah siap pakai untuk Claude Code

Salin satu perintah per sesi. Tunggu agent selesai dan uji hasilnya sebelum lanjut.

---

## Sesi 0 — Cek pemahaman (wajib, sebelum coding)

```
Baca CLAUDE.md, docs/CONTEXT.md, PRD.md, docs/PROGRESS.md, docs/DECISIONS.md, dan file di src/data/.
Jelaskan ulang project ini dengan kata-katamu sendiri:
1) apa yang dibuat dan untuk siapa,
2) alur data dari kamera sampai suara,
3) kenapa tahap gloss -> kalimat adalah inti mata kuliah,
4) bagian PRD yang menurutmu ambigu atau bertentangan.
Jangan menulis kode apa pun.
```

## Fase 1 — Fondasi

```
Kerjakan Fase 1 di docs/PROGRESS.md sesuai PRD (setup project, layout + BottomNav, F1 kamera + overlay MediaPipe).
Sebelum menulis kode, tampilkan rencana file yang akan dibuat.
Setelah selesai: jalankan npm test dan npm run build, perbarui docs/PROGRESS.md,
lalu jelaskan cara deploy ke Vercel dan menguji kamera di HP.
```

## Fase 2 — Abjad jari

```
Kerjakan Fase 2: F2 features.ts dengan unit test normalisasi, F10 halaman Rekam Data + ekspor JSON
(format sama dengan docs/examples/sample-letters.example.json), dan F3 classifier.ts dengan mode mock.
Buat juga training/train_letters.ipynb yang membaca file ekspor dan mengekspor model ke public/models/letters/.
Label harus mengikuti urutan src/data/vocab.json.
```

## Fase 3 — Suara dan PWA

```
Kerjakan Fase 3: F6 speech.ts (TTS dulu), mode eja di segmenter (menghasilkan gloss FS:<HURUF>),
F7 halaman Terjemah versi awal, dan F12 PWA. Perbarui PROGRESS.md.
```

## Fase 4–5 — Model kata

```
Kerjakan Fase 4 dan 5: training/train_signs.ipynb (GRU, augmentasi sesuai PRD 11.2)
dan F4 segmenter penuh dengan unit test urutan prediksi sintetis.
```

## Fase 6 — Mesin penerjemah

```
Kerjakan Fase 6. Implementasikan Mode A di src/lib/translator/ruleBased.ts memakai src/data/lexicon.json dan rules.json.
Semua kasus "mustPass" di rules.json wajib lolos unit test.
Lalu Mode B (api/translate.ts + fallback ke Mode A), dan eval/run_eval.ts yang menghitung BLEU dan chrF
untuk Mode A dan Mode B pada eval/gloss_pairs.json, hasil ke eval/results.csv, dipisah per difficulty.
```

## Fase 7 — Percakapan dan penyempurnaan

```
Kerjakan Fase 7: F8 Percakapan (STT), F9 Belajar, F11 Pengaturan, lalu profil performa di HP
dan terapkan resolusi adaptif jika FPS < 12.
```

## Perintah bantu

- Debug: `Ada error berikut: <tempel error>. Cari penyebabnya dulu, jelaskan, baru perbaiki.`
- Review: `Review perubahan sejak commit terakhir terhadap CLAUDE.md dan PRD. Sebutkan pelanggaran aturan.`
- Akhir sesi: `Perbarui docs/PROGRESS.md dan tulis ringkasan apa yang berubah hari ini.`
