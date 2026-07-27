# Arsitektur

SIPEKA memakai Next.js App Router dengan aliran dependensi:

```text
Presentation -> Application -> Domain <- Repository interface
                                      <- Infrastructure implementation
```

- `src/app`: route, layout, API, dan komposisi presentation.
- `src/modules/<feature>/domain`: kontrak dan aturan bisnis tanpa React, Next.js, Supabase, atau browser API.
- `src/modules/<feature>/application`: use case yang mengorkestrasi domain dan repository.
- `src/modules/<feature>/infrastructure`: implementasi Supabase dan layanan eksternal.
- `src/modules/<feature>/presentation`: komponen, hook, dan Server Action tipis.
- `src/shared`: UI, keamanan, constants, dan utilitas lintas fitur.
- `src/infrastructure`: adapter teknis lintas fitur.

Setiap modul mempunyai `index.ts` sebagai public API. Direct business write melalui Data API tetap
ditutup; mutation memakai RPC PostgreSQL dengan validasi database dan transaksi.

## Batas autentikasi dan otorisasi

Client Supabase dipisahkan untuk browser, server cookie, middleware, dan admin server-only.
`proxy.ts` hanya menyegarkan session. Keputusan role selalu dibuat server-side melalui
`requirePageAccess` atau `authorizeRequest`, dan PostgreSQL tetap menegakkan RLS/grant.

`SUPER_ADMIN` hanya mengelola akun. `ADMIN` menjalankan mutation operasional. `USER` hanya membaca
data operasional yang diizinkan.

## Presensi padat

Frontend tetap menampilkan Jam 1–10, tetapi PostgreSQL menyimpan maksimal satu
`attendance_days` untuk setiap kombinasi siswa dan tanggal.

```text
Browser: perubahan per jam
        -> preview RPC
        -> token + snapshot kelas/tanggal
        -> apply RPC
        -> satu row harian dengan period_statuses
```

`period_statuses` adalah object JSON yang memetakan nomor jam ke `IZIN`, `SAKIT`, atau
`TANPA_KETERANGAN`. Jam yang tidak ada di object disimpulkan sebagai `Hadir`. `note` disimpan satu
kali untuk seluruh ketidakhadiran siswa pada tanggal tersebut.

Compatibility view `attendance_records` mengembangkan row harian menjadi bentuk per jam untuk
read model dashboard, laporan, export, dan fixture lama. View bukan storage utama.

Preview tetap diikat pada actor, kelas, tanggal, payload, expiry, dan snapshot. Apply memakai
advisory lock serta stale check sebelum mengubah data. Token yang sudah dipakai dihapus.

## Tanpa riwayat aplikasi

SIPEKA hanya menyimpan keadaan terbaru. Tidak ada tabel audit, revision timeline, attendance batch
history, account audit, operational audit, atau export history. Metadata teknis `version`,
`created_at`, dan `updated_at` tetap tersedia untuk konsistensi dan sinkronisasi.

Promotion batch dan item tetap dipertahankan karena merupakan state workflow yang diperlukan untuk
rollback promotion, bukan catatan aktivitas umum.

## Detail siswa dan laporan

Modul `student-attendance` menghasilkan kalender, statistik hari/jam, tren, rincian Jam 1–10, dan
laporan dari storage harian. Laporan individual dan workbook grade dibuat in-memory, tidak dicache,
dan tidak membuat record riwayat export.

## Lifecycle akademik

Import memvalidasi seluruh payload sebelum insert. Promotion menyimpan snapshot fungsional pada
`promotion_batches` dan `promotion_batch_items` agar rollback deterministik. Alumni dapat
diarsipkan atau ditombstone tanpa menghapus data presensi.
