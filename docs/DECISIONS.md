# DECISIONS — IsyaratKu

Catatan keputusan teknis. Format: tanggal, keputusan, alasan, alternatif yang ditolak.
Keputusan baru ditambahkan di bawah; yang lama tidak dihapus, cukup ditandai "diganti oleh #N".

---

### #1 — 2026-11-19 — BISINDO, bukan SIBI
**Alasan:** dipakai sehari-hari oleh komunitas Tuli; tata bahasanya berbeda dari bahasa Indonesia, sehingga tahap gloss → kalimat menjadi masalah penerjemahan sungguhan.
**Ditolak:** SIBI (mengikuti tata bahasa Indonesia, tahap penerjemahan nyaris tidak ada).

### #2 — 2026-11-19 — Inferensi isyarat di browser
**Alasan:** privasi (video tidak keluar dari HP), latensi rendah, tanpa biaya server.
**Ditolak:** inferensi di server (butuh upload video, mahal, lambat di jaringan seluler).

### #3 — 2026-11-19 — Fitur = koordinat landmark, bukan piksel
**Alasan:** model kecil dan cepat, dataset ringan (JSON), tidak bergantung warna kulit/latar.
**Ditolak:** CNN dari gambar/video (butuh data jauh lebih banyak dan GPU).

### #4 — 2026-11-19 — Dua mode penerjemah (A rule-based, B LLM)
**Alasan:** Mode A memenuhi dasar teori MT dan berjalan offline; Mode B untuk kualitas; keduanya dibandingkan di laporan.

### #5 — 2026-11-19 — Format gloss eja: `FS:<HURUF>`
**Contoh:** `FS:RAKAN`. Translator mengubahnya menjadi "Rakan".
**Alasan:** membedakan kata hasil eja dari gloss kosakata, dan lolos validasi `/api/translate` dengan pola `^FS:[A-Z]{1,20}$`.

### #6 — 2026-11-19 — Register santai (`kamu`)
**Alasan:** percakapan sehari-hari; paper *Beyond BLEU* (MDPI Digital 2026) menunjukkan LLM tidak konsisten memakai kamu/Anda tanpa instruksi eksplisit.

### #7 — 2026-11-19 — Evaluasi tidak hanya BLEU
**Alasan:** satu urutan gloss bisa punya banyak kalimat benar. Dipakai BLEU, chrF, dan rubrik morfosintaksis/semantik/pragmatik (skala 1–5).

### #8 — 2026-11-19 — Tailwind CSS v4 lewat `@tailwindcss/vite`
**Alasan:** versi terbaru; tanpa `tailwind.config.js` dan PostCSS, cukup `@import 'tailwindcss'` di `src/index.css`.
**Ditolak:** Tailwind v3 (butuh config + PostCSS tambahan).

### #9 — 2026-11-19 — MediaPipe WASM dan model tangan dari CDN (sementara) — diganti oleh #15
WASM dari `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@<versi>/wasm`, model `hand_landmarker.task` (float16) dari `storage.googleapis.com/mediapipe-models`. Versi CDN dipatok sama dengan paket npm; unit test di `landmarks.test.ts` gagal jika berbeda.
**Alasan:** paling sederhana untuk Fase 1; WASM ~14 MB tidak perlu masuk repo.
**Ditinjau ulang di Fase 3 (F12):** cache lewat service worker atau self-host di `public/` agar offline.
**Ditolak:** menyalin WASM ke `public/` sekarang (menambah langkah build sebelum dibutuhkan).

### #10 — 2026-11-19 — Kiri/kanan = tangan asli pengguna; detektor menerima frame tidak dicerminkan
Frame kamera mentah (tidak dicerminkan) dikirim ke `HandLandmarker`. Dokumentasi `@mediapipe/tasks-vision` 1.2.3: label handedness = tangan subjek jika input tidak dicerminkan. Tampilan selfie dicerminkan hanya lewat CSS (`-scale-x-100`) pada `<video>` dan `<canvas>` sekaligus. `HandFrame.left` selalu tangan kiri asli pengguna, untuk perekam, training, dan inferensi.
**Cadangan:** opsi `swapHandedness` di `toHandFrame` jika uji di HP membuktikan label terbalik.
**Ditolak:** mencerminkan frame sebelum deteksi (label ikut terbalik, rawan bingung di dataset).

