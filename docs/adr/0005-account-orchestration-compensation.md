# ADR 0005: Orkestrasi account mutation

Status: Accepted

Supabase Auth dan PostgreSQL tidak berada dalam satu transaksi aplikasi. Mutasi profile-only memakai
RPC `SECURITY DEFINER` yang mengubah profile dan memasukkan audit ACCOUNT dalam satu transaksi:
create, identity/role/status update, reset marker, dan tombstone. Execute RPC hanya diberikan kepada
`service_role`; direct Data API write tetap ditolak.

Create memakai validasi → Auth user → RPC profile+audit. Kegagalan RPC memanggil delete compensation;
kegagalan compensation menghasilkan `PARTIAL_OPERATION` dan recovery server-only. Update email Auth
dilakukan sebelum RPC dan dicoba dikembalikan bila RPC gagal. Reset password dan delete identity
adalah perubahan Auth yang tidak selalu dapat dikembalikan; hasil gagal/parsial tidak pernah
dilaporkan sukses dan masuk recovery runbook. Semua operation memakai result terstruktur dan audit
adalah prasyarat keberhasilan.

Force logout hanya sukses bila gateway mengonfirmasi revocation. API saat ini tidak menerima user id
untuk revokasi global, sehingga hasil `SESSION_REVOCATION_UNSUPPORTED` menulis `FORCE_LOGOUT_FAILED`
dan UI menampilkan keterbatasan yang jujur. Tidak ada perubahan status akun untuk mensimulasikan
revocation. Password/token tidak pernah masuk audit atau log.
