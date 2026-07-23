# Production Readiness

## Environment

Gunakan project Supabase terpisah untuk local, staging, dan production. Jangan menyalin PII production
ke local. Staging default memakai data sintetis. Vercel memakai region `sin1`; environment wajib
memuat URL Supabase, publishable key, dan service-role key server-only. Public signup harus off dan
redirect URL dibatasi ke domain deployment.

Staging sudah tersedia; username bootstrap berasal dari environment dan staging saat ini memakai
`superadmin.dev`. Ini bukan klaim production siap atau sudah dideploy. Production tetap memerlukan
CI hijau dan UAT manual. Migration hardening bersifat additive; rollback kode tidak menghapus object
database baru.

## Deployment

1. Buat backup dan catat restore point.
2. Jalankan migration pada staging dari database kosong, generate types, full gate, lalu UAT.
3. Verifikasi RLS/RPC grants, Auth redirect, signup off, backup/PITR, dan region.
4. Hubungkan Vercel, isi encrypted variables per environment, aktifkan preview protection.
5. Deploy saved commit; jalankan `SMOKE_BASE_URL=https://... npm run smoke:production`.
6. Jangan menjalankan smoke mutation pada data nyata.

Credential Vercel/Supabase dan domain tidak tersedia di repository; production deployment belum
dijalankan dan tidak boleh diklaim selesai sebelum langkah eksternal tersebut dilakukan.

## Existing-data migration

`npm run migration:dry-run` membaca workbook lokal secara read-only dan hanya menulis summary
redacted ke `.local/migration-dry-run.json`. Tidak ada nama/NIS/NISN pada terminal/report. Lengkapi
`config/student-source-mapping.local.json` dari template setelah pemilik data mengonfirmasi sheet ke
grade/class. Jangan menebak mapping XI/XII yang ambigu. Apply production hanya setelah dry-run tanpa
invalid/duplicate, backup tersedia, dan staging disetujui.

Dry-run 2026-07-23 menemukan invalid row dan ambiguity pada workbook ketiga; production import
diblokir. Counts hanya untuk diagnosis mapping dan tidak boleh ditafsirkan sebagai jumlah siswa.

## UAT

- Auth: username-only, password change, inactive, dan ketiga role.
- Account: create/edit/reset/deactivate/tombstone/audit.
- Academic: satu active year, 30 class slots, student create/move/status/search.
- Attendance: mixed status/period, Semua Jam, preview/update/delete/stale/idempotency.
- Dashboard/detail: selected date, unique counts, calendar, stats day/hour, revisions.
- Report: print/Excel, formula-safe, ADMIN export, USER read-only.
- Import/promotion: invalid zero-write, batch, promotion, rollback snapshot, alumni history.
- Audit/PWA/security: account/operational isolation, install, offline blocked, no cached PII,
  headers, keyboard/focus, chart alternatives, responsive layouts.

## Backup dan recovery

- Database: encrypted provider backup/PITR; uji restore ke project isolasi sebelum cutover.
- Auth/profile: reconcile ID/status tanpa menyalin credential ke log.
- Attendance/import/promotion: gunakan batch/audit/revision; jangan direct-update untuk recovery.
- Partial account operation: ikuti `docs/runbook.md`.
- Secrets: rotasi service role, Auth secrets, dan deployment token setelah insiden; redeploy.
- Incident: hentikan mutation, pertahankan audit, cabut credential, nilai exposure, restore, lalu
  dokumentasikan correlation ID tanpa PII.
