# Fase 3 — Suara, mode eja, Terjemah versi awal, PWA (rancangan singkat)

**Tanggal:** 2026-11-22 · **Acuan:** PRD F4 (bagian mode abjad), F6 (Web Speech), F7 (versi awal), F12; `docs/REFERENCE-VIDEO.md`.

## Tujuan

Pengguna mengeja nama dengan abjad jari di depan kamera HP → huruf yang stabil terkumpul → jeda menutup kata menjadi
gloss `FS:RAKAN` (muncul sebagai chip) → di akhir kalimat aplikasi mengucapkan "Rakan" lewat Web Speech. Aplikasi bisa
di-install sebagai PWA. Kriteria PRD: *"Eja nama lalu terucap; app bisa di-install."*

**Bukan Fase 3:** Azure TTS, ekspresi wajah, `StageBar`, garis bawah `addedWords` (Fase 7); penerjemah Mode A/B (Fase 6);
segmenter kata dan model `signs` (Fase 5); offline penuh Mode A (butuh Mode A).

## Pendekatan uji PWA di HP — dipilih pemilik: (C) Cloudflare quick tunnel

| Opsi | Untung | Rugi |
| --- | --- | --- |
| A. USB port forwarding (`chrome://inspect`) | gratis, tanpa internet | butuh kabel + USB debugging |
| B. Deploy Vercel | HTTPS asli | membatalkan #18 |
| **C. Cloudflare quick tunnel** | URL `https://…trycloudflare.com` bersertifikat valid, tanpa akun | pasang `cloudflared`, butuh internet, URL berganti tiap kali, server terbuka bagi pemegang URL |

Alasan C perlu: Chrome menolak service worker di situs bersertifikat self-signed (`https://192.168.1.6:5173`), jadi PWA
tidak bisa di-install lewat jalur dev biasa.

## Rancangan (keputusan agent, bisa dikoreksi)

1. **`src/lib/speech.ts` (F6, Web Speech saja).** `speak(text, { emotion })` membatalkan ucapan sebelumnya, memilih suara
   `id-ID`, `pitch = 1 + pitchPct/100`, `rate = 1 + ratePct/100` dari `prosody.json`. `isSpeechSupported()`. Fase 3 selalu
   `emotion: 'netral'`. Tes dengan `speechSynthesis` palsu. STT (`startListening`) tetap Fase 7 (F8).
   *Catatan:* Chrome Android hanya mengizinkan ucapan setelah ada ketukan pengguna; tombol **Mulai** memenuhi itu.
2. **`src/lib/segmenter.ts` (F4 mode abjad saja).** `class Segmenter { push(f, t); on(event, cb); reset() }`, classifier
   disuntikkan (bisa diganti palsu di tes). Aturan:
   - huruf diterima jika prediksi sama dengan confidence ≥ ambang (0,8) terus-menerus **500 ms**;
   - huruf yang sama berturut-turut (mis. `NN`) baru diterima lagi setelah ada "lepas" (tangan hilang atau prediksi lain);
   - jeda **1000 ms** (tangan hilang / confidence rendah) menutup kata → event `gloss` = `FS:<HURUF>` (maks 20 huruf);
   - jeda **2500 ms** tanpa tangan setelah ada gloss → event `sentenceEnd(glosses)` *(1000 ms di PRD dipakai untuk
     menutup kata, jadi akhir kalimat di mode eja perlu jeda lebih panjang — usulan agent)*;
   - event `letter` (huruf aktif + confidence) untuk indikator keyakinan.
   Mode kata (window 30 frame) tetap Fase 5.
3. **Teks yang diucapkan.** Belum ada penerjemah, jadi gloss eja ditulis kapital awal (`FS:RAKAN` → "Rakan") dan digabung
   spasi. Fungsi kecil `fingerspellToWord()` di `segmenter.ts`; Mode A (R1) mengambil alih di Fase 6.
4. **Halaman Terjemah versi awal (F7).** Kamera penuh; `GlossChips` di atas kamera (ketuk = hapus chip); indikator
   keyakinan di bawah huruf aktif ("58% — tahan lebih stabil" bila di bawah ambang); `CaptionBar` teks ≥ 24 px; tombol
   **Mulai/Jeda**, **Ucapkan ulang**, **Hapus**; toggle **Kata / Abjad** dengan **Kata nonaktif** ("Model kata belum ada",
   Fase 5); getar 50 ms saat gloss diterima. State di `src/store/sessionStore.ts` (Zustand). Badge "Model belum dimuat"
   tetap.
5. **PWA (F12).** `vite-plugin-pwa` *(dependency baru — perlu persetujuan)*: manifest "IsyaratKu", tema gelap, potret,
   ikon 192/512 + maskable (dibuat skrip Node kecil tanpa dependency, desain sederhana sementara). Service worker
   meng-precache aset app; `/mediapipe/*` dan `/models/*` di-cache saat pertama dipakai (ukuran > batas precache).
6. **Tunnel.** `cloudflared` dipasang lewat `winget install --id Cloudflare.cloudflared` *(program baru di laptop — perlu
   persetujuan)*. Uji PWA memakai build produksi: `npm run build`, `npm run preview` tanpa SSL (`VITE_NO_SSL=1`), lalu
   `cloudflared tunnel --url http://localhost:4173`. Vite diizinkan menerima host `.trycloudflare.com`.

## Diserahkan ke builder

Bentuk komponen dan gaya Tailwind (mengikuti `CameraView`/`SettingsPage`), nama event internal, detail ikon.

## Uji di HP (akhir fase)

Buka URL tunnel di Chrome Android → izinkan kamera → **Mulai** → eja nama → chip `FS:…` muncul → diam 2,5 dtk → terucap.
Menu Chrome → **Instal aplikasi** → buka dari layar utama.
