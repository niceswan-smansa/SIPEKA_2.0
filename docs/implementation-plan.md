# Master Implementation Plan — SIPEKA

**Nama produk:** SIPEKA  
**Kepanjangan:** Sistem Presensi SMANSA Pamekasan  
**Target platform:** Web responsif dan PWA online-only  
**Hosting aplikasi:** Vercel  
**Backend:** Supabase PostgreSQL + Supabase Auth  
**ORM:** Tidak menggunakan Prisma  
**Timezone bisnis:** Asia/Jakarta  
**Status dokumen:** Source of truth implementasi awal

---

## 0. Cara Menggunakan Dokumen Ini

Dokumen ini adalah spesifikasi produk sekaligus rencana eksekusi teknis. Codex harus:

1. Membaca seluruh dokumen sebelum menulis kode.
2. Mengerjakan proyek per fase, bukan sekaligus.
3. Tidak mengubah kebutuhan bisnis tanpa instruksi baru.
4. Menjaga seluruh fitur yang sudah disepakati walaupun suatu fitur belum sedang dikerjakan.
5. Menulis migration, test, dan dokumentasi bersama implementasi fitur.
6. Menghentikan fase apabila lint, typecheck, test, migration check, atau build gagal.
7. Tidak pernah memasukkan kredensial, data siswa nyata, atau kunci Supabase ke repository.
8. Menginventarisasi aset dan data lama yang sudah tersedia sebelum membuat placeholder atau format baru.
9. Tidak mengubah, memindahkan, menghapus, atau menimpa file sumber lama sebelum membuat inventory dan backup yang jelas.

## 0.1 Material Existing di Folder Proyek

Pemilik proyek sudah menyediakan material berikut di dalam folder kerja/repository lokal, walaupun nama file, lokasi, dan formatnya dapat berbeda dari rancangan final:

- logo SMANSA;
- gambar utama untuk background hero landing page;
- data siswa lama atau data awal.

Codex wajib melakukan discovery terhadap material tersebut sebelum membuat placeholder, aset pengganti, atau format data baru.

Aturan discovery:

1. Cari file berdasarkan lokasi, ekstensi, ukuran, dan isi; jangan hanya mengandalkan nama file.
2. Buat `docs/existing-materials-inventory.md` yang mencatat path, jenis file, format, ukuran, status sensitivitas, dan rencana penggunaan.
3. Untuk data siswa, catat hanya struktur kolom, jumlah baris, encoding, delimiter/sheet, dan contoh yang sudah disensor. Jangan mencetak seluruh data siswa ke terminal, log, laporan Codex, test snapshot, atau dokumentasi.
4. Jangan menaruh data siswa di `public/`, client bundle, fixture publik, atau repository baru.
5. Jangan mengubah file sumber. Jika konversi diperlukan, simpan hasil konversi sebagai file baru dan dokumentasikan relasinya dengan sumber.
6. Jika data siswa nyata sudah ter-track Git, hentikan proses import dan laporkan sebagai risiko keamanan. Pindahkan data ke lokasi lokal yang di-ignore atau storage privat sebelum melanjutkan.
7. Normalisasi format dilakukan melalui adapter/import pipeline, bukan dengan mengedit manual file sumber.

Urutan prioritas ketika terjadi konflik:

1. Revisi eksplisit terbaru dari pemilik proyek.
2. Dokumen master ini.
3. Automated test dan database constraint.
4. Implementasi kode yang sudah ada.

---

# 1. Tujuan Produk

SIPEKA adalah sistem pencatatan ketidakhadiran siswa SMANSA Pamekasan berdasarkan tanggal dan jam pelajaran.

Sistem menggunakan model **exception-based attendance**:

- Siswa tanpa record presensi pada suatu jam dianggap hadir.
- Database hanya menyimpan tiga kategori ketidakhadiran.
- Satu record merepresentasikan satu siswa, satu tanggal, dan satu jam pelajaran.

Status resmi:

```text
IZIN
SAKIT
TANPA_KETERANGAN
```

Label antarmuka:

```text
Izin
Sakit
Tanpa Keterangan
```

Tidak ada kategori:

- hadir sebagai record database;
- terlambat;
- alpa;
- bolos.

Kata “bolos” tidak digunakan dalam UI, database enum, laporan baru, atau dokumentasi baru.

---

# 2. Sasaran Kualitas

Sistem harus:

- aman untuk data siswa;
- mudah digunakan petugas sekolah;
- responsif pada desktop, tablet, dan ponsel;
- mempunyai modularitas tinggi;
- mudah direvisi dan di-debug;
- mempunyai audit trail yang tidak dapat dimanipulasi Admin;
- mencegah data presensi ganda;
- mencegah penyimpanan massal setengah selesai;
- menggunakan perhitungan statistik yang konsisten;
- dapat dipasang sebagai PWA;
- tidak dapat digunakan tanpa internet;
- dapat dideploy secara terpisah ke development, staging, dan production.

---

# 3. Batasan dan Non-Goals

Versi awal tidak mencakup:

- input presensi offline;
- background sync;
- cache data siswa untuk penggunaan offline;
- akun siswa atau wali murid;
- notifikasi WhatsApp;
- integrasi fingerprint;
- integrasi face recognition;
- multi-sekolah;
- jadwal mata pelajaran kompleks;
- kategori terlambat;
- pembuatan kelas di luar slot 1–10;
- self-registration pengguna;
- pembuatan Super Admin dari UI;
- alasan manual wajib ketika Admin mengubah data.

---

# 4. Role dan Hak Akses

Sistem mempunyai tiga role database:

```text
SUPER_ADMIN
ADMIN
USER
```

## 4.1 Super Admin

Super Admin hanya mengakses portal pengelolaan akun dan autentikasi.

Super Admin dapat:

- membuat akun Admin;
- membuat akun Pengguna;
- mengubah nama akun;
- mengubah username atau email akun;
- mengubah role antara Admin dan Pengguna;
- mereset password;
- menetapkan password sementara;
- mewajibkan perubahan password pada login berikutnya;
- menonaktifkan akun;
- mengaktifkan kembali akun;
- memaksa logout seluruh sesi akun;
- menghapus akun Admin atau Pengguna;
- melihat riwayat manipulasi akun;
- melihat waktu login terakhir akun.

Super Admin tidak dapat mengakses:

- dashboard presensi;
- pencarian siswa;
- detail siswa;
- input presensi;
- manajemen siswa;
- manajemen kelas;
- import siswa;
- laporan presensi;
- audit log operasional;
- naik atau turun grade;
- data alumni.

Jika orang yang memegang akun Super Admin membutuhkan akses operasional, ia harus membuat dan menggunakan akun Admin terpisah.

Super Admin tidak dapat membuat Super Admin lain dari UI. Bootstrap Super Admin dibuat melalui proses administrasi server atau migration/seed aman.

## 4.2 Admin

Admin mengelola seluruh kegiatan operasional.

Admin dapat:

- melihat dashboard;
- mencari siswa;
- melihat detail siswa;
- input presensi;
- memperbarui presensi;
- menghapus record presensi;
- menambah siswa;
- mengubah siswa;
- menonaktifkan atau mengaktifkan siswa;
- memindahkan kelas siswa;
- mengelola metadata kelas;
- import siswa per kelas;
- menjalankan naik grade;
- membatalkan batch kenaikan grade;
- melakukan koreksi grade individual;
- mengarsipkan alumni;
- menghapus alumni permanen;
- melihat dan mengekspor laporan;
- melihat audit log operasional.

Semua perubahan Admin dicatat otomatis. Admin tidak diwajibkan menulis alasan.

## 4.3 Pengguna

Pengguna sepenuhnya read-only.

Pengguna dapat:

- melihat dashboard;
- menggunakan kalender dashboard;
- melihat grafik harian, mingguan, dan bulanan;
- mencari siswa;
- membuka detail siswa;
- melihat kalender siswa;
- melihat rincian presensi per jam;
- melihat statistik siswa;
- melihat histori presensi siswa yang memang ditampilkan pada detail;
- melihat laporan read-only yang disediakan.

Pengguna tidak dapat:

- menambah data;
- mengubah data;
- menghapus data;
- input presensi;
- import siswa;
- mengelola siswa;
- mengelola kelas;
- melakukan ekspor massal;
- mengelola alumni;
- naik atau turun grade;
- membuka audit log operasional;
- mengelola akun.

Akun Pengguna dikelola sepenuhnya oleh Super Admin.

## 4.4 Matriks Hak Akses

| Modul | Super Admin | Admin | Pengguna |
|---|---:|---:|---:|
| Landing page | Ya | Ya | Ya |
| Login | Ya | Ya | Ya |
| Portal akun | Penuh | Tidak | Tidak |
| Dashboard | Tidak | Penuh | Read-only |
| Input presensi | Tidak | Penuh | Tidak |
| Cari siswa | Tidak | Penuh | Read-only |
| Detail siswa | Tidak | Penuh | Read-only |
| Manajemen siswa | Tidak | Penuh | Tidak |
| Manajemen kelas | Tidak | Penuh | Tidak |
| Import | Tidak | Penuh | Tidak |
| Naik/turun grade | Tidak | Penuh | Tidak |
| Alumni | Tidak | Penuh | Tidak |
| Laporan | Tidak | Penuh | Read-only terbatas |
| Export file | Tidak | Ya | Tidak |
| Audit operasional | Tidak | Ya | Tidak |
| Audit akun | Ya | Tidak | Tidak |

