# Inventory Material Existing

Tanggal pemeriksaan: 2026-07-23. Semua path relatif terhadap root proyek. File sumber tidak diubah,
dipindahkan, atau disalin.

| Path                                      | Format dan dimensi/struktur                                             |       Ukuran | Klasifikasi                               | Intended use                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------- | -----------: | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `logo1.png`                               | PNG, RGBA 8-bit, 900 x 900                                              | 551,622 byte | Brand/public candidate                    | Logo SMANSA; buat turunan web pada Phase 2 setelah verifikasi hak penggunaan, pertahankan sumber                  |
| `BG_landingpage.png`                      | PNG, RGB 8-bit, 1264 x 843                                              | 614,797 byte | Restricted visual/personally identifiable | Kandidat hero Phase 2 setelah izin publikasi individu dan hak penggunaan dikonfirmasi; sumber lokal di-ignore Git |
| `public/assets/smansa-logo.webp`          | WebP lossless alpha, 512 x 512                                          | 129,066 byte | Brand/public derivative                   | Turunan `logo1.png` untuk landing dan login; metadata non-esensial di-strip                                       |
| `public/assets/smansa-hero.webp`          | WebP lossy, 1264 x 843                                                  |  35,006 byte | Restricted public derivative              | Turunan `BG_landingpage.png` untuk background hero; izin publikasi tetap pemilik deployment                       |
| `data_siswa/ABSEN kls X-26-27 NEW.xlsx`   | XLSX/OOXML, 11 worksheet; 10 class sheets X-1..X-10 dan 1 support sheet | 313,935 byte | Sangat sensitif/PII                       | Sumber migrasi read-only Phase 7; tidak untuk runtime/client                                                      |
| `data_siswa/Absen kls XI-26-27  NEW.xlsx` | XLSX/OOXML, 17 worksheet; 13 visible, 3 hidden, 1 hidden kosong         | 267,200 byte | Sangat sensitif/PII                       | Sumber migrasi read-only Phase 7; mapping sheet perlu validasi manual                                             |
| `data_siswa/Absen kls XII-26-27 OK.xlsx`  | XLSX/OOXML, 16 visible worksheet                                        | 423,466 byte | Sangat sensitif/PII                       | Sumber migrasi read-only Phase 7; mapping sheet perlu validasi manual                                             |

## Temuan

- Logo terverifikasi secara visual sebagai lambang SMA Negeri 1 Pamekasan dengan background
  transparan.
- Hero terverifikasi sebagai foto lingkungan sekolah yang memuat individu dan atribut identitas
  visual. Phase 2 memakai turunan WebP setelah persetujuan pemilik task; kepemilikan dan izin
  publikasi akhir tetap tanggung jawab pemilik deployment.
- Workbook tidak memiliki macro (`.xlsx`), memakai XML Unicode dalam container ZIP, mempunyai merged
  cells dan formula, serta bukan file delimiter-separated.
- Field kandidat yang terdeteksi: `NO`, `NIS`, `NISN`, `NAMA`/`NAMA SISWA`, dan `L/P`. Beberapa sheet
  tidak memuat seluruh field dan support sheet tidak konsisten.
- Range workbook X: class sheets sekitar 43-51 used rows dan 45-65 used columns; support sheet
  360 x 7.
- Workbook XI: 10 sheet awal berbentuk template kelas sekitar 47-49 x 34-40; sheet pendukung
  mencakup range 4 x 2, 356 x 1, 284 x 10, 73 x 11, 12 x 7, dan 361 x 6.
- Workbook XII memiliki 13 sheet berbentuk template presensi dan 3 support sheet. Beberapa range
  memanjang sampai 366-368 rows; lebih dari 10 template membuat mapping kelas ambigu.

Jumlah student tidak dinyatakan pada Phase 0 karena formula, duplikasi support sheet, dan used range
tidak setara dengan row siswa. Hitungan final harus berasal dari adapter dry-run Phase 7.
