# PROGRESS — IsyaratKu

Diperbarui setiap kali satu tugas atau fase selesai. Agent: centang tugas, isi tanggal, catat bug.

**Fase aktif:** Fase 3 (kode selesai; menunggu uji eja + install di HP lewat tunnel)
**Terakhir diperbarui:** 2026-11-22 (kit PRD v1.2 digabung dengan hasil Fase 1–2; data kata = WL-BISINDO, DECISIONS #21–#22)

## Fase 1 — Fondasi (23–29 Nov 2026)

- [x] Setup Vite + React + TS + Tailwind + React Router + Zustand (2026-11-19)
- [x] ESLint + Prettier + Vitest berjalan (2026-11-19)
- [x] Layout dasar + `BottomNav` (Terjemah, Percakapan, Belajar, Pengaturan). **Tidak ada menu Rekam** (dihapus 2026-11-21, DECISIONS #21, #28)
- [x] F1: `CameraView` kamera depan + overlay titik tangan MediaPipe (2026-11-19; worker, One Euro, aset sendiri: DECISIONS #12–#15)
- [ ] ~~Deploy ke Vercel~~ — **ditunda** (DECISIONS #18); demo lewat `npm run dev` lokal
- [x] Uji di HP via HTTPS lokal (`https://192.168.1.6:5173`) (2026-11-21): kamera + titik tangan tampil; deteksi terasa lambat (lihat Bug)
- [ ] Verifikasi angka: ≥ 15 FPS, izin ditolak → pesan + "Coba lagi", label kiri/kanan (DECISIONS #10) — dibawa ke optimasi Fase 7

## Fase 2 — Abjad jari (30 Nov–6 Des)

- [x] F2: `features.ts` + unit test normalisasi (2026-11-21; 126 fitur dua tangan #16, koreksi rasio aspek #19)
- [x] ~~F10 menu Rekam~~ — dibuat lalu **dihapus** 2026-11-21 (DECISIONS #21); `record_dataset.py` dari kit **ditunda** (#28)
- [x] F3: `classifier.ts` dengan mode mock (2026-11-21; TF.js lazy #20; badge "Model belum dimuat" + prediksi huruf di Mode debug)
- [x] `training/train_letters.ipynb` + `training/README.md` (2026-11-21; dataset Kaggle Meisya Vira + Roboflow opsional; ekspor manual #23)
- [x] Latih `letters` di Colab, model di `public/models/letters/` (2026-11-21; akurasi uji 93,5%, 93 sampel; dimuat TF.js OK)
- [ ] Uji realtime di HP: huruf terdeteksi dengan model (Mode debug di halaman Terjemah)

## Fase 3 — Suara dan PWA (7–13 Des)

- [x] F6: `speech.ts` TTS versi Web Speech + `prosody.json` (2026-11-23; Azure menyusul di Fase 7)
- [x] F4: mode eja (huruf → gloss `FS:`) di `segmenter.ts` (2026-11-23; akhir kalimat 2,5 dtk, DECISIONS #30)
- [x] F7: halaman Terjemah versi awal — chip (ketuk = hapus), "58% — tahan lebih stabil", teks hasil, Mulai/Jeda, Ucapkan ulang, Hapus, toggle Abjad/Kata (Kata nonaktif) (2026-11-23; dicek di emulasi 360 px)
- [x] F12: PWA — manifest, ikon sementara, service worker (2026-11-23; lewat tunnel: SW `activated`)
- [ ] Uji di HP lewat tunnel: eja nama → chip → terucap; Instal aplikasi dari menu Chrome

## Fase 4 — Dataset kata (14–20 Des)

- [x] Cari dataset BISINDO kata tambahan (2026-11-22). Dipakai: Mendeley `yzhzkzbnmw` (Binus, CC BY 4.0, 40 kata × 60 sampel landmark). Tata letak 447 kolom dipastikan dari data (DECISIONS #29); vocab kamera jadi 63 gloss + `_IDLE`.
- [ ] Unduh WL-BISINDO (Kaggle, 2,16 GB), konversi video → landmark (resample ke laju deteksi aplikasi, `_IDLE` dari awal/akhir video; DECISIONS #22) — dikerjakan otomatis oleh `train_signs.ipynb`
- [ ] Unduh Mendeley `yzhzkzbnmw` (±258 MB), ambil blok tangan kolom 107–148, taksir `aspect` (±16/9), normalisasi ulang (DECISIONS #29) — dikerjakan otomatis oleh `train_signs.ipynb`
- [x] Notebook `train_signs.ipynb` + augmentasi + time-warp, uji signer-independent (2026-11-26; DECISIONS #31; bagian NumPy dites pada sampel Mendeley asli, belum dijalankan di Colab)
- [x] Jalankan `train_signs.ipynb` di Colab, salin model ke `public/models/signs/` (2026-11-27; GRU 30×126 → 64 kelas; uji 1009 sampel: **akurasi 92,7%, macro-F1 0,896**; `_IDLE` 1,00. Terlemah: BERANGKAT 0,00 (7/10 jadi CARI), AIR 0,50 (↔ MALAM), CARI 0,60, APA 0,62 (BAGAIMANA → APA 5/19), HIJAU 0,62 (↔ HITAM). Mendeley diunduh manual: API 403 → zip lewat Google Drive)

## Fase 5 — Model kata (21–27 Des)

- [ ] Latih dan ekspor model `signs` (cek nama bobot GRU, DECISIONS #23)
- [x] F4: segmenter mode kata `WordSegmenter` (window 30, prediksi tiap 2 frame, 3 prediksi stabil, ulang hanya setelah `_IDLE`, akhir kalimat 1000 ms) + 14 unit test; toggle Kata di Terjemah aktif hanya jika model `signs` termuat (2026-11-27)

## Fase 6 — Mesin penerjemah (28 Des–3 Jan)

- [x] F5 Mode A: `ruleBased.ts` lolos mustPass 13 + mustPassWithFace 3, dan identik dengan `reference_rules.py` di 72 pasangan korpus (2026-11-26; dipakai halaman Terjemah untuk kalimat dari chip)
- [ ] F5 Mode B: `api/translate.ts` + fallback (cara menjalankan API lokal, DECISIONS #18)
- [x] `npm run eval` (`eval/evaluate.ts` + `eval/run_eval.mjs`): BLEU + chrF Mode A per subset → `eval/results.csv` (2026-11-26; metrik = sacreBLEU 2.6.0, dicek silang); kolom Mode B menunggu Mode B

## Fase 7 — Ekspresi, suara, 4 tahap, percakapan (4–10 Jan)

- [x] F13: `emotion.ts` (`toEmotion` + `FaceTracker` ringkasan kalimat) + 10 unit test blendshapes sintetis; FaceLandmarker di worker tangan tiap 3 frame (tanpa `face.ts` terpisah, DECISIONS #36); tahap Ekspresi menampilkan emosi live (2026-11-27). Belum diuji di HP: FPS ≥ 15 tangan + wajah, deteksi ≤ 0,5 dtk. Kalibrasi wajah netral → F11
- [x] Emosi ke translator Mode A: R9 (alis naik → `?`) lewat `takeSentence(face)`; emosi kalimat → nada suara `speak` (2026-11-27)
- [ ] Emosi + isQuestion di prompt Mode B
- [ ] F6: `api/tts.ts` Azure SSML + fallback Web Speech
- [x] F7: `StageBar` 4 tahap + layout Terjemah (2026-11-26; tahap aktif: warna + ● + `aria-current`, ketuk = detail; Ekspresi belum aktif sampai F13; dicek 360 px)
- [ ] F7: `EmotionBadge`, `TranslationText` (garis bawah kata tambahan)
- [ ] F8 Percakapan, F11 Pengaturan (termasuk kalibrasi wajah netral)
- [ ] Optimasi ≥ 15 FPS dengan tangan + wajah aktif
- [ ] (Opsional) F9 Belajar

## Fase 8 — Uji dan laporan (11–17 Jan)

- [ ] Uji pengguna 3–5 orang, kuesioner SUS
- [ ] Rekap metrik PRD bagian 2

## Hasil metrik

| Metrik | Target | Hasil | Tanggal |
| --- | --- | --- | --- |
| Akurasi abjad | ≥ 90% | 93,5% (split uji Kaggle, 93 sampel, 3–4/huruf; peraga bisa sama dengan data latih) | 2026-11-21 |
| Akurasi kata | ≥ 80% | – | – |
| BLEU / chrF Mode A | – | semua 89,83 / 94,46 · mudah 100 / 100 · sulit 45,37 / 72,01 (72 pasangan) | 2026-11-26 |
| BLEU / chrF Mode B | > Mode A | – | – |
| FPS di HP | ≥ 15 | – | – |
| Latensi isyarat → suara | ≤ 2 dtk | – | – |
| Deteksi kalimat tanya dari wajah | ≥ 80% benar | – | – |
| SUS | ≥ 68 | – | – |

## Bug dan catatan

- 2026-11-27 (uji HP kedua): masih sangat lag + suara hanya keluar lewat "Ucapkan ulang". Penyebab: GRU di TF.js 621 ms/prediksi di main thread; iOS memblokir suara yang tidak dipicu ketukan. Diperbaiki (DECISIONS #38): runner TypeScript 4,2 ms; `unlockSpeech()` saat Mulai. Perlu uji ulang di HP.
- 2026-11-27 (uji HP pertama, mode kata): chip lambat + salah kata; garis tangan tertinggal. Diperbaiki (DECISIONS #37): window disampel 15 fps (sebelumnya 31 FPS = setengah isyarat), jeda antar gloss 600 ms, top-3 di Mode debug, penghalusan lebih ringan. Perlu uji ulang di HP, termasuk mode abjad.
- 2026-11-27 (model kata): BERANGKAT tidak pernah benar di uji (recall 0, 7 dari 10 diprediksi CARI). Di kamera, BERANGKAT kemungkinan besar muncul sebagai CARI. Opsi: cek video WL-BISINDO kedua kata, tambah data, atau gabungkan bobot kelas. Belum diuji di HP.
- 2026-11-26 (uji HP): halaman Terjemah terasa terlalu penuh setelah StageBar ditambah (StageBar + teks hasil + toggle + 3 tombol + menu bawah). Ditunda pemilik; rapikan saat Fase 7 (mis. gabung toggle/tombol, StageBar lebih ringkas).

- 2026-11-23 (Fase 3): dependency baru `vite-plugin-pwa` (dev); `cloudflared` 2026.11.1 dipasang lewat winget. 105 tes lolos. Belum diverifikasi di HP: suara `id-ID` di HP, install PWA, akurasi eja realtime.
- 2026-11-22: "Model deteksi tangan gagal dimuat" di HP — penyebab: membuka alamat lama `192.168.1.6` setelah laptop pindah Wi-Fi (IP baru `192.168.100.246`); aset worker tidak terunduh. Bukan bug kode.

- 2026-11-22: kit PRD v1.2 (`isyaratku-kit.zip`) diekstrak ke repo dan menimpa dokumen + data yang belum di-commit. Dipulihkan: DECISIONS #8–#23 (entri kit dinomori ulang #24–#28), PROGRESS, vocab/lexicon/rules/gloss_pairs WL-BISINDO (R9 wajah dari kit dipertahankan), `.gitignore`. **Commit sesudah perubahan besar** agar tidak terulang.
- 2026-11-21: model abjad dilatih di Colab (tf_keras 2.21, ekspor manual #23). Recall terendah: B dan Y (0,67), L/M/Q/U (0,75). Persentase foto terdeteksi MediaPipe belum dicatat.
- 2026-11-21 (uji HP, dev lokal): deteksi jari terasa lambat. Log: `HandLandmarker CPU delegate failed` saat kalibrasi (jatuh ke GPU), `Camera failed to open` sekali sebelum berhasil. Model HP dan angka FPS belum dicatat. Ditangani di Fase 7.
- Fitur dinormalisasi per tangan, jadi posisi antar-dua-tangan tidak terekam. Jika abjad dua tangan sering tertukar, pertimbangkan fitur posisi relatif (perlu keputusan + ubah PRD).
- 2026-11-20: laptop (Edge) 4 FPS dengan delegate GPU karena `Microsoft Basic Render Driver`; diperbaiki dengan kalibrasi GPU vs CPU (#12), worker (#13), penghalusan (#14).