---

# 5. Navigasi dan Route Map

## 5.1 Public

```text
/
/login
/offline
```

## 5.2 Portal Super Admin

```text
/super-admin/accounts
/super-admin/accounts/new
/super-admin/accounts/[id]
/super-admin/account-audit
```

## 5.3 Aplikasi Operasional

```text
/dashboard
/presensi/input
/siswa
/siswa/[id]
/manajemen-siswa
/manajemen-kelas
/import-siswa
/grade
/alumni
/laporan
/riwayat-aktivitas
/profil
```

Navigasi harus dibangun dari konfigurasi role, bukan hardcoded berulang di banyak komponen.

---

# 6. Landing Page

## 6.1 Branding

Nama utama:

```text
SIPEKA
```

Subjudul:

```text
Sistem Presensi SMANSA Pamekasan
```

Aset utama sudah tersedia di folder proyek, walaupun nama file dan formatnya mungkin berbeda:

- logo SMANSA;
- gambar utama hero;
- kemungkinan aset pendukung lain.

Implementasi harus terlebih dahulu menemukan dan memverifikasi aset existing. Jangan membuat placeholder apabila aset existing layak digunakan.

Aturan aset:

- pertahankan file sumber asli;
- salin atau konversi ke lokasi aplikasi hanya bila diperlukan;
- optimalkan ukuran tanpa menurunkan kualitas secara berlebihan;
- gunakan format web yang sesuai seperti WebP/AVIF untuk turunan gambar hero bila berguna;
- gunakan `next/image` atau mekanisme background yang tetap menjaga responsivitas dan performa;
- logo wajib memiliki alt text yang tepat;
- nama file final harus stabil dan tidak memuat informasi sensitif;
- sumber dan file turunan dicatat di `docs/existing-materials-inventory.md`.

## 6.2 Hero

Gambar utama menjadi background penuh hero.

Struktur:

```text
Background image
└── overlay gelap/gradient
    ├── logo SMANSA
    ├── SIPEKA
    ├── Sistem Presensi SMANSA Pamekasan
    ├── deskripsi singkat
    ├── tombol Mulai
    └── tombol Pelajari Lebih Lanjut
```

Tombol **Mulai** menuju `/login`.

Tombol **Pelajari Lebih Lanjut** melakukan smooth scroll ke section overview.

## 6.3 Overview

Overview memuat kartu:

- Dashboard Presensi;
- Input Presensi Massal;
- Kalender dan Statistik;
- Pencarian Siswa;
- Detail Presensi Siswa;
- Laporan dan Ekspor;
- Keamanan dan Pencatatan Perubahan.

Jangan menampilkan “dukungan PWA” sebagai kartu overview.

## 6.4 Footer

Footer minimal memuat:

- nama SIPEKA;
- nama sekolah;
- tahun berjalan;
- tautan login;
- hak cipta sederhana.

## 6.5 Acceptance Criteria

- Hero responsif.
- Background tidak mengurangi keterbacaan teks.
- Logo memiliki alt text.
- Tombol Mulai membuka login.
- Tombol Pelajari Lebih Lanjut scroll ke overview.
- Landing page tidak membocorkan data atau endpoint internal.

---

# 7. Autentikasi dan Pengelolaan Akun

## 7.1 Prinsip

- Gunakan Supabase Auth.
- Tidak ada registrasi publik.
- Semua akun dibuat Super Admin.
- Session tersedia di server melalui cookie.
- Semua halaman protected memverifikasi session dan role di server.
- Menyembunyikan menu di UI bukan pengamanan utama.
- RLS dan server authorization tetap wajib.

## 7.2 Login Identifier

MVP mendukung:

- username; atau
- email.

Field login berupa satu input “Username atau Email”.

Username disimpan lowercase dan unik.

Apabila Supabase membutuhkan email untuk autentikasi, resolusi username ke akun dilakukan pada server. Jangan mengirim daftar akun ke browser.

Pesan login gagal selalu generik:

```text
Username/email atau password tidak valid.
```

Jangan membedakan akun tidak ditemukan dan password salah.

## 7.3 Password Reset oleh Super Admin

Super Admin dapat menetapkan password sementara.

Setelah reset:

- seluruh sesi lama dicabut;
- `must_change_password` menjadi true;
- pengguna diarahkan ke halaman ganti password setelah login;
- pengguna tidak dapat membuka aplikasi utama sebelum mengganti password;
- aktivitas reset masuk account audit log.

## 7.4 Status Akun

Akun mempunyai status aktif/nonaktif.

Akun nonaktif:

- tidak dapat login;
- session aktif harus dicabut;
- tidak dihapus dari audit history.

## 7.5 Account Audit

Portal Super Admin menyimpan log terpisah untuk:

- pembuatan akun;
- perubahan identitas;
- perubahan role;
- reset password;
- revoke session;
- aktivasi/nonaktivasi;
- penghapusan akun;
- login berhasil/gagal bila disepakati dalam implementasi keamanan.

Account audit tidak dicampur dengan audit operasional.

---

# 8. Dashboard

Dashboard tidak menampilkan aktivitas terbaru.

## 8.1 State Tanggal

State utama:

```text
selectedDate
visibleMonth
```

Default keduanya menggunakan hari dan bulan saat ini dalam timezone Asia/Jakarta.

## 8.2 Kalender Bulanan

Kalender mempunyai:

- tombol bulan sebelumnya;
- tombol bulan berikutnya;
- penanda hari ini;
- penanda tanggal terpilih;
- tanggal yang dapat diklik.

Kalender tidak mempunyai:

- tombol kembali ke hari ini;
- indikator kecil pada tanggal yang mempunyai ketidakhadiran.

Mengubah visible month tidak otomatis mengubah selected date.

Ringkasan dan grafik hanya berubah setelah pengguna memilih tanggal.

## 8.3 Ringkasan Tanggal

Kartu:

- Siswa Tidak Hadir;
- Izin;
- Sakit;
- Tanpa Keterangan.

Semua kartu menghitung siswa unik.

Contoh satu siswa Sakit jam 1–10:

```text
Siswa tidak hadir = 1
Sakit = 1
```

Bukan 10.

Apabila satu siswa mempunyai lebih dari satu kategori pada hari yang sama:

- total tidak hadir tetap menghitung satu siswa;
- siswa dapat masuk lebih dari satu kartu kategori;
- karena itu total tiga kategori dapat lebih besar dari total siswa unik.

UI dapat menambahkan tooltip singkat untuk menjelaskan aturan tersebut.

## 8.4 Grafik Harian

Mengikuti selected date.

Sumbu X:

```text
Kelas aktif
```

Contoh:

```text
X-1
X-2
...
X-10
XI-1
...
XII-10
```

Sumbu Y:

```text
Jumlah siswa unik
```

Setiap kelas mempunyai tiga batang:

- Izin;
- Sakit;
- Tanpa Keterangan.

Kelas aktif dengan nilai nol tetap dapat ditampilkan agar posisi kelas konsisten.

Perhitungan:

```text
COUNT(DISTINCT student_id)
GROUP BY class_id, attendance_status
```

## 8.5 Grafik Mingguan

Mengikuti minggu selected date.

Gunakan minggu Senin–Sabtu. Minggu tidak ditampilkan.

Sumbu X:

```text
Senin, Selasa, Rabu, Kamis, Jumat, Sabtu
```

Sumbu Y:

```text
Jumlah siswa unik
```

Setiap hari mempunyai tiga batang:

- Izin;
- Sakit;
- Tanpa Keterangan.

Jika selected date adalah Minggu, gunakan rentang Senin–Sabtu pada minggu ISO yang memuat tanggal tersebut.

## 8.6 Grafik Bulanan

Mengikuti bulan selected date.

Sumbu X:

```text
Tanggal 1 sampai akhir bulan
```

Sumbu Y:

```text
Jumlah siswa tidak hadir
```

Hanya satu series.

Nilai setiap tanggal adalah jumlah siswa unik yang mempunyai minimal satu record ketidakhadiran pada tanggal tersebut.

Tanggal tanpa data tetap muncul dengan nilai nol.

## 8.7 Loading dan Empty State

- Setiap widget memiliki skeleton terpisah.
- Kegagalan satu grafik tidak menghilangkan seluruh dashboard.
- Empty state menjelaskan bahwa tidak ada ketidakhadiran pada periode tersebut.
- Query dashboard dijalankan paralel melalui service terpisah.

## 8.8 Acceptance Criteria

- Default tanggal menggunakan hari ini WIB.
- Pergantian tanggal memperbarui semua statistik terkait.
- Menggeser bulan tidak mengubah selected date.
- Statistik tidak menghitung record jam sebagai siswa.
- Pengguna read-only dapat melihat dashboard.
- Super Admin tidak dapat membuka dashboard.

---

# 9. Input Presensi

