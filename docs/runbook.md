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
`npm run test:assets` memverifikasi `public/assets/smansa-logo.webp` dan
`public/assets/smansa-hero.webp`.

## Pemulihan operasi akun

Jika pembuatan akun gagal setelah Auth user dibuat, service melakukan `deleteUser` compensation.
Jika compensation gagal, gunakan server-only admin service untuk cleanup; jangan menyalin password
atau token ke tiket/commit.

Penghapusan akun Phase 2 adalah tombstone akses: Auth email dianonimkan ke
`deleted+<account-id>@invalid.local`, password diacak, `profiles.is_active=false`, username menjadi
`deleted_<32 hex>`, dan email profile null. Auth user tidak dihapus agar FK profile dan histori tetap
tersedia; email lama dapat dipakai kembali setelah update Auth. Audit menyimpan snapshot sebelum
perubahan, tanpa credential. Retry pada tombstone yang sudah ada idempotent.

Jika Auth berhasil tetapi RPC tombstone/audit gagal, service mengembalikan `PARTIAL_OPERATION`; jangan
melaporkan berhasil. Gunakan server-only recovery untuk memeriksa identity tombstone dan profile,
kemudian ulangi langkah database yang aman. Jangan menyalin password atau token ke tiket/log.

Supabase Admin API membutuhkan JWT target untuk revokasi sesi global. Karena JWT target tidak pernah
diteruskan ke portal, force logout hanya sukses bila gateway mengonfirmasi revocation. Saat ini hasil
normal adalah `SESSION_REVOCATION_UNSUPPORTED`, audit memakai `FORCE_LOGOUT_FAILED`, dan UI memberi
pesan bahwa sesi belum dapat dicabut langsung. Jangan mengubah `is_active` atau password untuk
mensimulasikan force logout; profile guard tetap berjalan pada setiap request.

## Data sensitif

Jangan memindahkan workbook dari `data_siswa/`, jangan mencetak row atau identifier, dan jangan
menjalankan upload/import pada Phase 0. Jika file sensitif terlanjur masuk Git, hentikan pekerjaan,
cabut akses bila perlu, dan bersihkan history dengan prosedur insiden yang disetujui pemilik data.

## Database

Jangan memakai database produksi untuk development. Migration yang sudah merge tidak boleh diedit;
tambahkan migration baru untuk perubahan berikutnya.
