# Runbook Pengembangan

## Pemeriksaan lokal

Jalankan `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test`, dan `npm run build`.
Untuk database smoke test, jalankan `npx supabase start`, `npm run test:db`, lalu
`npx supabase stop`. E2E memerlukan browser Chromium Playwright (`npx playwright install chromium`).

## Data sensitif

Jangan memindahkan workbook dari `data_siswa/`, jangan mencetak row atau identifier, dan jangan
menjalankan upload/import pada Phase 0. Jika file sensitif terlanjur masuk Git, hentikan pekerjaan,
cabut akses bila perlu, dan bersihkan history dengan prosedur insiden yang disetujui pemilik data.

## Database

Phase 0 tidak mempunyai application migration. Jangan memakai database produksi untuk development.
