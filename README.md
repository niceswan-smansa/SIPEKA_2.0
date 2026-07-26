# SIPEKA

**SIPEKA — Sistem Presensi SMANSA Pamekasan** adalah aplikasi presensi berbasis web untuk
pengelolaan siswa, presensi per jam pelajaran, dashboard, laporan Excel, import CSV, kenaikan grade,
alumni, akun, dan audit operasional.

Production: **https://www.sipekasmansa.online/**

## Fitur utama

- Login username-only dengan role `USER`, `ADMIN`, dan `SUPER_ADMIN`.
- Pengaturan awal dan wizard tahun ajaran, 30 slot kelas tetap, pencarian siswa/kelas, serta dashboard kelas.
- Presensi 10 jam pelajaran dengan preview transaksi, bulk status, dan bulk Hadir.
- Dashboard tanggal/bulan, detail siswa, kalender, statistik hari/jam, dan histori revisi.
- Laporan individual serta workbook per grade untuk periode bulanan atau rentang tanggal.
- Import CSV bulk lintas kelas secara all-or-none, promotion X→XI→XII→Alumni, rollback snapshot, arsip, dan tombstone.
- Audit akun dan audit operasional yang terpisah.
- PWA online-only; fungsi operasional membutuhkan koneksi.

NIS dan NISN bersifat **opsional**. UUID internal merupakan identity canonical. Identifier yang
diisi tetap harus valid dan unik.

## Batas akses

| Area                                    |  USER | ADMIN | SUPER_ADMIN |
| --------------------------------------- | ----: | ----: | ----------: |
| Dashboard, daftar/detail siswa          |  Baca |  Baca |       Tidak |
| Input/koreksi presensi                  | Tidak |    Ya |       Tidak |
| Kelas, siswa, import, promotion, alumni | Tidak |    Ya |       Tidak |
| Export Excel                            | Tidak |    Ya |       Tidak |
| Portal dan audit akun                   | Tidak | Tidak |          Ya |

Mutation bisnis tidak dilakukan melalui direct Data API. Semua mutation memakai RPC transaksional,
actor dari session, validasi database, RLS/grant, dan audit.

## Teknologi

- Next.js 16, React 19, TypeScript 6
- Supabase lokal/staging/production
- Vitest, pgTAP, Playwright
- Vercel
- ExcelJS

Prasyarat lokal: Node.js 24.x dan Docker atau rootless Podman.

## Setup lokal

```bash
npm ci
cp .env.example .env.local
npx supabase start
npm run db:reset
npm run seed:test-users
npm run dev:local
```

Jangan memasukkan credential production atau data siswa production ke repository/lokal. Semua
fixture pengujian harus sintetis.

## Quality gates

```bash
npm run test:dependency-policy
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run test:migration-policy
npm run test:assets
npm run test:pwa
npm run test:db
npm run db:types:check
npm run test:auth-policy
npm run test:e2e
npm run test:e2e:cross-browser
npm run test:performance
npm run build
npm run test:bundle
```

- `test:e2e` menjalankan seluruh functional suite pada Chromium.
- `test:e2e:cross-browser` menjalankan smoke read-only pada Firefox dan WebKit.
- `test:performance` mengirim authenticated concurrent read requests ke Supabase lokal.
- `test:e2e` tidak mereset database. Gunakan `test:e2e:reset` hanya pada database localhost
  disposable dengan flag dan sentinel yang diwajibkan.
- Coverage awal: lines/statements/functions 70%, branches 60% pada domain, application, dan shared
  core. Angka ini adalah baseline minimum, bukan target akhir.

Rincian lengkap terdapat di [`docs/testing.md`](docs/testing.md).

## Import dan data lama

Template CSV:

```text
NIS,NISN,NAMA,JENIS_KELAMIN
10001,0091234567,Nabila Putri,P
,,Siswa Tanpa Identifier,L
```

Dry-run workbook lokal:

```bash
npm run migration:dry-run
```

Output hanya berupa summary redacted di `.local/migration-dry-run.json`. NIS/NISN kosong dicatat,
tetapi bukan invalid. Nama, gender, mapping kelas, dan keunikan identifier non-kosong tetap wajib.

## Deployment

Push ke `main` memicu CI dan deployment Vercel. Deployment tidak dianggap sehat hanya karena build
berhasil: quality, database, Chromium E2E, Firefox/WebKit smoke, auth-policy, dan performance smoke
harus lulus.

Smoke production non-destruktif:

```bash
SMOKE_BASE_URL=https://www.sipekasmansa.online npm run smoke:production
```

Jangan menjalankan mutation/load test terhadap production.

## Security dan dependency

- Public signup dan recovery email tidak tersedia.
- Synthetic Auth identity tidak ditampilkan kepada pengguna.
- Service-role key dilarang masuk client bundle.
- Dependency policy menolak semua high/critical.
- Exception moderate rantai `ExcelJS → uuid` didokumentasikan di
  [`docs/dependency-security.md`](docs/dependency-security.md).

## Dokumentasi

- [`docs/development.md`](docs/development.md) — setup dan workflow development.
- [`docs/testing.md`](docs/testing.md) — matriks test dan debugging.
- [`docs/production-readiness.md`](docs/production-readiness.md) — deploy, UAT, backup, dan incident.
- [`docs/runbook.md`](docs/runbook.md) — operasi dan recovery.
