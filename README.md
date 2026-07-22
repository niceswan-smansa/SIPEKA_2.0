# SIPEKA

SIPEKA adalah Sistem Presensi SMANSA Pamekasan. Repository ini baru mencakup Phase 0:
governance, scaffold, quality gates, dan konfigurasi pengembangan lokal.

## Mulai

Prasyarat: Node.js 20.9+ dan Docker untuk Supabase lokal.

```bash
npm install
cp .env.example .env.local
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
```

Lihat `docs/development.md` untuk setup lengkap dan `docs/implementation-plan.md` untuk source of
truth produk.
