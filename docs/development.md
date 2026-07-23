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

## Phase 6 detail dan laporan

Route `/siswa/[id]` memuat kalender, detail jam 1–10, statistik hari/jam, tren, revision timeline,
dan editor ADMIN. Route `/siswa/[id]/laporan` menyediakan tampilan print; endpoint
`/api/students/[id]/report` mengekspor Excel hanya untuk ADMIN.

RPC tambahan:

| RPC                             | Tanggung jawab                                   |
| ------------------------------- | ------------------------------------------------ |
| `phase6_get_student_attendance` | detail, kalender, statistik, tren, dan revisions |
| `phase6_get_student_report`     | report read model untuk rentang tervalidasi      |
| `phase6_record_student_export`  | audit OPERATIONAL summary untuk export ADMIN     |

Client Component harus memakai `@/modules/attendance/client`; public barrel attendance memuat
repository server-only dan hanya boleh dipakai server. Jalankan `npm run test:bundle` setelah
perubahan import graph.

Provisioning test bersifat canonical dan menyimpan credential hanya di `.local/` yang di-ignore.
`npm run test:auth-probe` memverifikasi login langsung ke local Auth tanpa mencetak credential.
Playwright selalu memulai server baru agar proses Next lama tidak mempertahankan environment sebelum
reset/provisioning. `npm run test:e2e` selalu menjalankan reset dan provisioning sebelum Playwright,
sehingga suite dapat diulang tanpa mewarisi password, class occupancy, atau attendance fixture.

## Phase 7 import dan lifecycle

`/import-siswa` hanya ADMIN dan menerima CSV header `NIS,NISN,NAMA,JENIS_KELAMIN`; preview browser
tidak mengirim data sebelum seluruh baris valid. `/naik-turun-grade` menjalankan promotion dan
rollback snapshot. `/alumni` mempertahankan histori; archive/tombstone adalah operasi terpisah.
RPC catalog: `phase7_import_students`, `phase7_promote_academic_year`,
`phase7_rollback_promotion`, `phase7_archive_alumni`, dan `phase7_tombstone_alumni`.

## Phase 8 checks

`npm run test:pwa` memeriksa manifest, icon, dan offline fallback. `/riwayat-aktivitas` hanya ADMIN
dan memakai RLS scope OPERATIONAL. Perubahan header/PWA wajib menjalankan build, E2E, bundle scan,
dan pemeriksaan cache protected.

## Branch protection yang disarankan

Lindungi `main`, wajibkan pull request dan satu approval, larang force-push, wajibkan branch up to
date, serta jadikan seluruh job workflow `CI` sebagai required status checks. Aktifkan secret
scanning dan dependency update alerts pada host Git.
