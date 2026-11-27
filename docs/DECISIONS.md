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
**Cache:** `vite-plugin-pwa` (disetujui pemilik) mem-precache app shell (±1,2 MB: JS, CSS, HTML, ikon). Aset besar di-cache
saat dipakai (`src/lib/pwaCache.ts`, dites): `/models/*` **NetworkFirst** (`isyaratku-models`, timeout 4 dtk) — model hasil
latih ulang bernama sama, jadi harus divalidasi ulang tiap buka (murah lewat ETag/304), cache jadi cadangan offline;
`/mediapipe/*` **CacheFirst** dalam cache bernama versi paket (`isyaratku-mediapipe-1.2.3`) agar upgrade tidak mencampur
WASM lama dengan JS baru. Keduanya hanya menyimpan respons 200 non-HTML (`keepOnlyRealFiles`): server menjawab file hilang
(mis. `models/signs/model.json`) dengan `index.html` 200, yang jika ter-cache akan mengunci mode mock. Pola dicocokkan ke
URL lengkap (perilaku Workbox). Diverifikasi lewat tunnel 2026-11-23. Akibat: setelah sekali dibuka online, deteksi tangan
+ model abjad jalan offline.
**Ikon:** sementara, dibuat `scripts/make-icons.mjs` (Node bawaan, tanpa dependency); maskable menjaga isi di zona aman 80%.
**Segmenter mode eja:** huruf diterima bila label sama + confidence ≥ 0,8 selama 500 ms; huruf sama berulang butuh "lepas"
yang stabil — tangan hilang ≥ 200 ms atau huruf lain yakin ≥ 200 ms (satu frame salah tebak / hilang tidak melepas);
**Jeda** membuang kata yang belum selesai, chip tetap ada dan ikut terucap setelah **Mulai** lagi (`Segmenter.resume`); jeda 1000 ms menutup kata → `FS:<HURUF>` (maks 20); **akhir kalimat = 2500 ms tanpa
tangan** setelah ada gloss. PRD F4 memakai 1000 ms untuk keduanya, yang bentrok di mode eja — **usulan perubahan PRD F4,
belum diterapkan**.
**Teks diucapkan (sementara):** `glossesToText` (`FS:RAKAN` → "Rakan", kapital awal, titik), diganti Mode A di Fase 6.
Kalimat diambil dari chip yang tersisa (`takeSentence`), jadi chip yang dihapus tidak ikut terucap.

