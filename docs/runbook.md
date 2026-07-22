# Runbook Pengembangan

## Pemeriksaan lokal

Jalankan `npm run format`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`,
`npm run test:e2e`, `npm run test:db`, dan `npm audit`. E2E memerlukan browser Chromium
(`npx playwright install chromium`).

## Supabase lokal

Docker diperlukan oleh Supabase CLI. Jika socket Docker tidak dapat diakses, gunakan daemon
rootless Podman melalui `DOCKER_HOST=unix:///tmp/sipeka-podman.sock` hanya untuk development; jangan
menyebut database test berhasil jika daemon tidak tersedia.

```bash
npx supabase start
npm run db:reset
npm run test:db
npm run db:types
npm run seed:test-users
npm run test:e2e
npx supabase stop
```

`seed.sql` aman untuk diulang dan hanya berisi data sintetis. `seed:test-users` membuat lima akun
disposable (SUPER_ADMIN, ADMIN, USER, inactive, dan must-change) dengan password acak atau
`SIPEKA_TEST_PASSWORD` dari environment lokal. Password tidak ditulis ke source atau migration;
credential test disimpan sementara di `.local/test-credentials.json` yang di-ignore Git.

Untuk bootstrap akun Super Admin pertama, jalankan `npm run bootstrap:super-admin` dengan
`BOOTSTRAP_SUPER_ADMIN_EMAIL`, `BOOTSTRAP_SUPER_ADMIN_PASSWORD`, dan konfigurasi Supabase lokal.
Script menolak host non-lokal secara default dan tidak dapat membuat Super Admin kedua melalui
aplikasi.

## Tipe dan pemeriksaan bundle

`npm run db:types` menghasilkan tipe dari schema lokal; `npm run db:types:check` mendeteksi drift.
`npm run test:bundle` memindai output `.next` agar service-role key tidak masuk client bundle.

## Data sensitif

Jangan memindahkan workbook dari `data_siswa/`, jangan mencetak row atau identifier, dan jangan
menjalankan upload/import pada Phase 0. Jika file sensitif terlanjur masuk Git, hentikan pekerjaan,
cabut akses bila perlu, dan bersihkan history dengan prosedur insiden yang disetujui pemilik data.

## Database

Jangan memakai database produksi untuk development. Migration yang sudah merge tidak boleh diedit;
tambahkan migration baru untuk perubahan berikutnya.
