# Panduan Gilang — Frontend

Peran: tampilan dan interaksi aplikasi (PRD **F7, F8, F9, F11**). Logika berat (model, kamera, penerjemah, suara) sudah
ada di `src/lib/` dan dikerjakan Rakan; Anda memakainya dari komponen.

Sebelum mulai: selesaikan [git-dasar.md](git-dasar.md) bagian A. Setiap tugas di bawah = satu branch + satu PR (bagian B).

---

## 1. Peta kode yang Anda sentuh

| Path | Isi |
| --- | --- |
| `src/pages/TranslatePage.tsx` | Halaman Terjemah (kamera, chip, StageBar, tombol). Paling sering Anda ubah. |
| `src/pages/SettingsPage.tsx` | Halaman Pengaturan (sekarang baru toggle debug). |
| `src/pages/ConversationPage.tsx`, `LearnPage.tsx` | Masih placeholder: tugas Anda mengisinya. |
| `src/components/` | Komponen kecil: `StageBar`, `GlossChips`, `ConfidenceHint`, `CaptionBar`, `BottomNav`, ... |
| `src/components/*.test.tsx` | Contoh tes komponen; tiru polanya. |
| `src/store/sessionStore.ts` | State halaman Terjemah (gloss, kalimat, emosi, ...). **Baca saja**; minta Rakan kalau butuh field baru. |
| `src/store/settingsStore.ts` | Pengaturan tersimpan (`localStorage`). Boleh ditambah field untuk F11 — sebut di PR. |
| `src/data/vocab.json` | Daftar kata (`signs`) dan huruf (`letters`). Satu-satunya sumber label. |
| `src/data/emotion.json` | Nama emosi dalam bahasa Indonesia (`labels`). |

**Jangan ubah** tanpa bicara dengan Rakan: `src/lib/`, `src/workers/`, `src/data/*.json` (kecuali teks), `training/`.

Cara membaca state di komponen (pola yang sudah dipakai):
```tsx
import { useSessionStore } from '../store/sessionStore';

const emotion = useSessionStore((s) => s.emotion);       // 'senang' | 'sedih' | ... | null
const sentence = useSessionStore((s) => s.sentence);     // kalimat hasil terakhir
```

## 2. Aturan tampilan (wajib, dicek saat review)

- Teks UI **bahasa Indonesia**; nama file, variabel, komentar kode **bahasa Inggris**.
- Target sentuh (tombol) **≥ 48 px** tinggi/lebar → kelas Tailwind `min-h-12`.
- Teks hasil terjemahan **≥ 24 px** → `text-2xl` atau lebih.
- Kontras teks ≥ 4.5:1 (latar gelap `slate-900`, teks terang). Status penting harus terlihat, bukan hanya bunyi:
  pengguna Tuli tidak mendengar audio.
- **Uji di lebar 360 px**: Chrome → F12 → ikon HP (Toggle device toolbar) → set lebar 360. Tidak boleh ada scroll
  ke samping atau tombol yang tertutup.
- Styling pakai **Tailwind** (kelas di `className`), seperti komponen yang sudah ada. Jangan tambah library UI.
- Komponen kecil dan fungsional; satu komponen satu file di `src/components/`, dengan tes `NamaKomponen.test.tsx`.

## 3. Tugas (kerjakan berurutan)

### Tugas 1 — Rapikan layout halaman Terjemah (prioritas tertinggi)

Branch: `gilang/layout-terjemah` · Acuan: PRD F7, bug "terlalu penuh" di `docs/PROGRESS.md`.

Masalah: di HP, area bawah kamera berisi StageBar + teks hasil + toggle Abjad/Kata + 3 tombol + menu bawah, sehingga
kamera kecil dan berdesakan (lihat screenshot uji HP di grup).
- Kamera harus mendapat ruang terbesar.
- Ide (pilih/kombinasikan): gabungkan toggle Abjad/Kata ke baris tombol; buat StageBar lebih pendek (angka + label kecil);
  pindahkan "Hapus" jadi ikon; teks hasil maksimal 2 baris lalu terpotong.
- Semua fungsi tetap ada dan tetap ≥ 48 px.
- **Selesai jika**: di lebar 360 × 640 semua elemen terlihat tanpa scroll, kamera ≥ 50% tinggi layar, `npm test` lolos
  (tes `StageBar.test.tsx` dkk. jangan dihapus; ubah hanya kalau teksnya memang berubah).
- Sertakan screenshot sebelum/sesudah di PR.

