# Keamanan Phase 1 dan Phase 2

- `.env.example` hanya placeholder. `SUPABASE_SERVICE_ROLE_KEY` hanya dibaca module `server-only`
  dan tidak diekspor melalui barrel yang dapat masuk client bundle.
- Browser memakai URL dan publishable/anon key. Session server memakai cookie Supabase SSR dan
  role selalu dibaca ulang dari `profiles`, bukan dari metadata browser/JWT yang dapat dimanipulasi.
- Helper `SECURITY DEFINER` berada di schema `private`, memakai `SET search_path = ''`, objek
  fully-qualified, dan execute grant eksplisit. `service_role` mendapat privilege tabel eksplisit
  hanya untuk module admin server-side.
- Tidak ada route registrasi. Provisioning akun test dan bootstrap Super Admin memakai service-role
  client server-only serta credential dari environment lokal.
- Portal Super Admin memakai repository service-only. Daftar akun dipaginasi dan difilter di server;
  browser tidak menerima service-role key, actor id, password, token, atau cookie.
- Seluruh mutasi akun mengembalikan result terstruktur dan hanya sukses setelah audit ACCOUNT
  berhasil. Create, update identity/role/status, reset marker, dan tombstone memakai RPC
  profile+audit atomik; create menghapus Auth user sebagai compensation bila RPC gagal.
- Penghapusan akun memakai access tombstone pada profile dan identity Auth: email Auth menjadi
  `deleted+<uuid>@invalid.local`, password diacak, profile username menjadi `deleted_<32 hex>`,
  email null, dan inactive. Foreign key profile tetap dipertahankan, snapshot audit tidak hilang,
  dan email lama dapat digunakan kembali setelah Auth update sukses.
- Supabase Admin API membutuhkan JWT target untuk revokasi sesi. Karena portal tidak memiliki JWT
  tersebut, force logout saat ini menghasilkan `SESSION_REVOCATION_UNSUPPORTED` dan audit
  `FORCE_LOGOUT_FAILED`; UI tidak menampilkan sukses. Reset/nonaktif memakai profile guard pada
  setiap request sebagai defense-in-depth, bukan simulasi revocation.

## Mutasi akun dan recovery

Actor selalu berasal dari session SUPER_ADMIN server-side. Browser tidak mengirim actor, credential,
token, atau audit action yang dipercaya. Auth dan database tidak satu transaksi; structured log hanya
memuat operation, request id, target id, status, dan error code. Jika Auth berhasil tetapi RPC/audit
gagal, hasil `PARTIAL_OPERATION` memerlukan recovery runbook dan tidak boleh diberi toast sukses.

## Katalog hasil dan audit akun

| Operasi               | Audit sukses              | Audit gagal           | Result gagal/khusus                                  |
| --------------------- | ------------------------- | --------------------- | ---------------------------------------------------- |
| CREATE                | `CREATE`                  | — (RPC rollback)      | `DATABASE_FAILURE`, `PARTIAL_OPERATION`              |
| UPDATE / ROLE_CHANGE  | `UPDATE` / `ROLE_CHANGE`  | — (RPC rollback)      | `AUDIT_FAILURE`, `PARTIAL_OPERATION`                 |
| ACTIVATE / DEACTIVATE | `ACTIVATE` / `DEACTIVATE` | — (RPC rollback)      | `AUDIT_FAILURE`                                      |
| RESET_PASSWORD        | `RESET_PASSWORD`          | — (RPC rollback)      | `AUTH_PROVIDER_FAILURE`, `PARTIAL_OPERATION`         |
| FORCE_LOGOUT          | `FORCE_LOGOUT`            | `FORCE_LOGOUT_FAILED` | `SESSIONS_REVOKED`, `SESSION_REVOCATION_UNSUPPORTED` |
| DELETE                | `DELETE`                  | — (RPC rollback)      | `AUTH_PROVIDER_FAILURE`, `PARTIAL_OPERATION`         |

`AUDIT_FAILURE` berarti perubahan tidak dianggap berhasil. `PARTIAL_OPERATION` berarti Auth dan
database mungkin tidak sinkron dan harus dipulihkan melalui server-only runbook. Audit snapshot hanya
memuat identitas akun dan status; password, token, cookie, session id, serta service key selalu
dihilangkan.

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

## Phase 3 RPC boundary

RPC `phase3_create_academic_year`, `phase3_update_academic_year`, `phase3_activate_academic_year`,
`phase3_update_class`, `phase3_create_student`, `phase3_update_student_identity`, dan
`phase3_change_student_academic` hanya dapat dipanggil role `authenticated` setelah fungsi internal
memverifikasi `auth.uid()` ke profile `ADMIN`, `is_active=true`, dan `must_change_password=false`.
Role claim browser/JWT tambahan tidak dipercaya. USER, SUPER_ADMIN, anonymous, ADMIN nonaktif, dan
ADMIN wajib ganti password ditolak. Fungsi memakai `SECURITY DEFINER`, `SET search_path=''`, objek
fully-qualified, revoke PUBLIC/anon, serta actor server-side.

RPC mengubah tabel terkait dan menulis audit OPERATIONAL dalam satu transaction. Audit failure
merollback mutation; direct table write tetap gagal. Event Phase 3: `ACADEMIC_YEAR_CREATE`,
`ACADEMIC_YEAR_UPDATE`, `ACADEMIC_YEAR_ACTIVATE`, `CLASS_UPDATE`, `CLASS_ACTIVATE`,
`CLASS_DEACTIVATE`, `STUDENT_CREATE`, `STUDENT_UPDATE`, `STUDENT_MOVE_CLASS`,
`STUDENT_CHANGE_GRADE`, `STUDENT_ACTIVATE`, dan `STUDENT_DEACTIVATE`.

Search adalah `SECURITY INVOKER` agar RLS session tetap berlaku. USER menerima daftar/detail dasar;
SUPER_ADMIN tidak menerima operational rows. Tidak ada data workbook existing dalam seed, fixture,
log, snapshot, atau response.

## Data sensitif

Semua sumber siswa, report migrasi ber-PII, dump, credential lokal, dan session output di-ignore
Git. Workbook existing tetap read-only dan tidak pernah disalin ke aplikasi, fixture, snapshot,
log, artifact CI, atau `public/`. Logo dan hero memakai turunan WebP yang metadata non-esensialnya
di-strip; izin publikasi hero tetap tanggung jawab pemilik deployment.

## Phase 4 attendance

RPC preview/apply memanggil helper ADMIN aktif berdasarkan `auth.uid()`, memakai `SECURITY DEFINER`,
`search_path=''`, fully-qualified object, revoke default, dan execute grant eksplisit. Token preview
tidak dapat dipakai actor/scope/payload lain, kadaluarsa setelah sepuluh menit, sekali pakai, dan
ditolak bila snapshot attendance berubah. Direct table mutation, revision write, token-table read,
serta audit write tetap tidak tersedia bagi client.

## Phase 5 dashboard

Dashboard tidak mempunyai jalur mutation. Query statistik diberikan hanya kepada role runtime
`authenticated`, tetap memeriksa profile aktif dan role operasional dari database, menggunakan RLS
session biasa, dan menolak `SUPER_ADMIN` serta anonymous. Service role tidak digunakan untuk read
dashboard.
