# Panduan dasar: dari laptop kosong sampai Pull Request

Untuk Radja dan Gilang. Ikuti sekali dari atas (bagian A), lalu bagian B setiap kali mengerjakan tugas.
Panduan tugas masing-masing: [gilang.md](gilang.md) dan [radja.md](radja.md). Aturan tim: [../TEAM.md](../TEAM.md).

---

## A. Persiapan (sekali saja)

### A1. Pasang program

| Program | Unduh | Catatan |
| --- | --- | --- |
| Git | https://git-scm.com/download/win | Saat instal, semua pilihan biarkan default. |
| Node.js 22 LTS atau lebih baru | https://nodejs.org | Pilih tombol "LTS". |
| VS Code | https://code.visualstudio.com | Editor kode; punya terminal dan tombol Git bawaan. |
| Google Chrome | — | Untuk membuka aplikasi. |

Cek di terminal (VS Code → menu **Terminal → New Terminal**):
```
git --version
node --version
npm --version
```
Ketiganya harus menampilkan nomor versi. Kalau "not recognized", tutup lalu buka lagi VS Code.

### A2. Akun GitHub dan undangan

1. Buat akun di https://github.com (kalau belum), kirim **username** ke Rakan.
2. Rakan mengundang Anda. Buka email dari GitHub atau https://github.com/notifications → **Accept invitation**.
3. Pastikan halaman https://github.com/rakanlagingoding/isyaratku bisa dibuka (sebelum diterima: 404).

### A3. Kenalkan diri ke Git (sekali per laptop)

Pakai nama dan email akun GitHub Anda:
```
git config --global user.name "Nama Anda"
git config --global user.email "email-github-anda@contoh.com"
```

### A4. Ambil kode (clone) dan jalankan

```
cd Documents
git clone https://github.com/rakanlagingoding/isyaratku.git
cd isyaratku
npm install
npm run dev
```
- Pertama kali clone, Windows bisa membuka jendela login GitHub: login dan izinkan.
- `npm install` butuh beberapa menit (mengunduh library).
- Setelah `npm run dev`, terminal menampilkan `Local: https://localhost:5173/`. Buka di Chrome.
- Chrome menampilkan **"Your connection is not private"**: klik **Advanced → Proceed to localhost (unsafe)**.
  Ini wajar; sertifikat HTTPS lokal dibuat sendiri. Kamera hanya jalan di HTTPS.
- Izinkan kamera. Tekan **Ctrl+C** di terminal untuk menghentikan server.

**Buka dari HP:** HP dan laptop di Wi-Fi yang sama, buka alamat `Network: https://192.168.x.x:5173/` dari terminal di
Chrome HP, lewati peringatan yang sama.

### A5. Buka folder di VS Code

VS Code → **File → Open Folder** → pilih folder `isyaratku`. Pasang ekstensi yang disarankan kalau VS Code menawarkan
(ESLint, Prettier, Tailwind CSS IntelliSense).

### A6. Baca dulu (±30 menit)

1. `CLAUDE.md` — aturan kode dan larangan (berlaku untuk semua anggota).
2. `docs/TEAM.md` — alur kerja tim.
3. `docs/PROGRESS.md` — apa yang sudah jadi dan bug yang diketahui.
4. Bagian `PRD.md` yang disebut di panduan tugas Anda.

---

## B. Alur setiap tugas (ulangi untuk tiap tugas)

### B1. Mulai dari `main` terbaru, buat branch

```
git checkout main
git pull
git checkout -b gilang/layout-terjemah
```
Nama branch: `nama/tugas-singkat`, huruf kecil, pakai tanda `-`. Satu branch = satu tugas.
Cek branch aktif kapan saja: `git branch` (yang bertanda `*`), atau lihat pojok kiri bawah VS Code.

### B2. Kerjakan dan cek terus

- Biarkan `npm run dev` jalan; perubahan langsung terlihat di Chrome.
- Simpan sering (Ctrl+S). Prettier merapikan format otomatis saat simpan (kalau ekstensinya terpasang), atau jalankan
  `npm run format`.

### B3. Wajib lolos sebelum commit

