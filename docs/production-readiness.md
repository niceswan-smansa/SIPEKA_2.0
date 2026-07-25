# Production Readiness

Status diperbarui: 25 Juli 2026.

## Status saat ini

- Production live: `https://www.sipekasmansa.online/`.
- Deployment: Vercel dari branch `main`.
- Database/Auth: Supabase environment terpisah dari lokal.
- Production smoke non-destruktif tersedia dan telah digunakan.
- CI menjalankan quality, coverage, dependency policy, database, auth-policy, Chromium E2E,
  Firefox/WebKit smoke, dan performance smoke lokal.
- Data sintetis digunakan untuk test; PII production tidak boleh disalin ke lokal.

Status live tidak menggantikan UAT, backup, monitoring, atau incident readiness.

## Environment

Environment Vercel wajib memuat URL Supabase, publishable key, dan service-role key server-only.
Public signup harus nonaktif, redirect URL dibatasi ke domain deployment, dan preview deployment
harus diproteksi.

Secret, project ID, credential, dan dump database tidak boleh disimpan di repository.

## Deployment checklist

1. Pastikan CI commit yang akan dideploy hijau.
2. Pastikan migration sudah diuji dari database lokal kosong dan types sinkron.
3. Catat restore point/backup sebelum migration atau mutation berisiko.
4. Deploy commit tersimpan dari `main`.
5. Jalankan:
   `SMOKE_BASE_URL=https://www.sipekasmansa.online npm run smoke:production`
6. Lakukan UAT role USER/ADMIN/SUPER_ADMIN tanpa membuat data palsu berlebihan.
7. Verifikasi audit, log error, dan fungsi export.
8. Jangan menjalankan load test atau destructive E2E terhadap production.

## Data siswa dan identifier

NIS dan NISN opsional. Missing NIS/NISN bukan row invalid. UUID internal tetap identity canonical.

Dry-run workbook tetap harus menolak atau menandai nama kosong, gender invalid, identifier non-kosong
duplikat/invalid, mapping grade/kelas ambigu, dan sheet yang tidak dapat dipetakan dengan aman.

Apply data nyata hanya dilakukan setelah dry-run redacted, mapping disetujui pemilik data, backup
tersedia, dan hasil staging diterima.

## UAT

- Auth: username-only, password change, inactive, dan ketiga role.
- Account: create/edit/reset/deactivate/tombstone/audit.
- Academic: satu active year, 30 class slots, student create/move/status/search.
- Attendance: mixed status/period, Semua Jam, bulk Hadir, preview/update/delete/idempotency.
- Dashboard/detail: selected date, unique counts, calendar, stats day/hour, revisions.
- Report: print/Excel, formula-safe, bulanan/custom, ADMIN export, USER read-only.
- Import/promotion: invalid zero-write, batch, promotion, rollback snapshot, alumni history.
- Audit/PWA/security: account/operational isolation, online-only, no cached PII, headers, responsive.

## Backup dan recovery

Repository tidak dapat membuktikan bahwa backup/PITR provider aktif; ini harus diverifikasi di
dashboard Supabase oleh pemilik project.

Catat metode dan retensi backup/PITR, pihak yang boleh restore, restore point terakhir, tanggal
restore drill terakhir, serta RPO/RTO yang disepakati.

Restore harus diuji ke project terisolasi terlebih dahulu. Setelah restore, verifikasi login, profil,
siswa, enrollment, presensi, audit, promotion batch, dan export sebelum cutover.

## Incident

1. Hentikan mutation berisiko.
2. Pertahankan audit dan correlation ID tanpa PII.
3. Cabut/rotasi credential yang mungkin terpapar.
4. Nilai rentang data dan akun terdampak.
5. Pulihkan ke environment terisolasi bila diperlukan.
6. Verifikasi data dan aplikasi.
7. Redeploy commit aman dan dokumentasikan insiden.

Lihat `docs/runbook.md` untuk prosedur operasional rinci.
