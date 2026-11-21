# IsyaratKu — starter kit untuk Claude Code

Bahan awal agar agent AI memahami project sebelum menulis kode.

## Isi

| File | Fungsi |
| --- | --- |
| `CLAUDE.md` | Aturan, ringkasan, glosarium. Dibaca otomatis oleh Claude Code. |
| `PRD.md` | Spesifikasi lengkap: fitur F1–F12, kriteria terima, fase. |
| `docs/CONTEXT.md` | Rekap diskusi perencanaan: asal-usul ide, hal yang ditunda, yang bukan bagian project. |
| `docs/PROGRESS.md` | Status per fase. "Ingatan" agent antar sesi. |
| `docs/DECISIONS.md` | Keputusan teknis dan alasannya. |
| `docs/PROMPTS.md` | Perintah siap salin untuk tiap fase. |
| `docs/examples/*.example.json` | Contoh format dataset ekspor (angka sintetis, hanya contoh bentuk). |
| `src/data/vocab.json` | Daftar label; urutan = indeks output model. |
| `src/data/lexicon.json` | Gloss → kata Indonesia + kategori. |
| `src/data/rules.json` | Aturan Mode A + kasus wajib lolos. |
| `eval/gloss_pairs.json` | 40 pasangan uji gloss → kalimat (34 mudah, 6 sulit). |
| `eval/reference_rules.py` | Referensi aturan Mode A. Sudah diuji: mustPass 8/8, mudah 34/34, sulit 2/6. |
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
