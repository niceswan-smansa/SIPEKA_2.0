# Checkpoint 9 — Migration, Staging, dan Production Readiness

## Scope lokal selesai

- Tool dry-run workbook read-only dengan summary redacted dan duplicate/missing-field counts.
- Template mapping tanpa PII; mapping lokal di-ignore Git.
- Vercel config region Singapore dan production smoke non-destruktif.
- Environment separation, deployment, UAT, backup/restore, secret rotation, dan incident runbook.

## Data existing

Tiga workbook tetap di `data_siswa/` yang di-ignore. Dry-run tidak mencetak row atau identifier.
Mapping XI/XII tetap ambigu berdasarkan inventory; import production sengaja tidak dijalankan sampai
pemilik data menyetujui mapping eksplisit. Tidak ada workbook atau payload staging di commit.

Dry-run aktual mendeteksi 3 workbook dan hanya melaporkan count redacted: workbook 1 (11 sheet,
368 row kandidat, 45 invalid), workbook 2 (17 sheet, 358 row kandidat, 2 invalid), dan workbook 3
(16 sheet, 1.440 row kandidat, 51 invalid, 2 ambiguity). Angka ini bukan jumlah siswa final karena
support/template sheet dapat berulang.

## Deployment status

Local readiness dapat diuji penuh. Staging dan production belum di-link/deploy karena credential
Supabase/Vercel dan domain tidak tersedia. `vercel.json` serta smoke script siap, tetapi laporan tidak
mengklaim deployment eksternal.

## Test dan security

Gate Phase 0–8 tetap berlaku. Phase 9 menambah dry-run migration dan production smoke script.
Generated report berada di `.local/`; source mapping lokal, dumps, reports, secrets, dan workbook
di-ignore. Tidak ada direct client mutation atau Prisma.

Gate lokal final lulus: format, lint, typecheck, 47 unit, build, 16 E2E, bundle/assets/PWA,
database reset/types, Auth probe, 252 pgTAP, dry-run redacted, local smoke, backup schema, audit high,
dan diff check. Audit high exit 0; dua advisory moderate transitif ExcelJS/uuid tersisa karena
perbaikan yang ditawarkan adalah downgrade breaking.

## Tindakan pemilik

1. Konfirmasi mapping worksheet XI/XII ke grade/class.
2. Berikan akses project staging/production dan Vercel saat deployment akan dilakukan.
3. Konfirmasi backup/PITR, domain, email Auth, serta UAT sign-off sebelum production cutover.