Buka terminal kedua (ikon **+** di panel terminal) agar server tetap jalan:
```
npm test
npm run lint
npm run build
```
Ketiganya harus selesai tanpa error. Kalau `npm test` gagal, baca nama tes yang merah: biasanya menunjuk file yang Anda
ubah. Jangan push kode yang gagal.

### B4. Commit (simpan versi)

```
git status                 # lihat file yang berubah
git add .
git commit -m "feat(ui): rapikan layout halaman Terjemah"
```
Pesan commit: `jenis(bagian): apa yang berubah`. Jenis: `feat` (fitur baru), `fix` (perbaikan bug), `docs`
(dokumen), `test`, `style` (tampilan), `chore` (lain-lain). Commit kecil dan sering lebih baik daripada satu commit raksasa.

Alternatif tanpa ketik perintah: tab **Source Control** di VS Code (ikon cabang) → tulis pesan → **Commit**.

### B5. Push dan buka Pull Request (PR)

```
git push -u origin gilang/layout-terjemah
```
Push berikutnya di branch yang sama cukup `git push`.

Lalu di https://github.com/rakanlagingoding/isyaratku muncul tombol kuning **Compare & pull request**. Klik, lalu isi:
- **Judul**: sama seperti pesan commit utama.
- **Deskripsi** (salin templat ini):
  ```
  ## Apa yang berubah
  - ...

  ## Cara menguji
  1. npm run dev, buka halaman ...
  2. ...

  ## Sudah dicek
  - [ ] npm test
  - [ ] npm run lint
  - [ ] npm run build
  - [ ] dicoba di lebar 360 px / di HP
  ```
- Tambahkan screenshot tampilan (seret gambar ke kotak deskripsi) kalau ada perubahan UI.
- Klik **Create pull request**, lalu kabari grup.

**Jangan klik Merge sendiri.** Rakan yang me-review dan merge.

### B6. Kalau ada komentar review

Perbaiki di branch yang sama, lalu:
```
git add .
git commit -m "fix(ui): perbaiki sesuai review"
git push
```
PR otomatis ter-update. Setelah Rakan merge, kembali ke B1 untuk tugas berikutnya.

### B7. Mengikuti perubahan terbaru di tengah tugas

Kalau `main` berubah (PR orang lain sudah di-merge) saat Anda masih mengerjakan:
```
git checkout main
git pull
git checkout gilang/layout-terjemah
git merge main
```

**Kalau muncul konflik** (`CONFLICT ...`): VS Code menandai bagian file dengan `<<<<<<<` dan `>>>>>>>`. Pilih
**Accept Current / Accept Incoming / Accept Both** di atas tiap blok, simpan, lalu:
```
git add .
git commit -m "chore: merge main"
```
Ragu? Jangan tebak: tanya Rakan di grup sebelum commit.

---

## C. Masalah umum

| Gejala | Penyebab / solusi |
| --- | --- |
| `npm` / `git` "not recognized" | Program belum terpasang atau VS Code belum dibuka ulang setelah instal. |
| Kamera hitam / tidak diminta izin | Buka alamat `https://...`, bukan `http://`. Cek izin kamera di ikon gembok Chrome. |
| "Model deteksi tangan gagal dimuat" di HP | HP membuka alamat IP lama; cek alamat `Network:` terbaru di terminal. |
| `git push` ditolak (`rejected`) | Ada perubahan baru di remote: `git pull` dulu, lalu `git push`. |
| `Permission denied` saat push | Undangan repo belum diterima, atau login GitHub di laptop salah akun. |
| Tidak sengaja kerja di `main` | Sebelum commit: `git checkout -b nama/tugas` (perubahan ikut pindah ke branch baru). |
| Ingin membuang perubahan satu file | `git restore path/ke/file` (hati-hati: tidak bisa dibatalkan). |

## D. Yang tidak boleh

- Push langsung ke `main`, atau merge PR sendiri.
- Commit `.env`, API key, password, foto/video wajah, atau dataset mentah.
- Menambah library (`npm install nama-paket`) tanpa izin Rakan: tulis alasannya di grup dulu.
- Mengubah `PRD.md` tanpa diskusi.
