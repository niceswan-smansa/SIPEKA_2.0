# Checkpoint 4 — Attendance Core dan Input Presensi

## Scope

Menyediakan input presensi ADMIN-only untuk tanggal, kelas, roster siswa aktif, pencarian dalam
kelas, status/jam/catatan per siswa, bulk action, preview, stale protection, idempotency token,
transaction, revision, audit, dan summary. USER, SUPER_ADMIN, serta anonymous tetap tidak dapat
membuka route atau menjalankan RPC mutation.

## Migration dan RPC

- `20260723040000_phase4_attendance_core.sql`
- `phase4_get_class_attendance` — read model roster dan attendance existing.
- `phase4_preview_attendance` — validasi, diff `NEW/UPDATE/UNCHANGED/DELETE/INVALID`, snapshot,
  token actor/scope/payload-bound dengan expiry.
- `phase4_apply_attendance` — recheck token/snapshot, advisory lock scope kelas/tanggal, upsert/delete,
  revision, attendance batch, dan audit dalam satu transaction.

Direct table write tetap direvoke. RPC mutation memakai `SECURITY DEFINER`, `search_path=''`, actor
`auth.uid()`, helper ADMIN aktif, dan grant hanya kepada `authenticated` untuk melewati Data API
policy tanpa membuka tabel.

## Files dan module

- `src/modules/attendance/domain/attendance.ts`
- `src/modules/attendance/application/attendance-service.ts`
- `src/modules/attendance/infrastructure/supabase-attendance.repository.ts`
- `src/modules/attendance/presentation/actions.ts`
- `src/modules/attendance/presentation/attendance-input.tsx`
- `src/modules/attendance/index.ts`
- `src/app/(operational)/presensi/input/page.tsx`
- `supabase/tests/rls/006_phase4_attendance.sql`
- `src/modules/attendance/tests/attendance.test.ts`
- `e2e/phase4.spec.ts`

## Test dan pemeriksaan

Database test mencakup tanggal masa depan, read model, preview/apply, Semua Jam, direct INSERT/UPDATE/
DELETE denial, role matrix USER/anonymous, dan stale snapshot. Unit test mencakup untouched hours,
explicit delete, dan status resmi. E2E mencakup mixed status/jam serta 10 period melalui All Jam.

Command hasil dicatat pada completion report setelah seluruh pemeriksaan checkpoint selesai.

## Risiko tersisa

UI saat ini memuat satu kelas pada satu waktu dan summary diff tetap ringkas; laporan/history dan detail
presensi siswa menjadi scope Checkpoint 6. Pembersihan token kadaluarsa dapat dijadwalkan pada operasi
database berikutnya tanpa mempengaruhi authorization.

## Batasan fase

Tidak ada dashboard statistik, kalender dashboard, laporan, import, promotion, alumni, audit UI
operasional, atau PWA yang diimplementasikan pada checkpoint ini.