Hanya Admin.

## 9.1 Alur

```text
Pilih tanggal
→ Pilih grade
→ Pilih kelas
→ Muat siswa dan presensi existing
→ Centang siswa
→ Atur kategori/jam/catatan per siswa
→ Preview
→ Konfirmasi
→ Simpan satu transaksi
```

## 9.2 Tanggal

- Default hari ini WIB.
- Tanggal sebelumnya boleh dipilih.
- Tanggal masa depan tidak boleh dipilih.
- Koreksi data lama tidak memerlukan alasan.
- Semua perubahan tetap diaudit.

## 9.3 Grade dan Kelas

Grade input:

```text
X
XI
XII
```

Alumni tidak muncul.

Setelah grade dipilih, tampilkan kelas aktif grade tersebut.

## 9.4 Daftar Siswa

Setelah kelas dipilih, muat:

- siswa aktif yang tercatat pada kelas tersebut;
- presensi existing untuk tanggal tersebut;
- status dan jam existing per siswa.

Desktop menggunakan tabel terstruktur. Mobile menggunakan card/accordion per siswa.

Setiap siswa mempunyai:

- checkbox dipilih;
- nama;
- NIS;
- kategori;
- pilihan jam 1–10;
- opsi Semua Jam;
- catatan opsional;
- indikator data existing;
- indikator perubahan lokal.

Setiap siswa boleh mempunyai kategori, jam, dan catatan berbeda.

## 9.5 Bulk Selection

Tersedia:

- Pilih Semua Siswa;
- Batalkan Semua;
- Terapkan Kategori ke Siswa Terpilih;
- Terapkan Jam ke Siswa Terpilih;
- Terapkan Catatan ke Siswa Terpilih, opsional;
- Semua Jam.

Bulk action hanya mengubah draft di browser. Admin tetap dapat mengubah setiap siswa setelah bulk action.

## 9.6 Semua Jam

- Semua Jam mencentang seluruh jam aktif 1–10.
- Membatalkan Semua Jam mengembalikan kontrol pemilihan individual.
- Database tetap menyimpan satu record per jam.

## 9.7 Pencarian dalam Kelas

Pencarian berdasarkan:

- nama;
- NIS;
- NISN.

Perilaku:

- case-insensitive;
- substring/contains match;
- tidak perlu exact name;
- `nabil` menampilkan `Nabila`, `Nabilah`, dan `Muhammad Nabil`;
- hanya mencari siswa kelas terpilih.

## 9.8 Edit Existing dari Input Presensi

Halaman input dapat memperbarui data existing untuk satu tanggal dan kelas.

Prinsip:

- record existing dipopulasi ke draft;
- perubahan kategori/jam terlihat sebelum simpan;
- record tidak dihapus hanya karena siswa tidak dicentang;
- penghapusan harus berupa tindakan eksplisit “Hapus/Clear” pada jam terkait;
- jam existing yang tidak disentuh tetap dipertahankan.

## 9.9 Validasi Konflik

Preview membandingkan draft dengan database terbaru.

Klasifikasi:

- `NEW` — record baru;
- `UPDATE` — record existing berubah;
- `UNCHANGED` — sama;
- `DELETE` — penghapusan eksplisit;
- `INVALID` — melanggar aturan;
- `STALE` — data database berubah setelah form dimuat.

Contoh:

```text
Existing: SAKIT, jam 1
Draft: IZIN, jam 1
Hasil: UPDATE SAKIT → IZIN
```

Sistem tidak menimpa perubahan concurrent secara diam-diam.

## 9.10 Preview

Preview dikelompokkan per siswa.

Contoh:

| Siswa | Kategori | Jam | Hasil |
|---|---|---|---|
| Nabila | Sakit | 1–4 | 4 baru |
| Ahmad | Izin | 1–10 | 6 baru, 4 diperbarui |
| Citra | Tanpa Keterangan | 5–6 | 2 tidak berubah |

Tampilkan summary:

- jumlah siswa;
- record baru;
- record diperbarui;
- record dihapus;
- tidak berubah;
- invalid/stale.

Tombol simpan dinonaktifkan bila ada INVALID atau STALE.

## 9.11 Transaksi

Semua perubahan dalam satu submit harus atomic.

Contoh 80 operasi:

- seluruh 80 berhasil; atau
- tidak ada perubahan tersimpan.

Database function harus:

1. memverifikasi actor adalah Admin aktif;
2. memverifikasi tanggal tidak di masa depan;
3. memverifikasi siswa sesuai kelas;
4. memverifikasi jam 1–10;
5. memverifikasi kategori;
6. memeriksa concurrency/version;
7. upsert/delete record;
8. menulis revision history;
9. menulis audit log;
10. mengembalikan summary.

## 9.12 Respons

Contoh sukses:

```text
Presensi berhasil disimpan
Siswa diproses: 20
Data baru: 52
Data diperbarui: 18
Data dihapus: 0
Tidak berubah: 10
```

Contoh gagal:

```text
Tidak ada perubahan yang disimpan.
Data telah berubah sejak preview. Muat ulang preview dan coba kembali.
```

---

# 10. Pencarian Siswa

Admin dan Pengguna dapat mengakses.

## 10.1 Filter

- kata pencarian;
- grade;
- kelas;
- status siswa;
- alumni aktif/nonaktif bila diizinkan.

Grade dan kelas adalah filter opsional.

Pengguna dapat:

- mencari seluruh sekolah;
- memilih grade saja;
- memilih grade dan kelas;
- memasukkan kata pencarian saja;
- menggabungkan filter.

## 10.2 Search Behavior

Cari pada:

- nama;
- NIS;
- NISN.

Perilaku:

- partial match;
- case-insensitive;
- trim dan normalisasi spasi;
- tidak exact;
- pagination server-side;
- debounce 250–400 ms;
- query kosong boleh menampilkan daftar dengan filter.

MVP tidak wajib fuzzy typo. Dukungan typo ringan menjadi backlog, bukan acceptance criterion awal.

## 10.3 Hasil

Tampilkan:

- nama;
- NIS;
- NISN sesuai izin tampilan;
- grade;
- kelas;
- status aktif;
- tombol detail.

Pengguna read-only tidak melihat tombol edit.

---

# 11. Detail Siswa

Admin dan Pengguna dapat melihat. Hanya Admin dapat mengubah.

## 11.1 Identitas

- nama lengkap;
- NIS;
- NISN;
- jenis kelamin;
- grade saat ini;
- kelas saat ini;
- status aktif;
- tahun masuk;
- tahun lulus bila alumni;
- wali kelas jika tersedia.

## 11.2 Kalender Siswa

- kalender per bulan;
- navigasi bulan sebelumnya/berikutnya;
- tanggal dapat diklik;
- tanggal terpilih membuka rincian jam;
- kalender boleh memberi warna kategori pada siswa individual karena informasinya berguna pada konteks satu siswa.

Jika satu tanggal mempunyai beberapa kategori, gunakan indikator multiwarna atau prioritas visual dengan legend yang jelas.

## 11.3 Rincian Per Jam

Tampilkan jam 1–10.

Jam tanpa record ditampilkan sebagai “Hadir” hanya di UI.

Setiap jam menampilkan:

- nomor jam;
- status;
- catatan;
- pencatat;
- dibuat pada;
- terakhir diubah pada.

## 11.4 Statistik Hari

Hitung tanggal unik per kategori.

Contoh:

```text
Hari Izin: 3
Hari Sakit: 4
Hari Tanpa Keterangan: 1
```

Jika satu tanggal mempunyai dua kategori, tanggal dapat dihitung pada dua kategori. Total hari tidak hadir terpisah tetap menghitung tanggal unik keseluruhan.

## 11.5 Statistik Jam

Hitung record per jam.

Contoh:

```text
Jam Izin: 8
Jam Sakit: 25
Jam Tanpa Keterangan: 2
```

## 11.6 Tren Bulanan Siswa

Mengikuti bulan kalender siswa.

Sumbu X:

```text
Tanggal
```

Sumbu Y:

```text
Jumlah jam
```

Tiga series:

- Izin;
- Sakit;
- Tanpa Keterangan.

Gunakan grouped bar atau stacked bar. Pilih yang paling mudah dibaca pada mobile dan desktop, lalu konsisten.

Klik tanggal kalender membuka rincian jam; grafik tidak perlu menjadi editor.

## 11.7 Edit Beberapa Jam

Hanya Admin.

Admin memilih beberapa jam pada satu siswa dan satu tanggal, lalu dapat:

- mengubah kategori;
- mengubah catatan;
- menambahkan record pada jam kosong;
- menghapus record.

Semua perubahan satu submit memakai service transaksi presensi yang sama dengan Input Presensi.

### Perbedaan dengan Input Presensi

| Input Presensi | Detail Siswa |
|---|---|
| Satu tanggal dan satu kelas | Satu siswa dan banyak tanggal |
| Banyak siswa | Satu siswa |
| Pekerjaan harian/bulk | Koreksi presisi |
| Seluruh kelas terlihat | Riwayat siswa terlihat |
| Bulk apply tersedia | Multi-jam satu siswa |

