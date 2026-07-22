# Arsitektur

SIPEKA memakai Next.js App Router dengan aliran dependensi:

```text
Presentation -> Application -> Domain <- Repository interface
                                      <- Infrastructure implementation
```

- `src/app`: route, layout, dan komposisi presentation.
- `src/modules/<feature>/domain`: entity, value object, rule, dan repository interface tanpa React,
  Next.js, Supabase, atau browser API.
- `src/modules/<feature>/application`: use case yang mengorkestrasi domain dan repository interface.
- `src/modules/<feature>/infrastructure`: implementasi database dan layanan eksternal.
- `src/modules/<feature>/presentation`: komponen, hook, action tipis, dan schema UI.
- `src/shared`: kode lintas fitur tanpa business rule spesifik fitur.
- `src/infrastructure`: adapter teknis lintas fitur.

Setiap modul harus mempunyai `index.ts` sebagai public API. Impor lintas modul tidak boleh memakai
deep import. `eslint.config.mjs` menegakkan aturan ini serta isolasi domain dan presentation.

`authentication` dan `authorization` adalah modul Phase 1. Domain-nya tidak mengimpor React,
Next.js, Supabase, atau browser API. Gateway Supabase berada di infrastructure; server action dan
route guard tetap tipis. Route placeholder hanya membuktikan guard, bukan UI produk.

Client Supabase dipisah menjadi browser, server cookie, middleware/request boundary, dan admin
server-only. Admin client tidak pernah diimpor `src/app` atau Client Component. `proxy.ts` hanya
me-refresh session; keputusan akses dibuat server-side oleh `requirePageAccess`/`authorizeRequest`.
Direct database access tetap dibatasi RLS.

Phase 2 menambahkan landing page, shared UI primitives, dua application shell yang terpisah, dan
`account-management` dengan batas `domain -> application -> infrastructure`. `profiles` menjadi
sumber daftar akun yang efisien; Supabase Auth Admin hanya dipakai untuk operasi credential.
Mutasi profile memakai RPC server-only agar profile dan audit ACCOUNT atomik; operasi Auth
diorkestrasi dengan compensation. Server Actions tetap tipis dan actor selalu berasal dari session
server. Route yang belum masuk fase
tidak dibuat sebagai halaman palsu; menu roadmap ditampilkan disabled “Segera”.
