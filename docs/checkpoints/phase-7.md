# Checkpoint 7 — Import, Promotion, dan Alumni

## Scope

Phase 7 menambahkan import CSV per kelas, promotion X→XI, XI→XII, XII→ALUMNI, rollback snapshot,
archive alumni, dan tombstone identitas. Tidak ada import workbook existing.

## Migration dan RPC

- `supabase/migrations/20260723070000_phase7_import_promotion_alumni.sql`
- `phase7_import_students`: validasi payload, insert siswa/current enrollment, batch, audit atomik.
- `phase7_promote_academic_year`: mempertahankan nomor kelas, menyimpan batch snapshot, memindahkan
  enrollment, dan switch active year dalam satu transaksi.
- `phase7_rollback_promotion`: memeriksa state saat ini terhadap snapshot lalu memulihkan enrollment.
- `phase7_archive_alumni`: soft archive.
- `phase7_tombstone_alumni`: mengganti NIS/NISN/nama alumni archived tanpa menghapus histori.

Semua RPC `SECURITY DEFINER`, `search_path=''`, execute hanya `authenticated`, dan memanggil helper
ADMIN Phase 3. Direct table write tetap ditolak.

## Module dan route

`src/modules/student-lifecycle/` memisahkan domain CSV, application service, Supabase repository,
server actions, client parser/preview, dan tests. Route ADMIN: `/import-siswa`,
`/naik-turun-grade`, `/alumni`.

## Semantik keamanan dan test

CSV wajib header canonical, maksimum 500 baris/1 MB, formula prefix dan malformed quote ditolak,
duplicate file/database ditolak, dan import all-or-none. Promotion snapshot mempertahankan class
number; rollback bukan aturan turun grade generik. Alumni tidak mempunyai current class, archive
menonaktifkan tanpa menghapus histori, dan tombstone menjaga foreign key/audit.

Unit CSV parser, pgTAP role matrix/import/promotion/rollback, dan E2E import sintetis ditambahkan.
Fase ini tidak membaca workbook siswa existing dan tidak menambahkan audit UI operasional atau PWA.
