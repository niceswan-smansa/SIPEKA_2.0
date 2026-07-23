# Arsitektur

SIPEKA memakai Next.js App Router dengan aliran dependensi:

```text
Presentation -> Application -> Domain <- Repository interface
                                      <- Infrastructure implementation
```

- `src/app`: route, layout, dan komposisi presentation.
- `src/modules/<feature>/domain`: entity, value object, rule, dan repository interface tanpa React,
  Next.js, Supabase, atau browser API.
- `src/modules/<feature>/application`: use case yang mengorkestrasi domain dan repository interface.
- `src/modules/<feature>/infrastructure`: implementasi database dan layanan eksternal.
- `src/modules/<feature>/presentation`: komponen, hook, action tipis, dan schema UI.
- `src/shared`: kode lintas fitur tanpa business rule spesifik fitur.
- `src/infrastructure`: adapter teknis lintas fitur.

Setiap modul harus mempunyai `index.ts` sebagai public API. Impor lintas modul tidak boleh memakai
deep import. `eslint.config.mjs` menegakkan aturan ini serta isolasi domain dan presentation.

`authentication` dan `authorization` adalah modul Phase 1. Domain-nya tidak mengimpor React,
Next.js, Supabase, atau browser API. Gateway Supabase berada di infrastructure; server action dan
route guard tetap tipis. Route placeholder hanya membuktikan guard, bukan UI produk.

Client Supabase dipisah menjadi browser, server cookie, middleware/request boundary, dan admin
server-only. Admin client tidak pernah diimpor `src/app` atau Client Component. `proxy.ts` hanya
me-refresh session; keputusan akses dibuat server-side oleh `requirePageAccess`/`authorizeRequest`.
Direct database access tetap dibatasi RLS.

Phase 2 menambahkan landing page, shared UI primitives, dua application shell yang terpisah, dan
`account-management` dengan batas `domain -> application -> infrastructure`. `profiles` menjadi
sumber daftar akun yang efisien; Supabase Auth Admin hanya dipakai untuk operasi credential.
Mutasi profile memakai RPC server-only agar profile dan audit ACCOUNT atomik; operasi Auth
diorkestrasi dengan compensation. Server Actions tetap tipis dan actor selalu berasal dari session
server. Route yang belum masuk fase
tidak dibuat sebagai halaman palsu; menu roadmap ditampilkan disabled “Segera”.

## Phase 3 boundaries

Phase 3 menambahkan modul `academic-years`, `classes`, `students`, dan `student-search`, masing-masing
dengan `domain`, `application`, `infrastructure`, `presentation`, `tests`, dan `index.ts`. Read model
siswa dipakai bersama oleh manajemen dan pencarian; pagination, filter, dan sort terjadi di server.
Client Component hanya mengelola filter atau konfirmasi UI dan tidak mengimpor repository server.

Semua mutation tahun ajaran, kelas, siswa, dan enrollment melewati RPC `phase3_*` `SECURITY DEFINER`
yang memanggil helper ADMIN aktif, mengambil actor dari `auth.uid()`, memvalidasi invariant, serta
menulis audit OPERATIONAL sebelum transaction commit. Policy direct write tetap tertutup. USER hanya
mendapat read model melalui session/RLS; SUPER_ADMIN tetap terisolasi dari data operasional.

## Phase 4 attendance boundary

`attendance` memakai satu read model kelas/tanggal tanpa N+1 dan dua mutation RPC. Preview mengikat
token pada actor, kelas, tanggal, payload canonical, snapshot database, expiry, dan status penggunaan.
Apply mengunci scope kelas/tanggal, membaca ulang snapshot, lalu menulis attendance, revision, batch,
dan audit dalam satu transaction. React hanya mengelola draft; diff serta summary authoritative tetap
berasal dari PostgreSQL.

## Phase 5 dashboard read model

Dashboard memakai satu RPC `SECURITY INVOKER` untuk menghasilkan summary serta seri harian,
mingguan, dan bulanan berdasarkan tanggal terpilih. RPC menggunakan session/RLS operasional dan
agregasi `count(distinct student_id)`; komponen grafik hanya menerima read model dan menyediakan
tabel alternatif yang dapat dibaca tanpa visualisasi.

## Phase 6 student attendance and reports

Modul `student-attendance` menyediakan read model detail siswa, kalender, statistik hari/jam, tren,
revision timeline, dan laporan. Read repository berada di infrastructure server-only. Client
Component mengimpor kontrak dan Server Action melalui `attendance/client.ts`, bukan barrel attendance
yang juga mengekspor repository server-only.

Editor detail siswa mengubah satu siswa pada satu tanggal melalui preview/apply Phase 4. PostgreSQL
tetap menjadi sumber diff, stale check, idempotency, revision, batch, dan audit. Laporan print memakai
read model yang sama; endpoint Excel menjalankan authorization ADMIN, menghasilkan workbook in-memory,
mencatat audit summary, dan mengirim response `private, no-store`.

## Phase 7 lifecycle boundary

`student-lifecycle` memisahkan parser CSV, application service, repository RPC, dan presentation.
`phase7_import_students` memvalidasi seluruh payload sebelum insert siswa/enrollment dan audit dalam
satu transaksi. Promotion menyimpan snapshot di `promotion_batches`/`promotion_batch_items`;
rollback hanya mengembalikan snapshot bila state saat ini masih cocok. Alumni diarsipkan atau
ditombstone tanpa menghapus attendance/enrollment history. Tidak ada direct Data API write.

## Phase 8 audit dan online-only shell

`operational-audit` adalah read repository session/RLS terpisah dari account audit. PWA worker hanya
cache manifest, logo, dan offline fallback; seluruh navigation serta protected/API response tetap
network-only. Headers aplikasi dideklarasikan terpusat di `next.config.ts`.

# Account identity boundary

Username adalah identity aplikasi. Resolver server-only memetakan username ke
synthetic Supabase Auth identity dan langsung melakukan password sign-in.
React, browser, shared barrel, audit, serta read model account tidak menerima
synthetic identity. Perubahan username hanya menyentuh profile/audit.
