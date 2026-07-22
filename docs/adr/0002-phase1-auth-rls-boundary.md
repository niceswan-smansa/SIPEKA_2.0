# ADR 0002: Phase 1 Auth dan RLS Boundary

## Status

Accepted untuk Phase 1.

## Context

Authentication memakai Supabase Auth, sedangkan role aktif dan status akun berada di
`public.profiles`. Browser tidak boleh dipercaya untuk menentukan role. Database harus tetap aman
ketika API dipanggil langsung tanpa UI.

## Decision

- Gunakan client Supabase terpisah untuk browser, server cookie, middleware, dan server-only admin.
- Resolver username/email dan perubahan password berjalan melalui server action/gateway; tidak ada
  registrasi publik atau RPC business fase berikutnya.
- Helper role menggunakan `SECURITY DEFINER`, schema `private`, `search_path` kosong, fully-qualified
  objects, serta execute grants minimal.
- RLS mengizinkan USER dan ADMIN membaca operasional, SUPER_ADMIN hanya portal/account scope, dan
  anonymous tidak punya akses. Direct business mutation serta direct audit write ditolak; phase
  fitur membukanya hanya melalui scoped server service atau RPC terotorisasi.
- `pg_trgm` dipakai hanya untuk index pencarian normalized student name. SQL migration tetap source
  of truth; Prisma tidak digunakan.

## Consequences

Policy dan helper dapat diuji dengan JWT/session sintetis sebelum UI produk ada. Account service
berikutnya harus tetap server-only dan tidak boleh memperluas privilege SUPER_ADMIN ke data
operasional. Business RPC atomic untuk attendance/import/promotion sengaja ditunda ke phase pemiliknya.
