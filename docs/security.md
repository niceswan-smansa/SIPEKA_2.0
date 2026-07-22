# Keamanan Phase 1

- `.env.example` hanya placeholder. `SUPABASE_SERVICE_ROLE_KEY` hanya dibaca module `server-only`
  dan tidak diekspor melalui barrel yang dapat masuk client bundle.
- Browser memakai URL dan publishable/anon key. Session server memakai cookie Supabase SSR dan
  role selalu dibaca ulang dari `profiles`, bukan dari metadata browser/JWT yang dapat dimanipulasi.
- Helper `SECURITY DEFINER` berada di schema `private`, memakai `SET search_path = ''`, objek
  fully-qualified, dan execute grant eksplisit. `service_role` mendapat privilege tabel eksplisit
  hanya untuk module admin server-side.
- Tidak ada route registrasi. Provisioning akun test dan bootstrap Super Admin memakai service-role
  client server-only serta credential dari environment lokal.

## Matriks RLS

| Aktor             | Operasional                                             | Profil                                                 | Audit                                      |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| anonymous         | tidak ada akses                                         | tidak ada akses                                        | tidak ada akses                            |
| USER aktif        | read-only                                               | profil sendiri, field administratif tidak dapat diubah | tidak ada                                  |
| ADMIN aktif       | read-only melalui Data API; mutasi menunggu service/RPC | tidak dapat mengubah role/status                       | baca scope `OPERATIONAL`                   |
| SUPER_ADMIN aktif | tidak ada akses                                         | profil sendiri                                         | baca scope `ACCOUNT` melalui policy portal |

Akun nonaktif dan akun `must_change_password` kehilangan akses operasional pada helper dan policy.
Client tidak dapat melakukan INSERT/UPDATE/DELETE pada tabel bisnis atau `audit_logs`. Mutasi hanya
akan dibuka melalui scoped server service atau RPC terotorisasi pada phase fitur masing-masing,
dengan validasi, transaction, revision history, dan audit. Critical invariants tetap ditegakkan
oleh constraint/trigger database.

## Data sensitif

Semua sumber siswa, report migrasi ber-PII, dump, credential lokal, dan session output di-ignore
Git. Workbook existing tetap read-only dan tidak pernah disalin ke aplikasi, fixture, snapshot,
log, artifact CI, atau `public/`. Logo/hero belum diintegrasikan.