### Tugas 2 — `EmotionBadge` (DITUNDA: ekspresi wajah "segera hadir", DECISIONS #39)

> Lewati dulu, lanjut ke Tugas 3. Fitur ekspresi wajah dimatikan sementara; tahap Ekspresi di StageBar bertanda "Segera".


Branch: `gilang/emotion-badge` · Acuan: PRD F7 ("label emosi").
- Komponen baru `src/components/EmotionBadge.tsx`: menampilkan emosi wajah saat ini di pojok kamera, mis. "😊 Senang".
- Data: `useSessionStore((s) => s.emotion)`; nama Indonesia dari `src/data/emotion.json` → `labels`. `null` = tidak tampil
  atau "Wajah tidak terlihat".
- Pasang di `TranslatePage.tsx` di atas kamera (dekat label "Tangan tidak terlihat").
- Tes: `EmotionBadge.test.tsx` — tampil "Senang" untuk `senang`, tidak tampil untuk `null`.

### Tugas 3 — Halaman Pengaturan (tampilan F11)

Branch: `gilang/pengaturan` · Acuan: PRD F11.
- Isi `SettingsPage.tsx` dengan: ambang confidence (slider 0,50–0,95), suara (Gadis/Ardi), deteksi ekspresi (tampil nonaktif, "Segera hadir"),
  mode penerjemah (A/B, B nonaktif bertuliskan "Segera"), debug (sudah ada).
- Simpan di `settingsStore.ts` (tambah field + fungsi `set...`, ikuti pola `debug` dan `translator`). **Jangan** naikkan
  `version` di `persist`: field baru otomatis memakai nilai default, sedangkan menaikkan versi tanpa `migrate` menghapus
  pengaturan yang tersimpan.
- Pilihan Mode A/B sudah ada (dibuat Rakan, PR #3); cukup rapikan tampilannya.
- Tidak perlu menyambungkan ke kamera/penerjemah: Rakan yang memakai nilainya. Tulis di PR field apa saja yang Anda tambah.
- Tes: ubah slider/toggle → nilai di store berubah.

### Tugas 4 — Halaman Percakapan (tampilan F8)

Branch: `gilang/percakapan` · Acuan: PRD F8.
- Ganti placeholder `ConversationPage.tsx`: layar terbagi (atas: kamera + teks hasil isyarat, bawah: teks besar ucapan
  lawan bicara), tombol mikrofon **tahan-untuk-bicara** (besar, ≥ 64 px), daftar bubble riwayat, tombol "Hapus riwayat".
- Untuk sekarang pakai data contoh (array `ChatMessage` di `src/types.ts`); Rakan menyambungkan speech-to-text.
- Kamera: pakai komponen `CameraView` yang sudah ada.

### Tugas 5 — `TranslationText` (setelah Rakan menyiapkan datanya)

Branch: `gilang/translation-text` · Acuan: PRD F7.
- Kalimat hasil; kata yang ditambahkan penerjemah (bukan dari isyarat) diberi garis bawah.
- Tunggu Rakan menambah daftar "kata tambahan" ke hasil penerjemah. Tanya di grup sebelum mulai.

### Tugas 6 (opsional) — Halaman Belajar (F9)

Branch: `gilang/belajar` · Acuan: PRD F9.
- Daftar kata dari `vocab.json` (`signs`, kecuali `_IDLE`) dan huruf (`letters`), dengan kolom cari.
- Deskripsi cara memperagakan dari panduan peragaan yang dibuat Radja.

## 4. Cara mengecek pekerjaan

```
npm run dev                                   # lihat langsung di Chrome
npx vitest run src/components/EmotionBadge    # jalankan satu file tes saja
npm test && npm run lint && npm run build     # wajib sebelum push
```
- Tanpa model/kamera pun UI tetap jalan: kalau model tidak ada, aplikasi memakai mode mock (label "Model belum dimuat").
- Uji di HP (git-dasar A4) sebelum PR untuk perubahan tata letak.

## 5. Contoh tes komponen

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmotionBadge from './EmotionBadge';

describe('EmotionBadge', () => {
  it('shows the Indonesian emotion label', () => {
    render(<EmotionBadge emotion="senang" />);
    expect(screen.getByText(/Senang/)).toBeInTheDocument();
  });

  it('renders nothing without a face', () => {
    const { container } = render(<EmotionBadge emotion={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```
Tips: buat komponen menerima data lewat **props** (seperti `ConfidenceHint`), lalu halaman yang membaca store. Komponen
jadi mudah dites tanpa store.
