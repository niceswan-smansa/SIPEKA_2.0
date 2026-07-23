# SIPEKA

SIPEKA adalah Sistem Presensi SMANSA Pamekasan. Repository ini mencakup detail presensi dan laporan
individual Phase 6 di atas fondasi Auth/RLS, portal akun, manajemen siswa, input presensi, dan
dashboard Phase 1–5.

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
Import CSV, promotion/rollback, alumni, audit operasional, dan PWA online-only tersedia. Workbook
existing hanya dibaca oleh dry-run local yang menghasilkan summary redacted; belum diimpor.

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
npm run test:pwa
npm run db:types:check
npm audit
```

Lihat `docs/development.md` untuk setup lengkap dan `docs/implementation-plan.md` untuk source of
truth produk.

## Route operasional

- `/manajemen-kelas` — ADMIN: tahun ajaran dan 30 slot X-1 sampai XII-10.
- `/manajemen-siswa` — ADMIN: mutasi siswa melalui RPC transaksional.
- `/presensi/input` — ADMIN: preview dan apply presensi transaksional.
- `/dashboard` — ADMIN/USER: statistik siswa unik berdasarkan tanggal.
- `/siswa` dan `/siswa/[id]` — ADMIN/USER: pencarian, detail, kalender, statistik, dan histori.
- `/siswa/[id]/laporan` — ADMIN/USER: laporan individual read-only; export Excel hanya ADMIN.
- `/import-siswa`, `/naik-turun-grade`, `/alumni`, `/riwayat-aktivitas` — ADMIN.

Direct Data API write tetap ditolak. Mutation memakai RPC `phase3_*` dengan actor dari session,
validasi database, dan audit OPERATIONAL dalam transaction yang sama. Editor detail siswa memakai
engine preview/apply Phase 4 yang sama; tidak ada mutation presensi kedua.
