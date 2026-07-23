# Account Identity Hardening

## Scope

- Login username/password untuk semua role.
- Synthetic confirmed Supabase Auth identity dibuat dan dibaca server-only.
- `profiles.email` selalu `NULL`; account UI/read model/audit tidak membawa email.
- Username update tidak mengubah Auth identity.
- Public signup dan email signup dinonaktifkan; tidak ada recovery, magic-link, atau OTP route.
- Bootstrap/recovery SUPER_ADMIN tetap server-only.

## Migration

`20260723080000_username_only_identity.sql` membersihkan email profile, menambah trigger yang
memaksa `NULL`, dan constraint `profiles_email_must_be_null`.

## Security

Resolver username memakai profile ID untuk mengambil Auth user melalui Admin API, lalu identity
langsung dipakai oleh server session client. Browser hanya mengirim username/password. Synthetic
identity tidak masuk credential fixture, client bundle, audit snapshot, atau UI. Direct profile
write dan role isolation tetap ditutup.

## Verification

Unit test mencakup normalisasi/login username, generic error, account create tanpa email, dan
username update tanpa Auth mutation. pgTAP mencakup profile email invariant dan direct-write
privilege. Local Auth policy test membuktikan fixture tidak memuat identity, profile email null,
public signup ditolak, dan recovery routes tidak tersedia.

Tidak ada akun production, password production, deployment, data siswa, atau perubahan fitur
operasional pada checkpoint ini.
