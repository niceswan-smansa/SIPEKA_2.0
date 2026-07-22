# Panduan Developer

## Setup

1. Gunakan Node.js 20.9+ dan Docker (atau rootless Podman untuk lokal).
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local` dan gunakan hanya nilai lokal.
4. Jalankan `npx supabase start`, `npm run db:reset`, dan `npm run db:types` bila mengerjakan
   database.
5. Jalankan `npm run seed:test-users` untuk akun disposable lokal.
6. Jalankan `npm run dev` untuk aplikasi; `npm run dev:local` otomatis membaca environment
   Supabase lokal.

## Environment

`.env.example` hanya mendokumentasikan `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` placeholder. Service-role
key tidak boleh dipasang pada `NEXT_PUBLIC_*` atau Client Component. Credential bootstrap/test hanya
dibaca script server-only dari environment lokal dan jangan di-commit.

## Database test

`npm run test:db` memakai pgTAP di Supabase lokal dengan session/JWT role sintetis untuk anonymous,
USER, ADMIN, SUPER_ADMIN, akun nonaktif, dan must-change. Test mencakup RLS matrix, helper
anti-escalation, constraint unik, grade/class validation, dan audit append-only.

## Aturan kontribusi

- Baca `AGENTS.md` dan `docs/implementation-plan.md` seluruhnya.
- Kerjakan satu phase, gunakan public API modul, dan tambahkan test bersama perubahan.
- Migration yang sudah merge tidak boleh diedit.
- Jangan commit secret, data siswa, dump, export, atau report ber-PII.
- User-facing text menggunakan Bahasa Indonesia; identifier internal konsisten dalam bahasa Inggris.

## Branch protection yang disarankan

Lindungi `main`, wajibkan pull request dan satu approval, larang force-push, wajibkan branch up to
date, serta jadikan seluruh job workflow `CI` sebagai required status checks. Aktifkan secret
scanning dan dependency update alerts pada host Git.
