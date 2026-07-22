# Panduan Developer

## Setup

1. Gunakan Node.js 20.9+ dan Docker.
2. Jalankan `npm install`.
3. Salin `.env.example` menjadi `.env.local` dan gunakan hanya nilai lokal.
4. Jalankan `npx supabase start` bila mengerjakan database.
5. Jalankan `npm run dev` untuk aplikasi.

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