Tidak boleh ada dua implementasi backend yang berbeda. Keduanya memakai preview, conflict validation, transaction, revision, dan audit yang sama.

## 11.8 Laporan Individual

Admin dapat:

- membuka print view;
- mencetak;
- menyimpan sebagai PDF dari browser;
- mengekspor Excel.

Filter periode:

- minggu berjalan;
- bulan berjalan;
- semester;
- tanggal manual.

Isi laporan:

- identitas;
- grade dan kelas;
- periode;
- statistik hari;
- statistik jam;
- rincian tanggal;
- rincian jam;
- kategori;
- catatan.

Pengguna hanya melihat versi read-only dan tidak mempunyai tombol export.

## 11.9 Histori Perubahan

Tampilkan histori record presensi siswa:

- dibuat;
- diubah;
- dihapus;
- nilai sebelum;
- nilai sesudah;
- Admin;
- waktu.

Histori tidak dapat diedit.

---

# 12. Grade dan Kelas

## 12.1 Grade Tetap

```text
X
XI
XII
ALUMNI
```

Tidak dapat ditambah, diubah, atau dihapus.

## 12.2 Kelas Tetap

Slot kelas operasional:

```text
X-1 sampai X-10
XI-1 sampai XI-10
XII-1 sampai XII-10
```

Maksimal 30 slot per tahun ajaran.

Nama teknis tetap angka. Sekolah dapat memaknai 1–10 sebagai A–J secara internal tanpa mengubah struktur sistem.

Admin tidak dapat membuat kelas X-11 atau mengganti X-1 menjadi nama bebas.

## 12.3 Metadata Kelas

Admin dapat mengubah:

- wali kelas;
- status aktif/nonaktif;
- tahun ajaran;
- catatan internal opsional.

Nomor dan grade kelas tidak diedit sembarangan.

Kelas dibuat untuk setiap tahun ajaran agar sejarah tidak berubah ketika tahun berganti.

Unique constraint:

```text
academic_year_id + grade + class_number
```

## 12.4 Manajemen Kelas

Halaman menampilkan grid/tabel 30 slot:

- nama kelas;
- grade;
- nomor;
- tahun ajaran;
- wali kelas;
- jumlah siswa aktif;
- status aktif.

Admin dapat:

- mengaktifkan slot;
- menonaktifkan slot kosong;
- mengubah wali kelas;
- melihat anggota kelas.

Kelas yang pernah dipakai tidak dihapus permanen. Gunakan status nonaktif/arsip.

---

# 13. Manajemen Siswa

Hanya Admin.

## 13.1 Daftar

Filter:

- kata pencarian;
- grade;
- kelas;
- aktif/nonaktif;
- alumni;
- tahun masuk;
- tahun lulus.

## 13.2 Tambah Siswa

Field:

- nama lengkap;
- NIS;
- NISN;
- jenis kelamin L/P;
- grade;
- kelas;
- tahun masuk;
- status aktif.

Validasi:

- NIS unik;
- NISN unik;
- nama wajib;
- kelas harus sesuai grade;
- alumni tidak mempunyai kelas aktif;
- nilai dinormalisasi sebelum simpan.

## 13.3 Edit Siswa

Admin dapat mengubah:

### Identitas

- nama lengkap;
- NIS;
- NISN;
- jenis kelamin.

### Akademik

- grade;
- kelas;
- tahun masuk;
- tahun lulus;
- status aktif;
- status alumni.

### Perpindahan Kelas

Perubahan kelas:

- menutup enrollment lama;
- membuat enrollment baru;
- tidak mengubah class_id pada attendance lama;
- dicatat di audit log.

### Nonaktifkan

Nonaktifkan digunakan untuk siswa pindah/keluar/salah data yang tidak boleh muncul pada aktivitas harian.

Menonaktifkan siswa:

- tidak menghapus presensi;
- tidak menghapus histori kelas;
- menghilangkan siswa dari input presensi;
- dapat dibalik oleh Admin.

## 13.4 Tidak Ada Hard Delete Siswa Aktif

Siswa biasa tidak dihapus permanen dari halaman utama. Hard delete hanya melalui workflow alumni yang mempunyai konfirmasi kuat.

---

# 14. Import Siswa Per Kelas

Hanya Admin.

## 14.1 Alur

```text
Pilih tahun ajaran
→ Pilih grade
→ Pilih kelas
→ Download template
→ Upload CSV
→ Parse
→ Validasi seluruh baris
→ Preview
→ Konfirmasi
→ Simpan satu transaksi
```

## 14.2 Template

```csv
NIS,NISN,NAMA,JENIS_KELAMIN
10001,0091234567,Nabila Putri,P
10002,0091234568,Ahmad Fauzan,L
```

Grade dan kelas tidak ditulis per row karena dipilih sebelum upload.

## 14.3 Parser

Gunakan parser CSV yang benar, bukan split manual.

Harus menangani:

- quoted fields;
- BOM UTF-8;
- koma di dalam nama bila dikutip;
- CRLF/LF;
- header case normalization.

## 14.4 Validasi

Per baris:

- kolom wajib;
- NIS tidak kosong;
- NISN tidak kosong;
- nama tidak kosong;
- jenis kelamin L/P;
- NIS tidak duplikat di file;
- NISN tidak duplikat di file;
- NIS tidak duplikat database;
- NISN tidak duplikat database;
- panjang field;
- karakter kontrol.

File:

- CSV saja;
- maksimal 2 MB;
- maksimal 100 siswa per kelas;
- tidak ada formula execution;
- filename disanitasi.

## 14.5 Preview

Tampilkan semua row dan hasil validasi.

| Baris | NIS | Nama | Status | Keterangan |
|---:|---|---|---|---|
| 2 | 10001 | Nabila | Valid | Siap diimport |
| 3 | 10002 | Ahmad | Gagal | NIS sudah digunakan |

Belum ada write database pada tahap preview.

Import hanya dapat dilanjutkan apabila semua row valid.

## 14.6 Transaction

Seluruh row disimpan atau seluruhnya rollback.

Import menulis:

- students;
- enrollment kelas;
- import batch;
- audit log.

## 14.7 Hasil

```text
Import berhasil
Kelas: X-1
Siswa baru: 35
Gagal: 0
```

Mode awal hanya membuat siswa baru. Update siswa melalui CSV menjadi fitur terpisah di masa depan.

## 14.8 Adapter Data Siswa Existing

Data siswa awal sudah tersedia di folder proyek, tetapi formatnya mungkin tidak sama dengan template CSV resmi SIPEKA. Data existing diperlakukan sebagai **sumber migrasi satu kali**, bukan sebagai perubahan terhadap format import resmi pengguna.

Codex harus:

1. Mendeteksi tipe file, misalnya CSV, XLSX, XLS, ODS, atau format teks lain.
2. Mendeteksi sheet, header, delimiter, encoding, dan variasi nama kolom.
3. Membuat dokumen `docs/student-data-mapping.md` yang memetakan kolom sumber ke model tujuan.
4. Menyediakan adapter terpisah pada tooling migrasi, misalnya:

```text
tools/student-migration/
├── inspect-source.ts
├── source-adapter.ts
├── normalize-student-row.ts
├── validate-student-row.ts
├── generate-migration-report.ts
└── import-students.ts
```

5. Menormalisasi nilai tanpa mengubah file asli, termasuk spasi, kapitalisasi, NIS/NISN yang terbaca sebagai angka, jenis kelamin, grade, dan kelas.
6. Menghasilkan preview serta laporan error per baris sebelum ada write database.
7. Menolak import apabila terdapat mapping ambigu, NIS/NISN duplikat, kelas tidak dikenali, atau row invalid.
8. Menjalankan import final dalam satu transaksi.
9. Menyimpan file sumber di luar `public/` dan tidak mengirimkannya ke browser.
10. Tidak menampilkan nama, NIS, atau NISN lengkap dalam log Codex dan CI.

Template import resmi pada aplikasi tetap mengikuti bagian 14.2. Adapter existing hanya untuk migrasi awal dan tidak boleh memperumit UI import harian.

---

# 15. Naik Grade, Turun Grade, dan Rollback

## 15.1 Naik Grade Massal

```text
X → XI
XI → XII
XII → ALUMNI
```

Nomor kelas dipertahankan:

```text
X-1 → XI-1
XI-3 → XII-3
XII-5 → ALUMNI
```

Alumni:

- grade ALUMNI;
- current class null;
- graduation year terisi;
- kelas terakhir tetap ada di history.

## 15.2 Prasyarat

- tahun ajaran tujuan tersedia;
- kelas target 1–10 dibuat/diaktifkan;
- tidak ada promotion batch aktif yang belum diselesaikan;
- preview berhasil;
- actor Admin.

## 15.3 Preview

Tampilkan:

```text
X → XI: 320 siswa
XI → XII: 315 siswa
XII → Alumni: 308 siswa
```

Tampilkan siswa yang tidak dapat diproses beserta alasan.

## 15.4 Transaction

Satu transaction:

- buat promotion batch;
- simpan before/after item setiap siswa;
- tutup enrollment lama;
- buat enrollment baru;
- update current grade/class;
- ubah XII menjadi alumni;
- tulis audit log.

