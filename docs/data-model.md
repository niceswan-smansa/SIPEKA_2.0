# Model Data Phase 1

SQL migration adalah source of truth. Prisma tidak digunakan. Migration dijalankan deterministik
dari database kosong dalam urutan berikut:

1. `20260723010000_extensions_and_enums.sql` — `pg_trgm`, schema `private`, dan seluruh enum.
2. `20260723010100_core_schema.sql` — tabel, foreign key, constraint, index, trigger, dan audit
   otomatis untuk perubahan metadata operasional.
3. `20260723010200_auth_helpers.sql` — helper `SECURITY DEFINER` dan RPC perubahan password.
4. `20260723010300_rls_policies.sql` — RLS, grants, dan policy per role.
5. `20260723010400_restrict_direct_business_writes.sql` — menutup direct business mutation dari
   role `authenticated` sampai scoped service/RPC pada phase pemilik fitur tersedia.

## Tabel

Migration Phase 1 membuat `profiles`, `academic_years`, `classes`, `students`,
`student_enrollments`, `periods`, `attendance_records`, `attendance_revisions`, `audit_logs`,
`attendance_batches`, `import_batches`, `promotion_batches`, dan `promotion_batch_items`.

`profiles.id` mereferensikan `auth.users.id`. Username dan email dinormalisasi lowercase dan
unik. Hanya satu `academic_years.is_active` yang diperbolehkan; class number dibatasi 1–10 dan
class `ALUMNI` dilarang. NIS/NISN unik, satu enrollment current per siswa, dan attendance unik
berdasarkan siswa/tanggal/jam. Trigger memvalidasi grade terhadap kelas aktif serta melarang alumni
memiliki kelas aktif. `audit_logs` memiliki trigger append-only.

Index utama meliputi trigram untuk `students.normalized_name`, NIS/NISN, grade/kelas/status aktif,
tanggal presensi, kombinasi kelas/tanggal dan siswa/tanggal, waktu/action/entity audit, serta
siswa/current enrollment.

## Seed dan tipe

`supabase/seed.sql` hanya memuat 10 periode, satu tahun ajaran development, dan 30 kelas sintetis.
Tidak ada siswa atau password di seed. Akun disposable dibuat oleh `npm run seed:test-users`.

Tipe TypeScript dihasilkan dari schema lokal ke
`src/infrastructure/supabase/database.types.ts` dengan `npm run db:types`; verifikasi memakai
`npm run db:types:check`.

Direct INSERT/UPDATE/DELETE melalui Data API tidak tersedia untuk tabel bisnis. Phase fitur harus
membukanya hanya melalui scoped server service atau RPC terotorisasi yang menjalankan validasi,
transaction, revision history, dan audit sebagai satu operasi.
