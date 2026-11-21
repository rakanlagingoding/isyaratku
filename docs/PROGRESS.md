# PROGRESS — IsyaratKu

Diperbarui setiap kali satu tugas atau fase selesai. Agent: centang tugas, isi tanggal, catat bug.

**Fase aktif:** Fase 1
**Terakhir diperbarui:** 2026-11-21

## Fase 1 — Fondasi (23–29 Nov 2026)

- [x] Setup Vite + React + TS + Tailwind + React Router + Zustand (2026-11-19)
- [x] ESLint + Prettier + Vitest berjalan (2026-11-19; 26 tes lolos)
- [x] Layout dasar + `BottomNav` (Terjemah, Percakapan, Belajar, Rekam, Pengaturan) (2026-11-19)
- [x] F1: `CameraView` kamera depan + overlay titik tangan MediaPipe (2026-11-19; kode selesai, belum diuji di HP)
- [ ] Deploy ke Vercel, uji di HP via HTTPS — perlu akun Vercel pemilik
- [ ] Verifikasi di HP: ≥ 15 FPS (aktifkan Mode debug), izin kamera ditolak → pesan + tombol "Coba lagi", label kiri/kanan sesuai tangan asli (DECISIONS #10)

## Fase 2 — Abjad jari (30 Nov–6 Des)

- [ ] F2: `features.ts` + unit test normalisasi
- [ ] F10: halaman Rekam Data + ekspor JSON
- [ ] F3: `classifier.ts` dengan mode mock
- [ ] Rekam dataset abjad A–Z, latih `letters` di Colab, ekspor ke `public/models/letters/`

## Fase 3 — Suara dan PWA (7–13 Des)

- [ ] F6: `speech.ts` (TTS)
- [ ] F4: mode eja (huruf → gloss `FS:`)
- [ ] F7: halaman Terjemah versi awal
- [ ] F12: PWA installable

## Fase 4 — Dataset kata (14–20 Des)

- [ ] Rekam 25 gloss + `_IDLE`, ≥ 30 sampel per label, ≥ 3 perekam
- [ ] Notebook `train_signs.ipynb` + augmentasi

## Fase 5 — Model kata (21–27 Des)

- [ ] Latih dan ekspor model `signs`
- [ ] F4: segmenter penuh (window 30 frame, akhir kalimat)

## Fase 6 — Mesin penerjemah (28 Des–3 Jan)

- [ ] F5 Mode A: `ruleBased.ts` lolos semua tes contoh PRD
- [ ] F5 Mode B: `api/translate.ts` + fallback
- [ ] `eval/run_eval.ts`: BLEU + chrF Mode A vs B

## Fase 7 — Percakapan dan penyempurnaan (4–10 Jan)

- [ ] F8 Percakapan, F9 Belajar, F11 Pengaturan
- [ ] Optimasi ≥ 15 FPS

## Fase 8 — Uji dan laporan (11–17 Jan)

- [ ] Uji pengguna 3–5 orang, kuesioner SUS
- [ ] Rekap metrik PRD bagian 2

## Hasil metrik

| Metrik | Target | Hasil | Tanggal |
| --- | --- | --- | --- |
| Akurasi abjad | ≥ 90% | – | – |
| Akurasi kata | ≥ 80% | – | – |
| BLEU / chrF Mode A | – | – | – |
| BLEU / chrF Mode B | > Mode A | – | – |
| FPS di HP | ≥ 15 | – | – |
| Latensi isyarat → suara | ≤ 2 dtk | – | – |
| SUS | ≥ 68 | – | – |

## Bug dan catatan

- 2026-11-20: laptop (Edge) 4 FPS, deteksi 226 ms dengan delegate GPU; iPhone 13 lancar. Penyebab: Edge memakai `Microsoft Basic Render Driver` (GPU software); Chrome di laptop yang sama memakai AMD Radeon (GPU 9 ms). Perbaikan: kalibrasi GPU vs CPU (#12) → Edge 11 FPS via CPU; deteksi dipindah ke Web Worker (#13) + penghalusan titik (#14). Menunggu uji ulang di laptop dan HP.
- Uji Chrome headless: kolom resolusi debug menampilkan `2×2` dengan kamera palsu; di perangkat nyata sebelumnya `640×480`. Cek ulang saat uji di HP.

- Fase 1: file di luar struktur PRD: `src/lib/fps.ts` (pengukur FPS), `src/components/PlaceholderPage.tsx` (halaman sementara), `src/test/setup.ts`.
- Fase 1: halaman Pengaturan baru berisi toggle Mode debug; pengaturan F11 lainnya di Fase 7.
- Fase 1: MediaPipe WASM + model kini di-host sendiri (DECISIONS #15); tetap butuh koneksi ke server app sampai F12 (Fase 3).
- 2026-11-20: loading dipercepat (DECISIONS #15). Headless Chrome: deteksi pertama dingin 10,5 dtk (kompilasi shader GPU), hangat 1,5 dtk. Menunggu uji di laptop/HP; lihat baris `deteksi pertama` di overlay debug.
- Abjad dua tangan diputuskan (DECISIONS #16); perubahan PRD menunggu persetujuan sebelum Fase 2.
- 2026-11-21: dokumen dirapikan — `CONTEXT.md` dipindah ke `docs/`, `CLAUDE.md` dan `docs/PROMPTS.md` disamakan dengan versi terbaru (merujuk `docs/CONTEXT.md`). Saat ini 48 tes lolos, build OK.