### #31 — 2026-11-26 — Fase 4: notebook `train_signs.ipynb` (WL-BISINDO + Mendeley → GRU 64 kelas)
**Pengecekan dataset (2026-11-26):** tidak ada dataset kata BISINDO baru yang layak; tetap WL-BISINDO + Mendeley. Label WL
dari metadata repo (`signer{S}_label{L}_sample{N}.mp4`, 1.600 video, peraga 0–4) cocok 32/32 dengan `vocab.datasetLabels`.
Mendeley bisa diunduh sebagai satu zip tanpa login (`public-api/zip/yzhzkzbnmw/download/3`).
**Konversi:** video WL di-*resample* ke `TARGET_FPS = 15` (perkiraan laju deteksi HP) → HandLandmarker VIDEO mode → 126 fitur;
segmen isyarat = frame pertama s.d. terakhir yang ada tangannya, di-resample ke 30 frame (seperti *temporal standardization*
Mendeley). Mendeley: blok tangan kolom 107–148, aspek ditaksir dari data (aspek yang membuat panjang tulang tangan paling
stabil; uji 1 sampel: 1,45, lebih baik dari 1,0), lalu `normalize_hand`.
**`_IDLE`:** frame sebelum/sesudah isyarat di video WL + window tanpa tangan (nol). Belum mencakup "tangan terlihat tapi diam".
**Split:** uji = WL peraga 4 (*signer-independent*, protokol paper) + 15% Mendeley stratified; validasi 15% sisa.
**Augmentasi:** PRD §11.2 (rotasi, skala, noise, mirror) + **time-warp ×0,75–1,33** karena laju deteksi HP berbeda dari video.
**Model:** PRD §11.2 dengan `GRU(reset_after=False)` — TF.js menjalankan persamaan Keras untuk mode ini (dicek
`tfModel.test.ts`, termasuk uji mutasi urutan gate); kelas diberi bobot *balanced*. Ekspor manual (#23) + cek forward pass
NumPy GRU di notebook.
**Belum diverifikasi:** notebook belum dijalankan di Colab (lokal tanpa TensorFlow/MediaPipe); hanya bagian NumPy yang dites pada
sampel Mendeley asli.

### #32 — 2026-11-26 — Mode A (`ruleBased.ts`) dibuktikan identik dengan spesifikasi Python
`eval/reference_rules.py --dump` menulis `eval/reference_outputs.json` (output Python per id pasangan). `ruleBased.test.ts`
membandingkan **seluruh** 72 pasangan dengan file itu — termasuk 11 pasangan "sulit" yang memang tidak sama dengan referensi
manusia — plus 13 mustPass dan 3 mustPassWithFace (R9). Uji mutasi (R5 "ke" → "di") membuat 3 tes merah.
**Perilaku tambahan:** gloss di luar `lexicon.json` melempar error (spesifikasi Python juga gagal), dijaga tes bahwa semua gloss
`vocab.signs` + `textOnly` dikenal; daftar gloss kosong → string kosong.
**Integrasi:** `sessionStore.takeSentence()` memakai Mode A; formatter sementara `glossesToText` (DECISIONS #30) dihapus.
Jika `rules.json`/`lexicon.json`/korpus berubah, jalankan ulang `python eval/reference_rules.py --dump`.

### #33 — 2026-11-27 — Terapkan Modern Web Guidance (Chrome/Edge/Firefox/MDN)
`npx modern-web-guidance legacy-scan .` (termasuk tes): 1 temuan → `median()` memakai `toSorted()`; `tsconfig.app.json` lib naik
ke **ES2023** (Chrome 110+, Safari 16+, Firefox 115+). Panduan `form-factor-adaptation`, `accessibility`, `motion`,
`responsive-design` dicocokkan ke kode: safe-area atas di app shell (`viewport-fit=cover`), BottomNav `grid-cols-4` (sisa
kolom menu Rekam), `ConfidenceHint` bukan live region (berubah tiap frame), opsi "Kata" memakai `aria-disabled` (tetap bisa
difokus, alasan terbaca), `text-wrap: balance/pretty` dan `overflow-wrap: break-word`. Sudah sesuai: `h-dvh`, safe-area bawah,
focus ring, tidak ada animasi. Legacy-scan hanya mencakup ±20% korpus panduan.

### #34 — 2026-11-27 — Audit Modern Web Guidance penuh (210 panduan)
`legacy-scan` otomatis hanya mencakup 38 panduan (0 temuan setelah #33). Sisanya dipilah manual dari `list` (210):
- **Tidak berlaku (±181)** — fitur tidak ada di IsyaratKu: passkey/autentikasi, form alamat/pembayaran/OTP, Web Components,
  tanggal & zona waktu, carousel, drag/swipe, dialog/menu/tooltip/popover, efek scroll, tabel, analitik/A-B test, WebGL/3D,
  C++/WASM, WebMCP, kriptografi, on-device AI (Prompt/Translator API — fitur baru, bukan modernisasi).
- **Sudah sesuai**: `navbar` (NavLink `aria-current`), `icons` (SVG `aria-hidden`), `checkbox`/`brand-consistent-forms`
  (`accent-color`), `html` (`lang="id"`, landmark, heading), `css`, `color` (kontras dicek), `js` (tidak ada error re-throw
  berbasis string), `performance`/`break-up-long-tasks` (deteksi di Web Worker; prediksi per frame kecil), `single-line-overflow`.
- **Diterapkan**: `typography` (font nav `px` → `rem`), `switch` (toggle debug = `<input type="checkbox" switch>`, dites),
  `spinner` (overlay loading `role="status"`), `privacy` (alasan & konteks sebelum izin kamera: video tidak dikirim),
  `natural-interactions` (umpan balik tekan `active:` pada tombol), `respect-os-text-scale` (`<meta name="text-scale">`;
  root font-size memang tidak diset).
- **Ditunda**: `security`/`privacy`/`restrict-outbound-connections` (CSP + Permissions-Policy) — header CSP memutus HMR dev
  server, diterapkan saat deploy (#18) lewat `vercel.json`; `content-first-noise-reduction` (layout Terjemah terlalu penuh,
  ditunda pemilik); `dark-mode` (aplikasi sengaja gelap, toggle di F11); `install-web-app` (API install baru = fitur, bukan
  modernisasi); `efficient-background-processing`/`detect-initial-visibility-state` (rAF sudah berhenti saat tab tersembunyi).


### #35 — 2026-11-27 — Segmenter mode kata (`WordSegmenter`)
Kelas terpisah dari `Segmenter` (abjad) di `src/lib/segmenter.ts`, berbagi `Emitter` dan antarmuka `GlossSegmenter`
(`on('gloss'|'sentenceEnd')`, `push`, `reset`, `resume`) yang dipakai halaman Terjemah. Aturan PRD F4 apa adanya, plus:
- Frame tanpa tangan tetap masuk window tetapi **tidak** diprediksi; jeda diukur dari waktu (`lastActiveT`).
- Prediksi `_IDLE` (berapa pun confidence-nya) = jeda: mereset streak dan mengizinkan gloss yang sama lagi.
- Confidence < ambang mereset streak; streak juga direset saat akhir kalimat (bug tertangkap tes "SAYA lagi di kalimat baru").
- Akhir kalimat mode kata 1000 ms (PRD F4); mode abjad tetap 2500 ms (#30) karena jeda antar kata eja sudah 1000 ms.
- `_IDLE` diambil dari `vocab.signs.at(-1)` (aturan: label hanya dari `vocab.json`), tidak ditulis ulang.
- Ganti mode saat berjalan: segmenter baru + `resume(chip yang ada)`; `setMode` mengosongkan `wordBuffer` dan `active`.

### #36 — 2026-11-27 — Ekspresi wajah (F13) di worker yang sama dengan tangan
- FaceLandmarker (`public/models/face_landmarker.task`, float16 Google, Apache-2.0, ±3,7 MB) dimuat di
  `handDetector.worker.ts` **setelah** tangan siap, memakai fileset dan delegate yang sama, `numFaces: 1`,
  `outputFaceBlendshapes: true`. Jalan tiap `emotion.json.runEveryNFrames` (3) frame. Worker hanya mengirim skor
  blendshapes (angka), tidak ada gambar. Gagal dimuat → tangan tetap jalan tanpa ekspresi.
- Tidak ada `face.ts` terpisah (PRD F13 menyebutnya): pemanggilan MediaPipe sudah di worker; `face.ts` hanya akan
  membungkus satu fungsi. Logika murni ada di `src/lib/emotion.ts`.
- Ringkasan kalimat (`FaceTracker`): emosi non-netral terbanyak jika ≥ 30% frame wajah, selain itu netral;
  `isQuestion` jika `browInnerUp` ≥ ambang `bertanya` di ≥ 30% frame wajah 1 detik terakhir. Frame tanpa wajah
  tidak dihitung. Memori terbatas: hitungan per emosi + daftar 1 detik terakhir.
- Akhir kalimat: `takeSentence({emotion, isQuestion})` → Mode A R9; emosi → nada `speak`; disimpan untuk "Ucapkan ulang".
- Tahap Ekspresi tidak pernah "aktif" di StageBar (berjalan bersamaan dengan Tangan); statusnya di detail tahap.
- Ditunda: kalibrasi wajah netral (F11), `EmotionBadge` (F7).

### #37 — 2026-11-27 — Mode kata: window 15 fps, jeda antar gloss 600 ms, penghalusan lebih ringan
Uji HP pertama (iPhone, 31 FPS deteksi): chip lambat muncul dan salah kata ("Saya marah berangkat air apa air?").
- **Akar masalah:** model dilatih dengan 30 frame = satu isyarat utuh pada `TARGET_FPS` 15 (±2 dtk), tetapi
  `WordSegmenter` memakai 30 frame kamera terakhir; di 31 FPS itu hanya ±1 dtk (setengah isyarat). Model ragu dan
  menebak kelas lemah (BERANGKAT, AIR). **Perbaikan:** opsi `fps` (15) — frame kamera disampel berdasarkan waktu
  ke 15 fps sebelum masuk window. `fps` wajib sama dengan `TARGET_FPS` notebook.
- **Kata salah saat transisi:** gloss baru butuh ≥ `minGlossGapMs` (600 ms) sejak gloss sebelumnya. Syarat stabil
  diubah ke `streak >= 3` agar isyarat yang tetap stabil melewati jeda tetap diterima.
- **Debug:** `Prediction.top` (3 label teratas); di Mode debug tampil di bawah petunjuk confidence, untuk
  mencocokkan peragaan dengan dataset.
- **Garis tangan tertinggal:** One Euro `minCutoff` 0,5 → 1,0 dan tween τ 45 → 20 ms (#14 disetel untuk 10–15 FPS).
  Fitur ke segmenter ikut sedikit kurang halus; mode abjad perlu dicek ulang di HP.
- Ditunda: latih ulang kelas lemah (BERANGKAT 0,00; AIR, HIJAU, BAGAIMANA).

### #38 — 2026-11-27 — Model dijalankan tanpa TF.js (`nativeModel.ts`); suara dibuka saat "Mulai"
- **Masalah:** uji HP kedua — deteksi tetap terasa sangat lag di mode Kata. Diukur: model kata (GRU 30×126) di TF.js
  backend CPU **621 ms** per prediksi (huruf 0,3 ms). TF.js memecah GRU 30 langkah jadi ratusan op kecil + `dataSync()`
  di main thread, ±7× per detik → layar dan garis tangan tersendat. WebGL di HP tidak bisa diukur dari laptop.
- **Keputusan:** `src/lib/nativeModel.ts` menghitung InputLayer, Dense, Dropout, GRU (`reset_after=False`) langsung
  dengan `Float32Array`, membaca `model.json` + bobot yang sama. Diukur: **4,2 ms** (kata), 0,05 ms (huruf). Tes
  membandingkan output dengan TF.js pada kedua model asli (selisih < 1e-4). Lapisan lain → error → classifier memakai
  TF.js (lazy) sebagai cadangan, jadi bundel TF.js tidak diunduh untuk model sekarang. Tanpa dependency baru.
- **Suara tidak keluar otomatis (iOS):** Safari/WebKit memblokir `speechSynthesis` sampai satu ucapan dimulai dari
  ketukan; ucapan akhir kalimat berasal dari loop kamera. `unlockSpeech()` mengucapkan spasi bervolume 0 di handler
  tombol "Mulai".

### #40 — 2026-11-27 — Mode B: Google Gemini lewat `/api/translate`
- **Provider:** Google Gemini (dipilih pemilik), REST `models/{model}:generateContent`, tanpa dependency baru (`fetch`).
  Model dari `LLM_MODEL` (default `gemini-3.1-flash-lite`, punya tier gratis); key `LLM_API_KEY` hanya di `.env` server,
  dikirim lewat header `x-goog-api-key` (tidak di URL).
- **Batas kepercayaan:** `validateTranslateInput` (src/lib/translator/llm.ts) hanya menerima gloss yang ada di
  `vocab.json` (`signs` tanpa `_IDLE`, `textOnly`) atau `FS:[A-Z]{1,20}`, maks 20 gloss, emosi dari `emotion.json`,
  `isQuestion` boolean. Teks bebas tidak pernah sampai ke LLM (juga menutup prompt injection). Jawaban harus JSON
  `{"sentence"}` ≤ 300 karakter. Rate limit 30/menit per IP (memori proses; cukup untuk demo).
- **Prompt:** instruksi tata bahasa BISINDO + 4 contoh few-shot yang **dicek tes tidak ada di `eval/gloss_pairs.json`**
  agar BLEU/chrF Mode B tidak bocor.
- **Fallback:** klien `translateModeB` (timeout 5 dtk > timeout server 4 dtk) memakai Mode A bila HTTP gagal, offline,
  key kosong (503), kuota (502) atau jawaban rusak; R9 tetap berlaku. UI menandai "Mode A — Mode B gagal".
- **Jalan lokal:** plugin di `vite.config.ts` memasang handler yang sama di `vite dev` dan `vite preview` (menjawab #18
  tanpa Vercel CLI); hanya variabel `LLM_*` yang dibaca, tidak masuk bundel klien.
- **Async di UI:** `beginTranslation` mengambil chip (isyarat baru selama menunggu masuk kalimat berikutnya),
  `endTranslation` menampilkan hasil. Pilihan Mode A/B di Pengaturan (`settingsStore.translator`, default Mode A).
- **Evaluasi:** `npm run eval` memanggil Gemini untuk 72 pasangan (jeda `LLM_EVAL_DELAY_MS`, coba ulang 3×). Satu
  pasangan gagal → skor Mode B dikosongkan untuk semua subset (A dan B harus dinilai pada kalimat yang sama).
