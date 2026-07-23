# SIPEKA

SIPEKA adalah Sistem Presensi SMANSA Pamekasan. Repository ini mencakup Phase 3: tahun ajaran,
slot kelas tetap, manajemen siswa, dan pencarian siswa di atas fondasi Auth/RLS serta portal akun
Phase 2.

## Mulai

Prasyarat: Node.js 20.9+ dan Docker (atau rootless Podman) untuk Supabase lokal.

```bash
npm install
cp .env.example .env.local
npx supabase start
npm run db:reset
npm run seed:test-users
  npm run dev
```

Turunan asset publik dibuat dari sumber lokal read-only dan diverifikasi dengan `npm run test:assets`.
Fitur presensi, dashboard statistik, import, laporan presensi, promotion massal, alumni, audit
operasional UI, dan PWA belum dibuka. Workbook siswa existing tidak dibaca atau diimpor.

Jangan mengganti placeholder dengan kredensial produksi. File data siswa lokal bersifat read-only
dan harus tetap di lokasi yang diabaikan Git.

## Quality gates

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run test:e2e
npm run build
npm run test:bundle
npm run db:types:check
npm audit
```

Lihat `docs/development.md` untuk setup lengkap dan `docs/implementation-plan.md` untuk source of
truth produk.

## Route Phase 3

- `/manajemen-kelas` — ADMIN: tahun ajaran dan 30 slot X-1 sampai XII-10.
- `/manajemen-siswa` — ADMIN: mutasi siswa melalui RPC transaksional.
- `/siswa` dan `/siswa/[id]` — ADMIN/USER: pencarian dan detail dasar read-only untuk USER.

Direct Data API write tetap ditolak. Mutation memakai RPC `phase3_*` dengan actor dari session,
validasi database, dan audit OPERATIONAL dalam transaction yang sama.