## 15.5 Batalkan Kenaikan

Setiap batch menyimpan snapshot before/after.

Admin dapat memilih batch dan menjalankan rollback.

Rollback mengembalikan tepat data sebelumnya, bukan menurunkan semua siswa secara umum.

Contoh:

```text
XI-1 → X-1
XII-3 → XI-3
ALUMNI → XII-5
```

Rollback hanya boleh bila:

- batch belum pernah direvert;
- tidak ada batch lebih baru yang bergantung padanya;
- affected students tidak mempunyai perubahan enrollment yang membuat rollback ambigu;
- preview rollback berhasil.

Jika syarat gagal, sistem memblokir rollback batch dan mengarahkan ke koreksi individual.

## 15.6 Turun/Koreksi Grade Individual

Admin dapat mengoreksi satu siswa:

- grade;
- kelas;
- status alumni.

Digunakan untuk kesalahan individual.

Perubahan:

- wajib sesuai constraint kelas/grade;
- membuat enrollment history;
- tidak mengubah presensi lama;
- dicatat di audit log.

## 15.7 Menu

```text
Naik/Turun Grade
├── Jalankan Naik Grade
├── Riwayat Batch
├── Batalkan Batch
└── Koreksi Individual
```

---

# 16. Alumni

## 16.1 Perilaku

Alumni tidak muncul pada:

- input presensi;
- dashboard;
- pencarian siswa aktif default;
- statistik siswa aktif.

Alumni dapat dicari melalui filter.

## 16.2 Arsipkan

Arsipkan alumni:

- menyembunyikan dari penggunaan harian;
- mempertahankan profil;
- mempertahankan attendance;
- mempertahankan laporan;
- mempertahankan audit.

## 16.3 Hapus Permanen

Hanya Admin.

Sebelum delete tampilkan:

- jumlah alumni;
- tahun kelulusan;
- jumlah attendance terkait;
- jumlah revision terkait;
- dampak penghapusan;
- rekomendasi export terlebih dahulu.

Konfirmasi kuat:

- pilih batch/filter;
- preview;
- ketik teks konfirmasi;
- submit ulang.

Penghapusan transaction dan audit entry tetap disimpan dalam bentuk snapshot non-PII seperlunya.

---

# 17. Laporan dan Export

## 17.1 Halaman Laporan

Admin dan Pengguna dapat melihat laporan read-only. Hanya Admin dapat download/export.

Filter:

- tanggal awal/akhir;
- grade;
- kelas;
- siswa;
- kategori;
- tahun ajaran.

Preview:

- jumlah siswa unik;
- jumlah hari;
- jumlah record jam;
- jumlah per kategori;
- jumlah row yang akan diekspor.

## 17.2 Excel

Kolom:

- tanggal;
- hari;
- jam;
- NIS;
- NISN;
- nama;
- grade;
- kelas;
- kategori;
- catatan;
- pencatat;
- waktu input;
- waktu perubahan terakhir.

Amankan formula injection pada nilai yang diawali:

```text
=
+
-
@
```

## 17.3 Audit Export

Export massal oleh Admin dicatat:

- actor;
- filter;
- jumlah row;
- waktu;
- format file.

Jangan menyimpan file export di database secara default.

---

# 18. Audit Log Operasional

Hanya Admin.

## 18.1 Scope

Mencatat seluruh mutasi operasional:

- tambah/edit/nonaktifkan siswa;
- import;
- perubahan kelas;
- input/edit/delete attendance;
- naik grade;
- rollback grade;
- koreksi grade individual;
- arsip/hapus alumni;
- export massal;
- perubahan konfigurasi operasional.

## 18.2 Data

- actor id dan nama snapshot;
- role snapshot;
- action;
- entity type;
- entity id;
- before JSON;
- after JSON;
- batch/request id;
- created_at;
- metadata teknis yang tidak sensitif.

## 18.3 UI

Menu: **Riwayat Aktivitas**.

Filter:

- tanggal;
- Admin;
- tindakan;
- entity;
- kata pencarian;
- batch id.

Fitur:

- pagination;
- detail drawer;
- tampilan perbedaan before/after;
- tidak dapat diedit/dihapus.

Audit log tidak muncul pada dashboard.

---

# 19. PWA Online-Only

## 19.1 Tujuan

PWA digunakan agar SIPEKA:

- dapat diinstal;
- memiliki ikon;
- berjalan standalone;
- mempunyai splash screen;
- terasa seperti aplikasi.

PWA bukan untuk penggunaan offline.

## 19.2 Offline Behavior

Ketika offline, seluruh aplikasi tidak dapat digunakan.

Tampilkan hanya:

```text
SIPEKA membutuhkan koneksi internet.
Periksa koneksi Anda, kemudian coba kembali.
[Coba Lagi]
```

Tidak boleh menampilkan data siswa atau dashboard dari cache lama.

## 19.3 Caching

Boleh cache minimum:

- manifest;
- ikon;
- logo;
- aset offline page;
- service worker runtime minimum.

Gunakan network-only untuk:

- document navigation aplikasi;
- API;
- Server Action;
- data siswa;
- dashboard;
- attendance;
- account portal;
- laporan.

Tidak ada:

- background sync;
- offline mutation queue;
- stale data fallback;
- cache API sensitif.

## 19.4 Manifest

```text
name: SIPEKA — Sistem Presensi SMANSA Pamekasan
short_name: SIPEKA
display: standalone
start_url: /
```

Shortcut dapat memuat:

- Dashboard;
- Cari Siswa;
- Input Presensi.

Route tetap memeriksa role.

## 19.5 Update

Saat service worker baru tersedia:

- tampilkan pemberitahuan update;
- jangan refresh paksa ketika form attendance memiliki draft;
- user dapat memilih Perbarui Sekarang.

---

# 20. Arsitektur Teknis

## 20.1 Stack

- Next.js App Router;
- TypeScript strict;
- React;
- Tailwind CSS;
- shadcn/ui;
- Zod;
- React Hook Form;
- Recharts;
- Supabase PostgreSQL;
- Supabase Auth;
- Supabase RLS;
- Supabase database functions/RPC;
- ExcelJS;
- Serwist;
- Vitest;
- React Testing Library;
- Playwright;
- Vercel;
- GitHub Actions.

Tidak menggunakan Prisma.

## 20.2 Rendering

- Server Components untuk layout, initial data, dan read-only page utama.
- Client Components hanya untuk interaksi kalender, chart, form, modal, selection, dan PWA.
- Route Handlers/Server Actions harus tipis.
- Semua business rule berada di application/domain service.

## 20.3 Dependency Flow

```text
Presentation
→ Application
→ Domain
→ Repository interface
→ Infrastructure implementation
```

Infrastructure tidak boleh mengimpor Presentation.

Domain tidak boleh mengimpor Next.js, React, atau Supabase.

## 20.4 Module Public API

Setiap module mempunyai `index.ts` sebagai public API.

Cross-module import hanya melalui public API, bukan deep import.

Gunakan ESLint boundary/no-restricted-imports untuk menegakkan aturan.

---

# 21. Struktur Repository

```text
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   └── offline/page.tsx
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── change-password/page.tsx
│   ├── (operational)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── presensi/input/page.tsx
│   │   ├── siswa/page.tsx
│   │   ├── siswa/[id]/page.tsx
│   │   ├── manajemen-siswa/page.tsx
│   │   ├── manajemen-kelas/page.tsx
│   │   ├── import-siswa/page.tsx
│   │   ├── grade/page.tsx
│   │   ├── alumni/page.tsx
│   │   ├── laporan/page.tsx
│   │   └── riwayat-aktivitas/page.tsx
│   ├── (super-admin)/
│   │   ├── layout.tsx
│   │   └── super-admin/
│   ├── api/
│   │   ├── auth/
│   │   ├── accounts/
│   │   ├── exports/
│   │   └── health/
│   ├── manifest.ts
│   └── sw.ts
│
├── modules/
│   ├── authentication/
│   ├── authorization/
│   ├── account-management/
│   ├── dashboard/
│   ├── attendance/
│   ├── students/
│   ├── classes/
│   ├── academic-years/
│   ├── imports/
│   ├── grade-management/
│   ├── alumni/
│   ├── reports/
│   └── audit/
│
├── shared/
│   ├── components/
│   ├── charts/
│   ├── forms/
│   ├── tables/
│   ├── validation/
│   ├── dates/
│   ├── errors/
│   ├── logging/
│   ├── permissions/
│   ├── constants/
│   └── types/
│
├── infrastructure/
│   ├── supabase/
│   │   ├── browser.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   └── middleware.ts
│   ├── database/
│   ├── rate-limit/
│   ├── monitoring/
│   └── pwa/
│
└── test/
    ├── factories/
    ├── helpers/
    └── fixtures/

supabase/
├── migrations/
├── seed.sql
├── tests/
│   ├── rls/
│   ├── functions/
│   └── constraints/
└── config.toml

docs/
├── implementation-plan.md
├── architecture.md
├── data-model.md
├── security.md
├── runbook.md
└── adr/

public/
├── icons/
├── images/
└── brand/

AGENTS.md
.env.example
```