### #11 — 2026-11-19 — HTTPS dev lokal dengan `@vitejs/plugin-basic-ssl`
**Alasan:** kamera di HP butuh HTTPS saat membuka `vite --host` lewat IP LAN (disebut di PRD §13). Sertifikat self-signed, browser akan memberi peringatan sekali. `VITE_NO_SSL=1` untuk mematikan.

### #12 — 2026-11-20 — Delegate MediaPipe dipilih lewat pengukuran, bukan diasumsikan GPU
Saat start: buat landmarker GPU, ukur median `detectForVideo` (3 pemanasan + 8 ukur) di video asli. Jika GPU gagal atau > 30 ms, CPU juga diukur; yang lebih cepat dipakai, yang lain di-`close()`. Model diunduh sekali (`modelAssetBuffer`). Logika pilih di `src/lib/delegate.ts` (diuji).
**Bukti:** laptop pengembang (Edge, Windows) melaporkan delegate GPU berhasil tetapi deteksi 226 ms/frame → 4 FPS; iPhone 13 lancar. GPU lemah / WebGL software juga umum di Android murah.
**Biaya:** start lebih lama ~0,5–3 dtk di perangkat lambat.
**Ditolak:** GPU tetap dengan fallback hanya saat gagal dibuat (tidak menangkap GPU yang berhasil tapi lambat).

