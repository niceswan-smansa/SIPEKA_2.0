# Panduan Developer

## Setup

1. Gunakan Node.js 20.9+ dan Docker (atau rootless Podman untuk lokal).
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local` dan gunakan hanya nilai lokal.
4. Jalankan `npx supabase start`, `npm run db:reset`, dan `npm run db:types` bila mengerjakan
   database.
5. Jalankan `npm run seed:test-users` untuk akun disposable lokal.
6. Jalankan `npm run dev` untuk aplikasi; `npm run dev:local` otomatis membaca environment
   Supabase lokal.

## Environment

`.env.example` hanya mendokumentasikan `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` placeholder. Service-role
key tidak boleh dipasang pada `NEXT_PUBLIC_*` atau Client Component. Credential bootstrap/test hanya
dibaca script server-only dari environment lokal dan jangan di-commit.

## Database test

`npm run test:db` memakai pgTAP di Supabase lokal dengan session/JWT role sintetis untuk anonymous,
USER, ADMIN, SUPER_ADMIN, akun nonaktif, dan must-change. Test mencakup RLS matrix, helper
anti-escalation, constraint unik, grade/class validation, dan audit append-only.

## Aturan kontribusi

- Baca `AGENTS.md` dan `docs/implementation-plan.md` seluruhnya.
- Kerjakan satu phase, gunakan public API modul, dan tambahkan test bersama perubahan.
- Migration yang sudah merge tidak boleh diedit.
- Jangan commit secret, data siswa, dump, export, atau report ber-PII.
- User-facing text menggunakan Bahasa Indonesia; identifier internal konsisten dalam bahasa Inggris.

## Phase 2 routes

Route aktif: `/`, `/login`, `/change-password`, `/dashboard`, `/super-admin/accounts`,
`/super-admin/accounts/new`, `/super-admin/accounts/[id]`, dan `/super-admin/account-audit`.
SUPER_ADMIN hanya melihat portal akun; ADMIN/USER memakai shell operasional. Menu roadmap yang belum
diimplementasikan tetap disabled sampai phase fiturnya tersedia. Account mutation hanya dipanggil dari
server action setelah guard SUPER_ADMIN; daftar akun berasal dari `profiles` dengan pagination server.

## Phase 3 routes dan modul

Route `/manajemen-kelas` dan `/manajemen-siswa` hanya ADMIN. `/siswa` dan `/siswa/[id]` dapat dibuka
ADMIN/USER; USER tidak menerima form, tombol, link edit, atau action mutation. `student-search` memakai
URL search params sebagai source of truth dan debounce 300 ms, tetapi query tetap server-side.

RPC catalog saat ini:

| RPC                                                             | Tanggung jawab                                    |
| --------------------------------------------------------------- | ------------------------------------------------- |
| `phase3_create_academic_year`                                   | tahun ajaran + 30 slot + audit                    |
| `phase3_update_academic_year` / `phase3_activate_academic_year` | metadata dan active-year switch                   |
| `phase3_update_class`                                           | wali kelas, notes, status + audit                 |
| `phase3_create_student`                                         | identitas + current enrollment + audit            |
| `phase3_update_student_identity`                                | identitas dan normalized name + audit             |
| `phase3_change_student_academic`                                | grade/kelas/status dan enrollment history + audit |
| `phase3_search_students`                                        | read-only partial search, filter, pagination      |

Read query memakai RLS user session, bukan service role. Import, promotion massal, alumni, reports,
dan operational audit UI tetap menunggu fase masing-masing.

## Phase 4 attendance

Route `/presensi/input` hanya ADMIN. RPC `phase4_get_class_attendance`,
`phase4_preview_attendance`, dan `phase4_apply_attendance` menyediakan roster/existing data, diff
preview, stale protection, revision, batch, dan audit. Reset database sebelum database test atau E2E
agar fixture sintetis antarsuite tidak mempengaruhi count assertion.

## Branch protection yang disarankan

Lindungi `main`, wajibkan pull request dan satu approval, larang force-push, wajibkan branch up to
date, serta jadikan seluruh job workflow `CI` sebagai required status checks. Aktifkan secret
scanning dan dependency update alerts pada host Git.