## 21.1 Struktur Module

```text
modules/attendance/
├── domain/
│   ├── attendance.entity.ts
│   ├── attendance.types.ts
│   ├── attendance.constants.ts
│   ├── attendance.rules.ts
│   └── attendance.repository.ts
├── application/
│   ├── preview-attendance.ts
│   ├── save-attendance-batch.ts
│   ├── get-class-attendance.ts
│   ├── get-student-attendance.ts
│   └── calculate-attendance-statistics.ts
├── infrastructure/
│   ├── supabase-attendance.repository.ts
│   ├── attendance.queries.ts
│   └── attendance.rpc.ts
├── presentation/
│   ├── components/
│   ├── hooks/
│   ├── actions/
│   └── schemas/
├── tests/
└── index.ts
```

---

# 22. Database Design

## 22.1 Enums

```text
app_role: SUPER_ADMIN | ADMIN | USER
grade_level: X | XI | XII | ALUMNI
attendance_status: IZIN | SAKIT | TANPA_KETERANGAN
gender: L | P
audit_scope: OPERATIONAL | ACCOUNT
revision_operation: CREATE | UPDATE | DELETE
batch_status: PREVIEWED | COMPLETED | REVERTED | FAILED
```

## 22.2 profiles

```text
id uuid PK → auth.users.id
username text unique not null
email text unique
full_name text not null
role app_role not null
is_active boolean not null default true
must_change_password boolean not null default false
last_login_at timestamptz
created_by uuid nullable
created_at timestamptz
updated_at timestamptz
```

## 22.3 academic_years

```text
id uuid PK
name text unique
start_date date
end_date date
is_active boolean
created_at timestamptz
```

Constraint hanya satu active academic year.

## 22.4 classes

```text
id uuid PK
academic_year_id uuid FK
grade grade_level check grade != ALUMNI
class_number smallint check 1..10
homeroom_teacher text nullable
is_active boolean default true
notes text nullable
created_at timestamptz
updated_at timestamptz
```

Unique:

```text
(academic_year_id, grade, class_number)
```

Nama UI diturunkan dari grade dan nomor.

## 22.5 students

```text
id uuid PK
nis text unique not null
nisn text unique not null
full_name text not null
normalized_name text not null
gender gender not null
current_grade grade_level not null
current_class_id uuid nullable FK classes
year_entered integer nullable
graduation_year integer nullable
is_active boolean default true
archived_at timestamptz nullable
created_by uuid
updated_by uuid
created_at timestamptz
updated_at timestamptz
```

## 22.6 student_enrollments

```text
id uuid PK
student_id uuid FK
academic_year_id uuid FK
class_id uuid nullable FK
grade grade_level
started_on date
ended_on date nullable
is_current boolean
created_by uuid
created_at timestamptz
```

Constraint satu current enrollment per student.

## 22.7 periods

```text
number smallint PK check 1..10
label text
is_active boolean default true
```

Seed 1–10.

## 22.8 attendance_records

```text
id uuid PK
student_id uuid FK
class_id uuid FK
attendance_date date not null
period_number smallint FK periods
status attendance_status not null
note text nullable
created_by uuid FK profiles
updated_by uuid FK profiles
version integer default 1
created_at timestamptz
updated_at timestamptz
```

Unique wajib:

```text
(student_id, attendance_date, period_number)
```

Attendance menyimpan class_id saat pencatatan agar statistik historis tidak berubah setelah siswa pindah kelas.

## 22.9 attendance_revisions

```text
id uuid PK
attendance_id uuid nullable
student_id uuid
operation revision_operation
before_data jsonb nullable
after_data jsonb nullable
actor_id uuid
request_id uuid
created_at timestamptz
```

## 22.10 audit_logs

```text
id uuid PK
scope audit_scope
actor_id uuid nullable
actor_name_snapshot text
action text
entity_type text
entity_id text nullable
before_data jsonb nullable
after_data jsonb nullable
metadata jsonb
request_id uuid
created_at timestamptz
```

Append-only.

## 22.11 attendance_batches

Menyimpan metadata submit presensi dan summary.

## 22.12 import_batches

```text
id
class_id
file_name
row_count
summary jsonb
status
created_by
created_at
```

## 22.13 promotion_batches

```text
id
from_academic_year_id
to_academic_year_id
status
created_by
reverted_by
created_at
reverted_at
```

## 22.14 promotion_batch_items

```text
batch_id
student_id
before_grade
before_class_id
before_enrollment_id
after_grade
after_class_id
after_enrollment_id
```

## 22.15 Indexes

Minimal:

- students normalized_name trigram;
- students nis;
- students nisn;
- students current_grade/current_class_id/is_active;
- attendance attendance_date;
- attendance class_id/date;
- attendance student_id/date;
- audit created_at/action/entity;
- enrollment student/current.

---

# 23. RLS dan Authorization

RLS aktif pada seluruh tabel exposed.

## 23.1 Helper Role

Buat helper database aman untuk membaca role current user.

Jika memakai security definer:

- set `search_path = ''`;
- gunakan nama schema penuh;
- batasi execute privilege;
- test recursion dan privilege escalation.

## 23.2 Policy Matrix

### Operational tables

| Role | SELECT | INSERT | UPDATE | DELETE |
|---|---:|---:|---:|---:|
| SUPER_ADMIN | Tidak | Tidak | Tidak | Tidak |
| ADMIN | Ya | Ya sesuai policy | Ya sesuai policy | Via service/RPC |
| USER | Ya | Tidak | Tidak | Tidak |
| anon | Tidak | Tidak | Tidak | Tidak |

### audit_logs operational

- Admin SELECT.
- User tidak.
- Super Admin tidak.
- Client tidak boleh insert langsung.
- Hanya transaction function/server service.

### profiles

- setiap akun dapat membaca profil sendiri;
- Admin/User tidak dapat mengubah role;
- Super Admin management lewat server-only admin client;
- jangan expose daftar account ke operational client.

### account audit

- hanya Super Admin melalui portal server;
- tidak dapat diubah/hapus.

## 23.3 Defense in Depth

Setiap write memerlukan:

1. session valid;
2. profile aktif;
3. role Admin;
4. server validation;
5. database policy/function check;
6. constraint database;
7. audit.

---

# 24. Database Functions / RPC

## 24.1 save_attendance_batch

Input JSON terstruktur.

Tanggung jawab:

- authorization;
- validation;
- concurrency;
- upsert/delete;
- revision;
- audit;
- summary;
- atomic transaction.

## 24.2 import_students_batch

- validate class/grade/year;
- recheck duplicates;
- insert students;
- insert enrollments;
- insert batch/audit;
- rollback on one failure.

## 24.3 execute_promotion_batch

- validate target year/classes;
- lock relevant students;
- create snapshots;
- update enrollment/current state;
- audit.

## 24.4 rollback_promotion_batch

- validate batch;
- detect later changes;
- restore snapshots;
- mark reverted;
- audit.

## 24.5 archive_alumni_batch / delete_alumni_batch

- preview separately;
- execute only after confirmation token;
- transaction;
- audit.

## 24.6 Function Security

- prefer security invoker bila memadai;
- security definer hanya jika diperlukan;
- explicit schema;
- revoke execute by default;
- grant hanya function yang diperlukan;
- test unauthorized invocation.

---

# 25. Application Services

Minimal services:

```text
authenticateUser
requireSession
requireRole
createAccount
resetAccountPassword
revokeAccountSessions
getDashboardSummary
getDailyClassStatistics
getWeeklyCategoryStatistics
getMonthlyAbsenceStatistics
searchStudents
getStudentDetail
getStudentMonthlyTrend
previewAttendanceBatch
saveAttendanceBatch
createStudent
updateStudent
changeStudentEnrollment
parseStudentCsv
validateStudentImport
executeStudentImport
previewPromotion
executePromotion
previewPromotionRollback
rollbackPromotion
archiveAlumni
previewAlumniDeletion
deleteAlumni
buildAttendanceReport
writeAuditLog
```

Setiap service:

- menerima typed input;
- tidak bergantung pada React;
- mengembalikan typed result/error;
- mempunyai unit/integration test;
- tidak mengakses environment langsung selain melalui configuration module.

---

# 26. Error Model

Gunakan error code konsisten:

```text
UNAUTHENTICATED
FORBIDDEN
ACCOUNT_INACTIVE
VALIDATION_ERROR
NOT_FOUND
DUPLICATE_NIS
DUPLICATE_NISN
ATTENDANCE_CONFLICT
STALE_PREVIEW
FUTURE_DATE_NOT_ALLOWED
GRADE_CLASS_MISMATCH
IMPORT_INVALID
PROMOTION_NOT_REVERSIBLE
TRANSACTION_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

UI memetakan code ke pesan Bahasa Indonesia.

Jangan mengirim stack trace atau SQL error ke browser.

---

# 27. Security Plan

## 27.1 Secrets

- `.env.example` placeholder saja.
- Tidak ada kunci di Git.
- Service role hanya server-side.
- File `admin.ts` diberi `server-only`.
- Jangan import admin client dari Client Component.
- Pisahkan environment development/staging/production.

## 27.2 Headers

- Content-Security-Policy;
- Strict-Transport-Security;
- X-Content-Type-Options;
- Referrer-Policy;
- Permissions-Policy;
- frame-ancestors yang sesuai.

## 27.3 Rate Limit

Minimal:

- login;
- reset password;
- create/delete account;
- import;
- export;
- promotion;
- alumni permanent delete.

## 27.4 Data Exposure

- DTO/select column eksplisit;
- jangan `select *` pada endpoint sensitif;
- NISN hanya dikirim ketika diperlukan;
- no-store untuk halaman/data protected;
- no sensitive client logging.

## 27.5 CSV/Excel

- validate MIME dan extension;
- batas ukuran;
- sanitasi filename;
- formula injection protection;
- tidak menyimpan upload mentah kecuali diperlukan.

## 27.6 Build

- production source maps dimatikan;
- dependency audit;
- lint dangerous patterns;
- secret scanning;
- branch protection.

---

# 28. UI/UX dan Accessibility

## 28.1 Responsive

- desktop sidebar;
- mobile drawer/bottom navigation sesuai kebutuhan;
- table berubah menjadi cards pada mobile bila kompleks;
- chart horizontal scroll hanya sebagai fallback.

## 28.2 Bahasa

Semua label pengguna dalam Bahasa Indonesia.

Internal code boleh berbahasa Inggris.

## 28.3 Accessibility

- keyboard navigation;
- visible focus;
- semantic buttons;
- label form;
- aria-live untuk hasil save;
- kontras WCAG AA;
- chart mempunyai summary text/table alternatif;
- modal focus trap.

## 28.4 Destructive Actions

- confirm dialog;
- preview dampak;
- typed confirmation untuk batch besar;
- disabled during submission;
- idempotency/request id.

---

# 29. Testing Strategy

## 29.1 Unit

- date/week/month calculation WIB;
- unique student aggregation;
- mixed-category behavior;
- attendance preview diff;
- class/grade rules;
- promotion mapping;
- import validation;
- search normalization;
- permission helpers.

## 29.2 Database

- unique attendance constraint;
- NIS/NISN constraint;
- class number constraint;
- one active academic year;
- one current enrollment;
- RLS matrix;
- unauthorized RPC;
- transaction rollback;
- audit append-only;
- promotion rollback.

## 29.3 Integration

- login/session;
- inactive account;
- Admin CRUD;
- User read-only rejection;
- Super Admin isolated portal;
- batch attendance;
- import;
- reports;
- account management.

## 29.4 E2E

Minimal Playwright:

1. Landing → login.
2. Admin login.
3. Dashboard date selection.
4. Search partial `nabil`.
5. Input multiple students with different categories/hours.
6. Conflict preview.
7. Save and verify detail.
8. Edit multiple hours on student detail.
9. User cannot see mutation menu.
10. User mutation request returns forbidden.
11. Super Admin only sees account portal.
12. Super Admin creates Admin and resets password.
13. Import valid class.
14. Import invalid row blocks all writes.
15. Promotion and rollback.
16. Offline screen blocks app.

## 29.5 CI Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:e2e
npm run build
```

---

# 30. Observability dan Debugging

## 30.1 Structured Logs

Log teknis server:

- request id;
- user id hashed/UUID;
- route/action;
- duration;
- result code;
- non-sensitive metadata.

Jangan log password, token, NISN penuh, atau file import penuh.

## 30.2 Error Monitoring

Gunakan Vercel logs. Sentry opsional bila dibutuhkan.

## 30.3 Health

Endpoint server-only/public minimal `/api/health` tanpa data sensitif:

- app status;
- build version;
- database connectivity status ringkas.

## 30.4 Audit vs Technical Log

- audit log = bukti perubahan bisnis;
- technical log = debugging sistem.

Keduanya tidak dicampur.

---

# 31. Environment dan Deployment

## 31.1 Environments

```text
Local development
Staging/preview
Production
```

Gunakan Supabase project terpisah untuk production. Jangan memakai data siswa production di local/staging.

## 31.2 Environment Variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
APP_TIMEZONE=Asia/Jakarta
RATE_LIMIT_SECRET
```

Nama final mengikuti versi key Supabase yang digunakan ketika setup.

## 31.3 Vercel

- production branch `main`;
- preview deployment untuk PR;
- preview protection bila tersedia;
- environment variable per environment;
- region dekat Supabase;
- custom domain setelah staging stabil.

## 31.4 Database Deployment

Migration adalah source of truth.

Aturan:

- migration yang sudah merge tidak diedit;
- perubahan baru = migration baru;
- CI menjalankan database reset dari nol;
- staging migration sebelum production;
- backup sebelum migration destructive.

---

# 32. Migrasi dari Sistem Lama

Migrasi dilakukan setelah versi baru stabil.

## 32.1 Prinsip

- gunakan file data siswa existing di folder proyek sebagai salah satu sumber migrasi bila sudah diverifikasi;
- database lama read-only saat export;
- file sumber lama juga diperlakukan read-only;
- jangan menggunakan secret lama;
- akun lama tidak membawa password;
- buat akun baru melalui Super Admin;
- validasi data sebelum import;
- jangan menaruh data sumber di Git, `public/`, artifact CI, atau deployment Vercel;
- semua mapping format didokumentasikan;
- semua contoh dokumentasi dan test harus menggunakan data sintetis atau nilai yang disensor.

## 32.2 Mapping Status

```text
izin → IZIN
sakit → SAKIT
bolos → TANPA_KETERANGAN
```

Status lain masuk exception report dan tidak diimport otomatis tanpa keputusan.

## 32.3 Mapping Kelas

Buat mapping eksplisit kelas lama ke slot baru X-1..X-10, XI-1..XI-10, XII-1..XII-10.

Jangan menebak otomatis apabila mapping ambigu.

## 32.4 Verification

Bandingkan:

- jumlah siswa;
- jumlah kelas;
- jumlah attendance;
- unique student/date/period;
- duplicate NIS/NISN;
- sample laporan;
- timezone tanggal.

Buat migration report dan rollback plan.

---

# 33. Tahapan Implementasi

## Phase 0 — Governance dan Scaffold

Deliverables:

- repository baru;
- `AGENTS.md`;
- plan di `docs/implementation-plan.md`;
- ADR awal;
- inventory logo, gambar hero, dan data siswa existing;
- `docs/existing-materials-inventory.md`;
- draft `docs/student-data-mapping.md` tanpa membocorkan data pribadi;
- aturan `.gitignore` untuk data siswa dan file migrasi sensitif;
- Next.js + TypeScript strict;
- lint/format/typecheck;
- test runner;
- GitHub Actions;
- placeholder env;
- branch protection guidance.

Acceptance:

- app kosong build;
- CI hijau;
- tidak ada secret;
- folder boundary aktif;
- aset existing sudah ditemukan atau statusnya terdokumentasi;
- tidak ada data siswa nyata yang masuk client bundle, `public/`, fixture, log, atau Git baru;
- format data existing telah diinventarisasi tanpa melakukan import production.

## Phase 1 — Database, Auth, RLS

Deliverables:

- Supabase local;
- enums/tables/index/constraints;
- seed periods/classes/test accounts;
- Supabase SSR client;
- profile/role;
- login/logout/change password;
- route guards;
- RLS tests;
- Super Admin isolation.

Acceptance:

- role matrix lulus;
- User tidak dapat write via direct API;
- Super Admin tidak dapat select operational tables;
- service role tidak ada di client bundle.

## Phase 2 — Landing, Layout, Account Portal

Deliverables:

- integrasi logo SMANSA existing;
- integrasi gambar hero existing sebagai background;
- optimasi aset web dan dokumentasi file turunan;
- landing hero background;
- overview;
- login UI;
- operational layout;
- Super Admin layout;
- account list/create/edit/reset/deactivate/delete;
- account audit.

Acceptance:

- role redirect benar;
- reset password memaksa change;
- account mutation diaudit.

## Phase 3 — Academic Year, Classes, Students, Search

Deliverables:

- active academic year;
- fixed class slots;
- class metadata;
- student CRUD/soft state;
- enrollment history;
- partial search;
- filters/pagination;
- read-only user views.

Acceptance:

- class/grade mismatch ditolak;
- NIS/NISN duplicate ditolak;
- `nabil` menemukan `Nabila`;
- User tidak melihat edit.

## Phase 4 — Attendance Core dan Input

Deliverables:

- attendance schema/constraint;
- preview diff;
- class/date input;
- per-student different category/hour/note;
- bulk actions;
- all hours;
- conflict/stale validation;
- transaction RPC;
- revisions/audit.

Acceptance:

- no duplicate student/date/period;
- partial failure rollback;
- concurrent stale preview diblokir;
- all hours menghasilkan 10 record aktif.

## Phase 5 — Dashboard

Deliverables:

- selected date calendar;
- summary;
- daily grouped chart;
- weekly grouped chart;
- monthly single-series chart;
- widget-level loading/error.

Acceptance:

- unique student counts;
- no today button;
- no attendance dots;
- no activity feed;
- timezone tests.

## Phase 6 — Student Detail dan Reports

Deliverables:

- student calendar;
- per-hour detail;
- day/hour stats;
- monthly category trend;
- multi-hour edit;
- revision history;
- individual print/Excel;
- reports page/export.

Acceptance:

- detail edit uses same attendance service;
- User cannot mutate/export;
- export formula-safe.

## Phase 7 — Import, Grade, Alumni

Deliverables:

- CSV template/parser/preview;
- adapter format data siswa existing;
- mapping dan normalization report;
- dry-run migrasi tanpa write;
- transaction import;
- promotion preview/execute;
- batch history;
- rollback;
- individual grade correction;
- archive/permanent alumni delete.

Acceptance:

- invalid import writes zero rows;
- promotion preserves class number;
- rollback restores exact snapshot;
- destructive delete has strong confirmation.

## Phase 8 — Audit UI, PWA, Security Hardening

Deliverables:

- operational audit page;
- filters/detail diff;
- PWA manifest/icons;
- online-only service worker;
- offline blocker;
- headers;
- rate limits;
- security tests;
- accessibility pass.

Acceptance:

- offline data inaccessible;
- audit not on dashboard;
- security headers present;
- no protected response cached.

## Phase 9 — Migration, Staging, Production

Deliverables:

- migration scripts;
- dry run report;
- staging UAT;
- production Supabase/Vercel;
- backup/restore runbook;
- monitoring;
- admin training notes.

Acceptance:

- count reconciliation;
- UAT signed off;
- restore tested;
- old credentials rotated;
- production smoke tests pass.

---

# 34. Codex Execution Protocol

Jangan meminta Codex membangun semua fase dalam satu task.

Gunakan pola:

1. Berikan repository dan dokumen ini.
2. Minta Codex membaca `AGENTS.md` dan plan.
3. Tunjuk satu phase.
4. Minta Codex menulis task breakdown sebelum code.
5. Minta implementasi kecil per commit.
6. Wajib menjalankan test.
7. Review diff.
8. Baru lanjut phase berikutnya.

## 34.1 AGENTS.md Minimum

```markdown
# SIPEKA Engineering Rules