### #13 — 2026-11-20 — Deteksi tangan di Web Worker
`src/workers/handDetector.worker.ts` (module worker, `forVisionTasks(url, true)`) menjalankan HandLandmarker + kalibrasi delegate (#12). Main thread mengirim `ImageBitmap` frame terbaru, maksimal 1 frame dalam proses (tanpa antrean), lalu menggambar overlay tiap frame layar.
**Bukti:** di laptop (Edge, CPU 48–89 ms/deteksi) deteksi sinkron di main thread memblokir rAF, sehingga overlay hanya diperbarui ~11×/dtk dan penghalusan tidak bisa bekerja. Uji Chrome headless (kamera palsu): pipeline worker jalan di dev dan build produksi.
**Ditolak:** tetap di main thread (UI ikut tersendat di perangkat lambat).

### #14 — 2026-11-20 — Penghalusan titik: One Euro filter + tween tampilan
`src/lib/smoothing.ts`. One Euro (`minCutoff 0.5, beta 5, dCutoff 0.5`) di setiap hasil deteksi meredam getaran kamera murah; hasilnya juga yang dikirim ke `onFrame` (fitur/segmenter fase berikutnya). Tween (τ 45 ms) hanya untuk tampilan, agar gerak titik mulus walau deteksi 10–15 FPS.
**Parameter dipilih lewat simulasi:** di 15 FPS varians getaran turun ~70%, jeda gerak cepat ~0,02–0,03 lebar frame.
**Catatan:** jika model kata (Fase 5) terganggu oleh smoothing, `onFrame` bisa diberi data mentah.

### #15 — 2026-11-20 — Percepat loading: aset sendiri, start paralel, cache delegate, pemanasan GPU
- **Aset same-origin:** WASM (ES-module build) disalin dari `node_modules` ke `public/mediapipe/wasm/` oleh `scripts/copy-mediapipe.mjs` (`predev`/`prebuild`, di-gitignore, versi selalu cocok). Model `public/models/hand_landmarker.task` (float16, Apache-2.0) di-commit. Mengganti #9.
- **Start paralel:** worker dibuat saat komponen mount, jadi unduhan + pembuatan detektor berjalan bersamaan dengan pembukaan kamera.
- **Cache delegate** (`src/lib/delegateCache.ts`, `localStorage`): kunci = renderer WebGL + user agent; kunjungan berikutnya melewati benchmark. Kunci berubah jika driver/akselerasi/browser berubah → kalibrasi ulang.
- **Pemanasan:** satu deteksi pada `ImageData` kosong tepat setelah detektor dibuat, sebelum status "siap".
**Bukti (Chrome headless, AMD Radeon):** unduh CDN 68–114 dtk (curl) → same-origin 0,9 dtk. Run GPU pertama = kompilasi shader 8,9 dtk (dingin) / 0,6 dtk (shader cache Chrome). Deteksi pertama: dingin 10,5 dtk, hangat **1,5 dtk** (dari 1,6 tanpa cache delegate); kalibrasi 9,1 → 0,2 dtk.
**Sisa:** kunjungan pertama tetap ~10 dtk di GPU ini (biaya kompilasi WebGL). Opsi berikutnya bila perlu: mulai dengan CPU di worker kedua lalu pindah ke GPU setelah hangat.

### #16 — 2026-11-20 — Abjad jari mengikuti BISINDO: fitur dua tangan
Banyak abjad BISINDO diperagakan dengan dua tangan, sehingga 63 fitur satu tangan (PRD F2 `toLetterFeatures`, §11.2) tidak cukup. Diputuskan pemilik proyek: abjad memakai fitur yang sama dengan kata (126 = 2 tangan × 21 × 3, tangan tak terlihat = 0).
**Status:** disetujui pemilik 2026-11-21; diterapkan ke `src/types.ts`, `docs/examples/sample-letters.example.json`, dan kode. `toLetterFeatures` tidak dipakai. Perubahan teks PRD F2/§8/§11.2 dan glosarium CLAUDE.md perlu diterapkan ulang setelah kit v1.2.
**Perlu dicek:** apakah ada abjad BISINDO yang memakai gerakan (bukan pose statis); jika ada, model abjad 1 frame tidak cukup untuk huruf itu.

### #17 — 2026-11-21 — Dataset Roboflow BISINDO sebagai data tambahan abjad
> Diperbarui oleh #21: tidak ada rekaman sendiri; Roboflow menjadi tambahan opsional untuk dataset Kaggle, dan akurasi diukur pada split uji Kaggle.

Sumber: https://universe.roboflow.com/bisindo/bisindo-dataset (CC BY 4.0, "BISINDO", 2022). Object detection, 8.743 gambar, 22 huruf; **N, P, R, T tidak ada**, label `z` huruf kecil, kelas `BISINDO-Signs` bukan isyarat (dibuang). Bounding box tidak dipakai: gambar dijalankan ulang lewat MediaPipe Hands (Python, Colab) → landmark → format `Sample` dengan `recordedBy: "roboflow"`.
**Versi:** v3 (train 6.471 / valid 1.382 / test 1.373). Semua versi sudah grayscale + Isolate Objects + Stretch 244×244; tidak ada gambar mentah. v3 dipilih karena augmentasi 1×; augmentasi tetap di level landmark (PRD §11.2).
**Risiko:** stretch mengubah proporsi tangan; crop rapat bisa membuat palm detector gagal (catat persentase deteksi); latar dan peraga seragam → bias domain.
**Dependency:** `mediapipe` (Python) hanya di notebook, tidak masuk bundle web. Disetujui pemilik 2026-11-21. Atribusi wajib di laporan.

### #18 — 2026-11-21 — Deploy Vercel ditunda; demo lewat server lokal
Diputuskan pemilik: project disempurnakan dulu, deploy belakangan. Presentasi lewat `npm run dev` (HTTPS self-signed), dibuka di HP pada Wi-Fi yang sama (`https://<IP-laptop>:5173`) atau di laptop (`https://localhost:5173`). Target pemakaian tetap HP (laptop hanya server).
**Dampak:** PRD §5 (hosting Vercel) dan kriteria Fase 1 "via HTTPS Vercel" belum dipenuhi.
**Perlu diputuskan di Fase 6–7:** `api/translate.ts` dan `api/tts.ts` adalah serverless function Vercel dan **tidak dijalankan** oleh `vite dev`. Opsi: `vercel dev` (butuh Vercel CLI + login) atau middleware dev di Vite yang memanggil handler yang sama. Mode A dan Web Speech tetap jalan offline.

### #19 — 2026-11-21 — Fitur memakai satuan yang sama di sumbu x, y, z (koreksi rasio aspek)
Landmark MediaPipe: x = pecahan lebar gambar, y = pecahan tinggi, z ≈ skala x. Pada video 640×480 (laptop) dan 480×640 (HP potret), pose yang sama memberi fitur berbeda jika x dan y dipakai mentah. `toFeatures(frame, aspect)` mengalikan x dan z dengan `aspect = lebar / tinggi` sebelum normalisasi PRD F2. `CameraView` mengirim `aspect` lewat `onFrame(frame, aspect)`.
**Dampak:** format `Sample` dan ukuran fitur tidak berubah. Notebook memakai salinan Python (`normalize_hand`); kesamaan TS–Python dicek 2026-11-21 (selisih ≤ pembulatan 3 desimal).

### #20 — 2026-11-21 — TF.js dimuat lazy
`@tensorflow/tfjs` hanya diimpor (dynamic `import()`) oleh `src/lib/tfModel.ts` saat `model.json` benar-benar ada, sehingga mode mock tidak mengunduh ±220 kB gzip TF.js. Keberadaan model dicek dari isi JSON (`modelTopology`), bukan status HTTP, karena dev server dan rewrite Vercel menjawab file hilang dengan `index.html` (200).
> Bagian awal keputusan ini (IndexedDB lewat `idb` untuk menu Rekam) dibatalkan oleh #21; `idb` dan `fake-indexeddb` sudah di-uninstall.

### #21 — 2026-11-21 — Tanpa fitur rekam; model dilatih dari dataset publik
Diputuskan pemilik: aplikasi **tidak** punya fitur rekam data. Halaman Rekam, `storage.ts`, `recorder.ts`, `SampleCounts.tsx`, dan menu Rekam dihapus; `idb` dan `fake-indexeddb` di-uninstall.
**Abjad:** data utama Kaggle "Abjad Bahasa Isyarat Indonesia (BISINDO)" — Meisya Vira, 26 huruf × 25 foto, ODbL, sudah memuat dataset Achmad Noer (jangan ditambahkan lagi: duplikat bisa bocor ke data uji). Roboflow (#17) opsional, hanya data latih. Split 70/15/15 stratified.
**Kata:** WL-BISINDO (#22).
**Konsekuensi:** peraga sedikit dan dari dataset yang sama → akurasi uji cenderung optimistis untuk pengguna baru; dicatat sebagai keterbatasan di laporan. Tipe `Sample` dan `docs/examples/` tetap dipakai sebagai format hasil konversi di notebook (`recordedBy` = nama sumber).
**Hubungan dengan #28:** skrip `training/record_dataset.py` dari kit v1.2 **ditunda**; dipakai hanya jika nanti diputuskan merekam kata yang tidak ada di dataset publik.

### #22 — 2026-11-21 — Kosakata kamera = 32 gloss WL-BISINDO; gloss lama jadi `textOnly`
Tidak ada dataset publik untuk 16 dari 25 gloss lama. `vocab.signs` = 32 gloss WL-BISINDO (Kindy, Leonali & Lucky, Procedia CS 269, 2025; CC BY-NC 4.0; variasi Banten) dengan urutan label dataset (0–31) + `_IDLE`; "Di mana" → `MANA`, "Terima kasih" → `TERIMA-KASIH`. Gloss lama yang tidak ada di dataset dipindah ke `vocab.textOnly`: tetap ada di `lexicon.json`, korpus evaluasi, dan validasi `/api/translate`, tetapi tidak dikenali kamera (bisa dieja `FS:`).
**Alasan:** aturan Mode A (aspek, negasi, subjek default, R9 wajah) dan korpus terverifikasi tetap utuh, sementara kosakata kamera mengikuti data yang benar-benar ada.
**Perubahan data:** lexicon +23 entri (kategori baru `time`, `adv`; "Tuli" kapital); rules v2: R4 + `MENGAPA`, `BAGAIMANA`, R5 + `BERANGKAT`, `DATANG`; `reference_rules.py` membaca daftar R4/R5 dari `rules.json`; mustPass +3, korpus +19 pasangan (p041–p059). Acuan: mustPass 11/11, wajah 3/3, mudah 50/50, sulit 2/9.
**Fase 4 (catatan):** video (±30 fps) harus di-*resample* ke laju deteksi aplikasi (±10–15 fps di HP) sebelum dipotong 30 frame. `_IDLE` dari awal/akhir video + frame tanpa tangan. Pakai protokol signer-independent WL-BISINDO. Nama folder/label di Kaggle dicek saat konversi.
**Keterbatasan:** tanpa `KAMU`, `SUDAH`, `TIDAK`, `MAU` di kamera, aturan aspek/negasi hanya bisa didemokan lewat teks/eval atau ejaan.

### #23 — 2026-11-21 — Ekspor TF.js ditulis sendiri, tanpa paket `tensorflowjs`
Di Colab (Python 3.13, NumPy 2) `import tensorflowjs` gagal: `np.object` (dihapus di NumPy 1.24), lalu `distutils` (dihapus di Python 3.12) lewat `tensorflow_hub`. Notebook menulis format *layers-model* sendiri lewat `save_tfjs_layers_model()`: `modelTopology` = `model.to_json()` dari tf_keras (Keras 2), bobot float32 little-endian dalam satu `group1-shard1of1.bin`, nama bobot `<layer>/<kernel|bias>`.
**Verifikasi:** notebook membandingkan forward pass NumPy dari file ekspor dengan `model.predict` (selisih < 1e-4); `src/lib/tfModel.test.ts` memuat `model.json` bergaya tf_keras dan mencocokkan output dengan hitungan manual. Model abjad asli (2026-11-21) termuat di TF.js.
**Batas:** cukup untuk Dense/Dropout. Untuk GRU (`signs`) cek ulang nama bobot (`gru/kernel`, `gru/recurrent_kernel`, `gru/bias`) dan `reset_after`.

---

Entri #24–#28 berasal dari kit PRD v1.1–v1.2 (semula bernomor #8–#12 di kit; dinomori ulang 2026-11-22 agar tidak bentrok dengan #8–#23 yang sudah dirujuk kode).

### #24 — 2026-11-21 — Tambah deteksi ekspresi wajah (wajib, Fase 7)
**Inspirasi:** demo TikTok "AI sign language to voice" (bcho): Hand Tracking → Emotion Detection → LLM Interpretation → Voice Output. Lihat `docs/REFERENCE-VIDEO.md`.
**Alasan:** di BISINDO ekspresi wajah ikut menentukan makna, terutama kalimat tanya. `KAMU MAKAN SUDAH` + alis naik = "Kamu sudah makan?".
**Cara:** MediaPipe FaceLandmarker blendshapes + aturan ambang (`emotion.json`), bukan model terlatih. Wajah diproses tiap 3 frame demi FPS.
**Ditolak:** melatih classifier emosi sendiri (butuh dataset wajah, tidak sebanding dengan waktu).

### #25 — 2026-11-21 — Suara: Azure Speech F0 (gratis) + fallback Web Speech
**Alasan:** pemilik ingin suara gratis tapi bagus. Azure F0 memberi 0,5 juta karakter neural per bulan, suara `id-ID-GadisNeural` / `id-ID-ArdiNeural`, dan SSML `prosody` untuk nada per emosi. Web Speech tetap jadi cadangan offline.
**Ditolak:** ElevenLabs (berbayar), Piper `id_ID-news_tts-medium` (hanya satu suara netral, butuh hosting sendiri).

### #26 — 2026-11-21 — Tampilan 4 tahap di halaman Terjemah
**Alasan:** membuat alur mesin penerjemah terlihat saat demo ke dosen. Kata tambahan hasil interpretasi diberi garis bawah.

### #27 — 2026-11-21 — Halaman Belajar (F9) jadi opsional
**Alasan:** memberi ruang waktu untuk F13 di Fase 7 tanpa memundurkan jadwal.

### #28 — 2026-11-21 — Menu Rekam dihapus dari aplikasi
**Keputusan pemilik:** aplikasi tidak memiliki menu/halaman Rekam Data. Menu tersisa: Terjemah, Percakapan, Belajar (opsional), Pengaturan.
**Pengganti (kit v1.2):** skrip `training/record_dataset.py` di laptop. **Status 2026-11-22: ditunda** — pemilik memilih dataset publik (#21, #22). Jika skrip dibuat nanti, normalisasinya wajib identik dengan `features.ts` (126 fitur, koreksi aspek #19).

### #29 — 2026-11-22 — Dataset kata kedua: Mendeley `yzhzkzbnmw` (40 kata, landmark)
Disetujui pemilik. Sumber: "Indonesian Sign Language (BISINDO) Dataset: Landmark Extraction for capturing Non-Manual Markers" — Ramadhana, Ho, Luman, Sutoyo (Binus), Mendeley Data v3, doi:10.17632/yzhzkzbnmw.3, **CC BY 4.0**. 40 kata × 60 sampel = 2.400 file `.npy`, kamera konsumen 30 FPS, latar acak.
**Kosakata:** `vocab.signs` = 32 WL-BISINDO + 31 kata Mendeley yang belum ada + `_IDLE` = 64 kelas. KAMU, DIA, HALO, MINUM, BAIK pindah dari `textOnly` ke kamera; `textOnly` tinggal 11 gloss. Pemetaan nama folder → gloss di `vocab.datasetLabels` ("Dimana" → `MANA`, "Apa Kabar" → `APA-KABAR`, "Selamat Pagi" → `SELAMAT-PAGI`, dst.). Lexicon +26 entri; mustPass +2; korpus p060–p072. Acuan: mustPass 13/13, wajah 3/3, mudah 61/61, sulit 2/11.
**Format (diperiksa dari `Apa_001.npy`, header `'<f8'`, shape (30, 447)):** 149 titik × (x, y, z) per frame. Titik 0–32 = pose MediaPipe (33), 33–106 = 74 titik wajah pilihan, **107–127 = tangan kiri subjek, 128–148 = tangan kanan subjek** (sisi x sama dengan bahu kiri/kanan pose 11/12). Tangan tidak terlihat = 0. Dinormalisasi global: pusat = tengah bahu, skala = lebar bahu (bahu di x = ±0,5).
**Konversi ke fitur kita (Fase 4):** ambil blok tangan, lalu `normalize_hand(points, aspect)` per tangan — hasilnya setara `features.ts` karena normalisasi kita tidak terpengaruh geser/skala seragam. **`aspect` perlu ditaksir:** x dan y mereka tampak dalam satuan gambar mentah (hidung ±1 lebar bahu di atas bahu, panggul ±2,2 di bawah), konsisten dengan video landscape 16:9 → `aspect ≈ 16/9`; verifikasi di notebook (mis. panjang tulang tangan stabil saat tangan berputar).
**Catatan:** urutan kiri/kanan harus dicocokkan dengan aplikasi (#10 belum diverifikasi di HP; augmentasi mirror mengurangi dampaknya). Data sudah 30 frame per isyarat (*temporal standardization*), jadi kecepatan gerak perlu disamakan dengan window aplikasi (sama seperti #22). Titik wajah/pose (NMS) belum dipakai; bisa jadi bahan F13 nanti.
**Ditolak (sementara):** Kaggle `bisindo-40-kata-mp4` (daftar kata tidak tercantum), Talkee (hanya 7 kata), Mendeley `f33k9w86wr` (frame JPG, kelas tidak tercantum).

### #30 — 2026-11-23 — Fase 3: PWA lewat Cloudflare quick tunnel; akhir kalimat eja 2,5 detik
**Uji PWA di HP:** Chrome menolak service worker pada sertifikat self-signed, jadi jalur `https://<IP-laptop>:5173` tidak bisa
untuk install. Dipilih pemilik: **Cloudflare quick tunnel** (`cloudflared`, tanpa akun) — `npm run build`,
`npm run preview:tunnel` (`vite preview --mode tunnel`, HTTP di 4173, SSL dimatikan untuk mode `tunnel`), `npm run tunnel`.
Vite mengizinkan host `.trycloudflare.com`. Diverifikasi 2026-11-23: lewat URL tunnel `isSecureContext = true`, service
worker `activated`, manifest 3 ikon. **Risiko:** URL publik selama tunnel menyala; URL berganti tiap kali.
**Ditolak:** USB port forwarding (butuh kabel + USB debugging), deploy Vercel (#18 ditunda).
**Cache:** `vite-plugin-pwa` (disetujui pemilik) mem-precache app shell (±1,2 MB: JS, CSS, HTML, ikon); `/mediapipe/*`
(WASM ±15 MB) dan `/models/*` di-cache **CacheFirst saat pertama dipakai** (`isyaratku-models`), agar instalasi tidak
mengunduh ±23 MB. Akibat: setelah satu kali dibuka online, deteksi tangan + model abjad jalan offline.
**Ikon:** sementara, dibuat `scripts/make-icons.mjs` (Node bawaan, tanpa dependency); maskable menjaga isi di zona aman 80%.
**Segmenter mode eja:** huruf diterima bila label sama + confidence ≥ 0,8 selama 500 ms; huruf sama berulang butuh "lepas"
(tangan hilang atau label lain); jeda 1000 ms menutup kata → `FS:<HURUF>` (maks 20); **akhir kalimat = 2500 ms tanpa
tangan** setelah ada gloss. PRD F4 memakai 1000 ms untuk keduanya, yang bentrok di mode eja — **usulan perubahan PRD F4,
belum diterapkan**.
**Teks diucapkan (sementara):** `glossesToText` (`FS:RAKAN` → "Rakan", kapital awal, titik), diganti Mode A di Fase 6.
Kalimat diambil dari chip yang tersisa (`takeSentence`), jadi chip yang dihapus tidak ikut terucap.
