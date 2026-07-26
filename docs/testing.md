# Testing SIPEKA

## Lapisan test

| Lapisan           | Command                          | Tujuan                                   |
| ----------------- | -------------------------------- | ---------------------------------------- |
| Dependency policy | `npm run test:dependency-policy` | Menolak vulnerability di luar exception  |
| Static            | `format`, `lint`, `typecheck`    | Konsistensi dan correctness compile-time |
| Unit              | `npm run test`                   | Domain/application/shared core           |
| Coverage          | `npm run test:coverage`          | Baseline cabang dan kode core            |
| Migration policy  | `npm run test:migration-policy`  | NIS/NISN opsional, identifier unik       |
| Database          | `npm run test:db`                | Constraint, RLS, RPC, transaction, audit |
| Auth policy       | `npm run test:auth-policy`       | Username-only, signup/recovery ditolak   |
| Chromium E2E      | `npm run test:e2e`               | Seluruh alur bisnis dan mutation         |
| Cross-browser     | `npm run test:e2e:cross-browser` | Render dan native controls read-only     |
| Performance       | `npm run test:performance`       | Concurrent authenticated reads           |
| Production smoke  | `npm run smoke:production`       | Landing, guard, manifest, headers        |

## Browser matrix

- Chromium: seluruh functional E2E.
- Firefox: smoke read-only landing, login, role guard, halaman operasional, file/month/select control.
- WebKit: smoke read-only yang sama.
- Mutation tidak diulang lintas browser agar fixture tidak saling mencemari; correctness mutation
  tetap diuji penuh pada Chromium dan database transaction tests.

## Coverage

Coverage berlaku untuk domain, application, dan shared core.

Baseline minimum:

- lines 70%
- statements 70%
- functions 70%
- branches 60%

Presentation, server adapter, dan Supabase repository lebih tepat diverifikasi melalui database/E2E,
bukan dipaksa menjadi unit coverage semu.

## Database disposable

```bash
npx supabase start
npm run db:reset
node tools/refresh-local-gateway.mjs
npm run seed:test-users
npm run probe:test-auth
npm run test:auth-policy
npm run test:e2e
```

Jangan arahkan destructive E2E ke host selain `127.0.0.1`/`localhost`.

## Simulasi realistis sekolah tiga tahun

Simulasi khusus ini menjalankan alur Admin melalui browser pada database lokal disposable:

- 60 import kelas dilakukan satu per satu melalui halaman Import Siswa;
- 90 class-day presensi disimpan melalui halaman Input Presensi;
- 27 mutasi siswa dilakukan melalui Manajemen Siswa;
- tiga promotion dilakukan melalui wizard Naik / Turun Grade;
- Pencarian Kelas, alumni, audit, detail siswa, dan export Excel diverifikasi melalui UI;
- fixture lokal mengisi 333.000 record presensi untuk 180 hari sekolah pada masing-masing dari tiga
  tahun ajaran selesai, ditambah data awal tahun keempat.

Fixture volume menggunakan service role lokal hanya untuk mempercepat pengisian hari-hari latar.
Import, presensi representatif, mutasi, promotion, dan verifikasi tetap memakai UI/RPC aplikasi.
Test menolak host non-local dan tidak boleh dijalankan terhadap staging atau production.

```bash
mkdir -p .local
printf 'disposable\n' > .local/e2e-disposable
SIPEKA_E2E_DISPOSABLE=true npm run test:e2e:school-cycle
```

Normal `npm run test:e2e` melewati file simulasi ini. CI menjalankannya sebagai langkah terpisah pada
stack Supabase disposable.

## Performance smoke

Default lokal: concurrency 5, rounds 3, p95 maksimum 6000 ms.

```bash
PERF_CONCURRENCY=4 PERF_ROUNDS=2 PERF_P95_MS=10000 npm run test:performance
```

Ini regression/load smoke, bukan capacity benchmark production. Dilarang menjalankannya ke production.

## Debugging Playwright

```bash
npx playwright show-trace test-results/<test>/trace.zip
```

CI menyimpan `playwright-report` dan `test-results` selama tujuh hari bila E2E gagal. Reset database
sebelum full suite setelah targeted test yang melakukan mutation.
