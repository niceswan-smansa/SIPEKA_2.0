# SIPEKA

SIPEKA adalah Sistem Presensi SMANSA Pamekasan. Repository ini mencakup Phase 1: fondasi database,
Supabase Auth server-side, authorization, RLS, dan placeholder guard. UI produk belum dibuat.

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