- Read docs/implementation-plan.md before changing code.
- Do not change product requirements without explicit approval.
- Keep domain/application/infrastructure/presentation boundaries.
- React components must not contain database queries or business rules.
- All operational writes require Admin authorization, validation, transaction, and audit.
- USER is read-only. SUPER_ADMIN cannot access operational data.
- Never expose service-role credentials to the client.
- Do not edit merged migrations; create new migrations.
- Never commit secrets or real student data.
- Add or update tests for every behavior change.
- Run lint, typecheck, tests, and build before declaring completion.
- Report changed files, commands run, test results, and remaining risks.
```

## 34.2 Prompt Kickoff Codex

```text
Read AGENTS.md and docs/implementation-plan.md completely.

We are starting Phase 0 only. Do not implement later phases.
First inspect the repository, including existing logo, hero image, and student-data files. Produce a concise task breakdown for Phase 0. After that, implement the scaffold, architecture boundaries, lint/typecheck/test/build scripts, CI, documentation structure, asset/data inventory, and placeholder environment configuration.

Constraints:
- Next.js App Router and TypeScript strict.
- No Prisma.
- No secrets or real student data may be copied into the new repository, public folder, fixtures, logs, or CI artifacts.
- Existing source assets and student data are read-only during Phase 0. Inventory them without importing production data.
- Preserve the architecture in the implementation plan.
- Add tests/configuration needed to prove the scaffold works.
- Run lint, typecheck, test, and build.

At the end, report:
1. files changed;
2. commands run;
3. test/build results;
4. architectural decisions;
5. risks or TODOs restricted to Phase 0.
```

## 34.3 Prompt Template Fase Berikutnya

```text
Read AGENTS.md and docs/implementation-plan.md.
Implement Phase <N>: <NAME> only.

Before coding:
- inspect the existing implementation;
- list the acceptance criteria from the plan;
- provide a task breakdown;
- identify migrations, RLS policies, tests, and UI changes required.

During implementation:
- preserve module boundaries;
- keep route handlers/actions thin;
- put business rules in domain/application services;
- write migrations and tests together;
- do not expand scope.

Before finishing:
- run lint, typecheck, unit tests, database/RLS tests, relevant E2E tests, and build;
- fix failures;
- summarize changed files, test results, and remaining risks.
```

---

# 35. Definition of Done

Satu feature dianggap selesai hanya bila:

- acceptance criteria terpenuhi;
- role enforcement ada di server dan database;
- loading/error/empty state tersedia;
- mobile dan desktop diuji;
- validation server dan client tersedia;
- audit tersedia untuk mutasi;
- migration tersedia;
- unit/integration/RLS test tersedia;
- tidak ada lint/type error;
- build production berhasil;
- dokumentasi diperbarui;
- tidak ada secret;
- tidak ada TODO tanpa issue/backlog yang jelas.

Project production-ready bila:

- seluruh phase selesai;
- UAT selesai;
- security review selesai;
- backup dan restore diuji;
- migration dry run berhasil;
- data reconciliation berhasil;
- domain production dan HTTPS aktif;
- monitoring aktif;
- akun default tidak ada;
- Super Admin bootstrap aman;
- data nyata tidak pernah masuk development.

---

# 36. Acceptance Checklist Produk Final

## Branding

- [ ] Nama SIPEKA benar.
- [ ] Logo SMANSA tampil.
- [ ] Hero memakai background image.
- [ ] Tombol Mulai dan Pelajari Lebih Lanjut bekerja.
- [ ] Overview tidak menampilkan PWA.

## Roles

- [ ] Super Admin hanya portal account.
- [ ] Admin dapat seluruh operasional.
- [ ] Pengguna read-only.
- [ ] Direct unauthorized request tetap ditolak.

## Dashboard

- [ ] Kalender prev/next.
- [ ] Penanda hari ini dan selected date.
- [ ] Tidak ada tombol hari ini.
- [ ] Tidak ada attendance dots.
- [ ] Daily chart per kelas 3 kategori.
- [ ] Weekly chart per hari 3 kategori.
- [ ] Monthly chart total siswa unik.
- [ ] Tidak ada activity feed.

## Attendance

- [ ] Banyak siswa satu kelas.
- [ ] Kategori berbeda per siswa.
- [ ] Jam berbeda per siswa.
- [ ] Semua Jam.
- [ ] Bulk apply.
- [ ] Search partial dalam kelas.
- [ ] Preview conflict.
- [ ] Atomic transaction.
- [ ] Audit/revision.

## Students

- [ ] Search partial seluruh sekolah.
- [ ] Grade/class filters opsional.
- [ ] Detail kalender.
- [ ] Per-hour detail.
- [ ] Day/hour stats.
- [ ] Monthly category trend.
- [ ] Multi-hour edit.
- [ ] Individual report.

## Academic

- [ ] Grade fixed X/XI/XII/ALUMNI.
- [ ] Kelas fixed 1–10 per grade.
- [ ] Promotion retains class number.
- [ ] Batch rollback.
- [ ] Individual correction.
- [ ] Enrollment history.

## Import/Alumni

- [ ] CSV per class.
- [ ] Full validation before write.
- [ ] All-or-nothing import.
- [ ] Alumni archive.
- [ ] Permanent delete confirmation.

## Audit/PWA/Security

- [ ] Audit menu separate.
- [ ] Account audit separate.
- [ ] PWA installable.
- [ ] Offline blocks app.
- [ ] No sensitive caching.
- [ ] RLS tests pass.
- [ ] Secrets absent.

---

# 37. Final Technical Decisions

1. Vercel + Supabase.
2. Next.js App Router.
3. Supabase Auth cookie-based SSR.
4. PostgreSQL/RLS as authorization layer akhir.
5. Database functions untuk operasi massal atomic.
6. Tidak menggunakan Prisma.
7. Feature/domain modular architecture.
8. Super Admin terisolasi dari operational data.
9. User read-only.
10. Attendance disimpan per siswa, tanggal, dan jam.
11. Dashboard menghitung siswa unik.
12. Kelas fixed 1–10 per grade dan per tahun ajaran.
13. Promotion mempertahankan nomor kelas.
14. Rollback memakai snapshot batch.
15. Audit operasional terpisah dari account audit.
16. PWA online-only dengan offline blocker.
17. Seluruh tanggal bisnis menggunakan Asia/Jakarta dan tipe PostgreSQL DATE untuk tanggal presensi.
# Product amendment: username-only identity

ADR 0010 supersedes earlier references to user email and “Username atau
Email”. All roles login with username/password only. `profiles.email` remains
`NULL`; a random confirmed synthetic Auth email is a server-only implementation
detail. There is no public signup, email verification/recovery, magic link,
email OTP, change-email, or application MFA.

# Product amendment: optional student identifiers

`students.id` UUID adalah identity canonical. NIS/NISN opsional; nilai non-NULL
divalidasi dan unik melalui partial unique indexes. CSV normal menolak nilai
malformed, sedangkan lima nilai workbook existing yang telah direview
dinormalisasi ke NULL oleh tooling migrasi local-only.
