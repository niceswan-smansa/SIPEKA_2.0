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

Phase 0 sengaja tidak membuat modul fitur kosong. Modul dibuat pada phase pemiliknya agar tidak ada
API spekulatif.
