# Keamanan Phase 0

- Tidak ada autentikasi, akun, atau data operasional pada Phase 0.
- `.env.example` hanya berisi placeholder; service-role key nyata hanya boleh tersedia server-side.
- Semua sumber data siswa, laporan migrasi ber-PII, dan database dump diabaikan Git.
- Workbook sumber dibaca hanya untuk inventory dan tidak disalin ke aplikasi, fixture, snapshot,
  artifact CI, atau `public/`.
- Hero existing menampilkan individu yang dapat dikenali. Publikasi menunggu konfirmasi izin dan
  hak penggunaan pada Phase 2.
- CI tidak mengunggah database, report migrasi, test trace, atau source data sebagai artifact.

Role, RLS, server authorization, dan database policies dimulai pada Phase 1 sesuai plan.
