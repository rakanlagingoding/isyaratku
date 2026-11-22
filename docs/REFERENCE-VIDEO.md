# REFERENCE-VIDEO — Demo "AI sign language to voice" (acuan tampilan dan alur)

> Ringkasan isi video TikTok yang menjadi **inspirasi** IsyaratKu (kreator: bcho,
> judul: *"What if AI could translate sign language into voice?"*).
> Dokumen ini dibuat dari pengamatan rekaman layar video oleh pemilik project.
> Agent tidak bisa membuka videonya; **gunakan dokumen ini sebagai satu-satunya acuan isi video**.
> Jika ada pertentangan dengan PRD, **PRD.md yang berlaku**.

---

## 1. Apa yang diperlihatkan video

Prototipe penerjemah **ASL (American Sign Language) → kalimat bahasa Inggris → suara**, berjalan di **laptop**
(webcam, aplikasi lokal di `localhost`). Prosesnya terlihat sebagai **4 tahap berurutan**:

| # | Tahap di video | Yang terjadi | Yang terlihat di layar |
| --- | --- | --- | --- |
| 1 | **Hand Tracking** | MediaPipe melacak 21 titik per tangan dan 468 titik wajah secara realtime | Titik dan garis tulang tangan di atas video; isyarat yang dikenali muncul sebagai **chip** berurutan di atas layar (contoh: `TECHNOLOGY` `USE` `IMPROVE` `LIFE` `WAR` `NOT`); indikator keyakinan seperti **"58% — hold steadier"** saat isyarat belum stabil |
| 2 | **Emotion Detection** | Ekspresi wajah diklasifikasikan: Happy, Questioning, Angry, Neutral, Skeptical | Kotak di wajah dengan **label emosi** |
| 3 | **LLM Interpretation** | Urutan isyarat + emosi dikirim ke LLM lokal, disusun menjadi kalimat Inggris yang wajar | Kalimat hasil, mis. `TECHNOLOGY USE IMPROVE LIFE NOT WAR` → *"Let's use technology to improve lives, not war."*; **kata yang ditambah/diubah AI diberi garis bawah** |
| 4 | **Voice Output** | Kalimat diucapkan dengan ElevenLabs; **nada suara mengikuti emosi** | Status sedang berbicara |

Pesan utama video:

- Di bahasa isyarat, **ekspresi wajah bukan sekadar emosi**, tetapi bisa mengubah makna kalimat (misalnya menjadikannya pertanyaan).
- Bahasa isyarat dan bahasa lisan punya **tata bahasa yang sangat berbeda**, jadi urutan isyarat perlu *diterjemahkan*, bukan hanya digabung.

## 2. Pemetaan ke IsyaratKu

| Di video | Di IsyaratKu | Referensi |
| --- | --- | --- |
| ASL → bahasa Inggris | **BISINDO → bahasa Indonesia** | PRD §1 |
| Laptop + webcam | **HP (PWA, Chrome Android)** + kamera depan | PRD §1, §10 |
| Hand Tracking + chip isyarat | `CameraView`, `GlossChips`, segmenter | F1, F4, F7 |
| "58% — hold steadier" | Indikator keyakinan **"58% — tahan lebih stabil"** | F7 |
| 468 titik wajah + emosi | `FaceLandmarker` **blendshapes** → `netral/senang/sedih/marah/bertanya` (aturan `emotion.json`, tanpa melatih model) | F13 |
| "Questioning" | `bertanya` (alis naik) → kalimat diakhiri `?` (aturan R9) | F5, F13 |
| LLM lokal menyusun kalimat | **Mode B** (LLM via `api/translate.ts`) + **Mode A** rule-based sebagai pembanding & fallback | F5 |
| Kata hasil modifikasi digarisbawahi | `TranslationText` menggarisbawahi `addedWords` | F7 |
| ElevenLabs (berbayar) | **Azure Speech F0 (gratis)** + SSML prosody, fallback Web Speech | F6 |
| Nada sesuai emosi | `prosody.json` (pitch/rate per emosi) | F6 |
| 4 tahap berurutan | `StageBar`: **Tangan · Ekspresi · Interpretasi · Suara** | F7 |

## 3. Yang ditiru dan yang TIDAK ditiru

**Ditiru:**

- Alur dan tampilan 4 tahap, tahap aktif disorot.
- Chip isyarat berurutan + indikator keyakinan.
- Label emosi di wajah.
- Garis bawah pada kata yang ditambahkan penerjemah.
- Nada suara berubah sesuai emosi.

**Tidak ditiru:**

- ElevenLabs atau layanan suara berbayar lain.
- Berjalan di laptop / `localhost` sebagai target utama (IsyaratKu wajib jalan di HP).
- Kelas emosi "Skeptical" (diganti `sedih`; kelas IsyaratKu ada di `emotion.json`).
- Kosakata ASL atau kalimat bahasa Inggris.
- Merek, logo, atau teks dari video.

## 4. Kapan dokumen ini dipakai

- **Fase 3:** halaman Terjemah versi awal (chip gloss + indikator keyakinan).
- **Fase 7a–7b:** ekspresi wajah, suara bernada emosi, `StageBar` 4 tahap, garis bawah `addedWords`.
- Di luar fase itu, dokumen ini hanya konteks. Jangan mengerjakan fitur di sini lebih awal dari jadwal PRD.
