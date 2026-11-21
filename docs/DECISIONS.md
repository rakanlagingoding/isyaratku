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
**Status:** perubahan PRD F2, §11.2, komentar `Sample.frames`, dan `docs/examples/sample-letters.example.json` diusulkan di chat; diterapkan setelah disetujui, sebelum Fase 2.
**Perlu dicek:** apakah ada abjad BISINDO yang memakai gerakan (bukan pose statis); jika ada, model abjad 1 frame tidak cukup untuk huruf itu.
