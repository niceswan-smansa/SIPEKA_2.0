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
6. `20260723030000_phase3_schema_hardening.sql` — constraint student Phase 3, index trigram NIS/NISN,
   dan helper ADMIN Phase 3.
7. `20260723030100_phase3_academic_class_rpc.sql` — RPC tahun ajaran dan metadata kelas dengan slot
   tetap serta audit atomik.
8. `20260723030200_phase3_student_rpc.sql` — RPC create, identitas, enrollment, perpindahan, dan
   status siswa.
9. `20260723030300_phase3_student_search_rpc.sql` — read RPC search terparameterisasi dan pagination.
10. `20260723030400_phase3_class_occupancy_semantics.sql` — menyelaraskan RPC dan trigger kelas agar
    okupansi hanya menghitung siswa aktif dengan current enrollment.

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

## Lifecycle Phase 3

Tahun ajaran baru default nonaktif dan membuat tepat 30 slot (X/XI/XII masing-masing nomor 1–10).
Switch tahun aktif bersifat atomik, tetapi ditolak bila tahun aktif lama masih mempunyai siswa aktif
dengan current enrollment; workflow promotion Phase 7 akan menangani perpindahan penuh. Metadata
tahun dapat diedit, tetapi tidak ada hard delete tahun yang telah digunakan.

Kelas tidak memiliki display name tersimpan: UI selalu menurunkan `${grade}-${class_number}`. Grade
hanya X, XI, XII untuk operasi Phase 3; ALUMNI ditolak. Kelas tidak dapat dinonaktifkan bila masih
mempunyai siswa aktif dengan current enrollment. Siswa nonaktif tidak memblokir penonaktifan kelas,
tetapi enrollment historisnya tetap dipertahankan. Jumlah siswa aktif dihitung dari join siswa aktif
dan current enrollment, bukan cache.

Siswa aktif X–XII dibuat bersama current enrollment pada kelas aktif tahun aktif. Perpindahan mengunci
siswa/enrollment, menutup enrollment lama dengan `ended_on`, membuat enrollment baru, lalu mencatat
audit. Identitas dapat diedit tanpa mengubah enrollment. Nonaktif mempertahankan data dan histori;
tidak ada hard delete siswa. Status aktif kembali memerlukan kelas aktif yang sesuai.

Search `phase3_search_students` menerima pencarian partial case-insensitive pada nama normalized,
NIS, dan NISN, filter opsional grade/kelas/status/tahun masuk, serta page/page_size bounded. Sort
stabil memakai nama lalu id. Trigram index tersedia untuk normalized name, NIS, dan NISN; query plan
dan batas pagination diuji di pgTAP.
