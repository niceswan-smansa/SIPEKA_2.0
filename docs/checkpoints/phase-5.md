# Checkpoint 5 — Dashboard, Kalender, dan Statistik

## Scope

Dashboard operasional read-only untuk `ADMIN` dan `USER`, kalender bulanan dengan tanggal terpilih sebagai sumber data, ringkasan siswa unik, serta grafik harian, mingguan, dan bulanan. Tidak ada mutation atau audit feed.

## File dan migration

- `supabase/migrations/20260723050000_phase5_dashboard_statistics.sql`
- `src/modules/dashboard/`
- `src/app/(operational)/dashboard/page.tsx`
- `supabase/tests/rls/007_phase5_dashboard.sql`
- `e2e/phase5.spec.ts`

## RPC dan security model

`phase5_get_dashboard(date)` adalah query `SECURITY INVOKER` yang hanya diberikan kepada `authenticated` dan memverifikasi profile aktif, status wajib-ganti-password, serta role operasional melalui `private.can_access_operational()`. Query menggunakan session/RLS, bukan service role. `SUPER_ADMIN` dan anonymous ditolak.

## Semantik perhitungan

- Ringkasan dan semua kategori memakai `count(distinct student_id)`.
- Harian: 30 kelas aktif dengan tiga kategori dan nilai nol tetap tersedia.
- Mingguan: Senin–Sabtu pada minggu tanggal terpilih, tiga kategori.
- Bulanan: satu jumlah siswa unik per tanggal.
- Tanggal aplikasi memakai `Asia/Jakarta`; perpindahan bulan kalender tidak mengubah tanggal terpilih sampai pengguna memilih tanggal.

## Test

Database test memverifikasi jumlah unik, mixed category, struktur 30 kelas/enam hari, role isolation, dan index tanggal. Unit test memverifikasi kalender Monday-first, leap year, dan perpindahan bulan. E2E memverifikasi dashboard USER, navigasi bulan, alternatif tabel grafik, dan viewport mobile. Hardening baseline juga membuat credential tombstone memenuhi password policy Supabase secara deterministik.

Pemeriksaan bersih terakhir: `format`, `lint`, `typecheck`, `build`, bundle scan, asset check, database reset, database type generation/check, disposable-user seed, `test:db` (8 file/225 test), `test:e2e` (13 passed), `npm audit --audit-level=high` (0 vulnerabilities), dan `git diff --check` lulus.

## Risiko tersisa dan batasan

Grafik hanya merepresentasikan record ketidakhadiran; jam tanpa record tetap bermakna hadir. Checkpoint ini tidak menambahkan mutation, detail presensi, laporan, import, atau fitur Phase 6+.
