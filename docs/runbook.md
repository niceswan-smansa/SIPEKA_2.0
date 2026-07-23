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

Untuk bootstrap atau recovery Super Admin, jalankan `npm run bootstrap:super-admin` dengan
`BOOTSTRAP_SUPER_ADMIN_USERNAME`, `BOOTSTRAP_SUPER_ADMIN_FULL_NAME`,
`BOOTSTRAP_SUPER_ADMIN_PASSWORD`, dan konfigurasi Supabase server-only.
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

Penghapusan akun adalah tombstone akses: Auth identity diganti synthetic identity acak pada domain
invalid, password diacak, `profiles.is_active=false`, username menjadi `deleted_<32 hex>`, dan email
profile null. Auth user tidak dihapus agar FK profile dan histori tetap tersedia. Audit menyimpan snapshot sebelum
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

## Operasi Phase 3

Setelah reset, jalankan `npm run db:types`, `npm run seed:test-users`, lalu `npm run test:db` dan
`npm run test:e2e`. Seed hanya membuat periode, satu tahun development, 30 slot kelas, dan akun
disposable; tidak ada siswa nyata. Tahun baru dibuat dari `/manajemen-kelas`; pilih aktif hanya bila
tidak ada siswa aktif/current enrollment pada tahun lama. Jika ditolak, tunggu workflow promotion
Phase 7—jangan menonaktifkan constraint atau mengubah tahun langsung.

Jika RPC gagal, seluruh perubahan PostgreSQL dan audit rollback bersama. Untuk diagnosis aman, catat
request id dan error code saja; jangan menyalin data siswa atau payload form ke log. Jika deployment
menunjukkan ketidaksesuaian setelah gangguan koneksi, periksa audit OPERATIONAL dan current enrollment
melalui server-only read service sebelum retry. Mutation langsung lewat Data API harus tetap menerima
permission denied.

## Operasi Phase 4

Preview attendance berlaku sepuluh menit dan sekali pakai. Error `STALE_PREVIEW` berarti scope
kelas/tanggal berubah setelah preview; muat ulang roster lalu preview ulang, jangan retry token lama.
Error audit atau revision me-rollback seluruh record dan batch. Untuk pengujian bersih jalankan
`npm run db:reset`, `npm run seed:test-users`, E2E, lalu reset lagi sebelum `npm run test:db`.

## Operasi Phase 6

Detail siswa memakai engine Phase 4. Error stale pada editor ditangani dengan reload data dan preview
baru; jangan membangun ulang perubahan dari browser sebagai sumber kebenaran. Revision dan audit
rollback bersama attendance.

Export Excel hanya ADMIN, dibuat in-memory, diaudit sebelum response, dan memakai `no-store`. Bila
audit export gagal, jangan kirim workbook. String spreadsheet yang diawali karakter formula wajib
tetap diawali apostrof.

Untuk diagnosis fixture Auth lokal:

```bash
npm run db:reset
npm run seed:test-users
npm run test:auth-probe
```

Probe hanya menampilkan origin lokal, status Auth, error code, dan kecocokan ID. Jika probe berhasil
tetapi UI gagal, hentikan server Next lama dan jalankan Playwright yang memulai `dev:local` baru.
Jangan mengubah redirect atau pesan login sebelum credential boundary ini terbukti gagal.

## Operasi Phase 7

Import hanya menerima CSV terotorisasi, maksimum 500 row dan 1 MB. Preview yang memiliki satu
invalid/duplicate harus dibatalkan; RPC menjamin zero rows bila transaction gagal. Promotion
mengaktifkan tahun tujuan bersama perpindahan current enrollment dan menyimpan snapshot. Rollback
ditolak bila siswa berubah setelah batch. Alumni archive mempertahankan histori; tombstone hanya
mengganti identitas dan tidak menghapus attendance/enrollment.

## PWA dan cache

Jika offline, hanya `/offline.html` ditampilkan. Jangan menambahkan protected route ke daftar static
cache `public/sw.js`; tidak ada offline queue atau background sync. Setelah perubahan service worker,
naikkan nama cache, jalankan `npm run test:pwa`, dan verifikasi response protected tetap `no-store`.

# Account identity and recovery

SIPEKA tidak mengirim email dan tidak menyediakan self-service recovery.
Super Admin mereset ADMIN/USER dengan temporary password; pengguna wajib
mengganti password. Recovery SUPER_ADMIN dilakukan developer melalui Dashboard
Supabase atau `bootstrap:super-admin` dengan environment lokal/server-only.
Jangan mencetak atau menyimpan synthetic Auth identity, password, token, atau
service key.

Hosted Free tier dibatasi dua project untuk staging dan production; project
dapat dipause setelah tidak aktif. Lakukan backup terenkripsi manual, pantau
ukuran database, dan dokumentasikan rekonsiliasi Auth/profile sebelum recovery.

Akun awal yang direncanakan (tidak dibuat oleh migration atau provisioning
repository): `kuddus` (ADMIN), `intan.admin` (ADMIN), `intan.superadmin`
(SUPER_ADMIN), `suci` (ADMIN), dan `nabila` (ADMIN). Dua akun Intan tetap
terpisah. Temporary password ditentukan di luar repository.

## Real local student bootstrap

1. `npm run db:reset`
2. `npm run migration:real-local:apply`
3. `npm run seed:initial-local-accounts`
4. Jalankan kembali `npm run migration:real-local:apply` untuk membuktikan idempotency.
5. Buat backup data local-only dengan
   `npx supabase db dump --local --data-only -f .local/sipeka-real-local-data.sql`.

Mapping workbook memakai 30 sheet kelas eksplisit. Tiga NIS kosong dan dua NISN
berpanjang invalid yang telah direview menjadi NULL. CSV operasional tidak
memakai kebijakan ini: nilai malformed tetap validation error.
Backup dan credential wajib tetap di `.local/` dengan mode `0600`; enkripsi
sebelum file dipindahkan keluar host lokal.
