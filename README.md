# IsyaratKu — starter kit untuk Claude Code

Bahan awal agar agent AI memahami project sebelum menulis kode.

## Isi

| File | Fungsi |
| --- | --- |
| `CLAUDE.md` | Aturan, ringkasan, glosarium. Dibaca otomatis oleh Claude Code. |
| `PRD.md` | Spesifikasi lengkap: fitur F1–F12, kriteria terima, fase. |
| `docs/PROGRESS.md` | Status per fase. "Ingatan" agent antar sesi. |
| `docs/DECISIONS.md` | Keputusan teknis dan alasannya. |
| `docs/PROMPTS.md` | Perintah siap salin untuk tiap fase. |
| `docs/examples/*.example.json` | Contoh format dataset ekspor (angka sintetis, hanya contoh bentuk). |
| `src/data/vocab.json` | Daftar label; urutan = indeks output model. |
| `src/data/lexicon.json` | Gloss → kata Indonesia + kategori. |
| `src/data/rules.json` | Aturan Mode A + kasus wajib lolos (termasuk sinyal wajah). |
| `src/data/emotion.json` | Ambang blendshapes wajah → emosi. |
| `src/data/prosody.json` | Emosi → pitch/rate suara. |
| `docs/CONTEXT.md` | Rekap diskusi perencanaan dan keputusan pemilik. |
| `eval/gloss_pairs.json` | 40 pasangan uji gloss → kalimat (34 mudah, 6 sulit). |
| `eval/reference_rules.py` | Referensi aturan Mode A. Sudah diuji: mustPass 8/8, wajah 3/3, mudah 34/34, sulit 2/6. |
| `.env.example` | Variabel untuk Mode B (LLM). |

## Cara mulai

1. Buat folder `isyaratku`, salin semua isi kit ini ke dalamnya.
2. `git init`, lalu buat `.gitignore` berisi minimal `node_modules`, `dist`, `.env`.
3. Buka folder di VS Code, jalankan Claude Code.
4. Jalankan **Sesi 0** di `docs/PROMPTS.md`. Koreksi agent jika penjelasannya keliru.
5. Lanjut Fase 1.

## Perlu dilengkapi sendiri

- Validasi kosakata BISINDO dengan referensi atau teman Tuli; sesuaikan `lexicon.json` jika ada perbedaan.
- Tambah `eval/gloss_pairs.json` sampai 50–100 pasangan sebelum evaluasi akhir.
- Isi tenggat akhir dari dosen di `docs/PROGRESS.md`.

## Uji di HP lewat tunnel (PWA)

Chrome tidak mau memasang service worker di `https://<IP-laptop>:5173` (sertifikat self-signed), jadi uji PWA memakai
Cloudflare quick tunnel yang memberi HTTPS asli (DECISIONS #30). Butuh `cloudflared` (`winget install --id Cloudflare.cloudflared`).

1. `npm run build`
2. `npm run preview:tunnel` (terminal 1, HTTP di `localhost:4173`)
3. `npm run tunnel` (terminal 2) → salin URL `https://….trycloudflare.com` dan buka di Chrome HP.

**Peringatan:** selama tunnel menyala, siapa pun yang tahu URL-nya bisa membuka aplikasi. Jangan bagikan URL, dan matikan
kedua terminal (Ctrl+C) setelah selesai. URL berganti setiap kali `npm run tunnel` dijalankan.
