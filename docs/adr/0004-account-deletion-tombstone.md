# ADR 0004: Semantics penghapusan akun Phase 2

Status: Accepted

UI “Hapus Akses” menggunakan access tombstone, bukan cascade delete. Karena foreign key profile ke
`auth.users` harus tetap menjaga histori, Auth identity dianonimkan menjadi email unik
`deleted+<uuid>@invalid.local` (domain tidak nyata), password diacak, dan profile diubah menjadi
username `deleted_<32 hex>`, email null, serta inactive. Admin Auth tidak mengirim email pada operasi
ini. Email lama dapat dipakai kembali setelah Auth update berhasil.

Profile tombstone dan snapshot audit ACCOUNT ditulis melalui RPC transaksional. Operasi idempotent:
retry pada tombstone yang sudah ada tidak mengubah Auth lagi. Auth dan PostgreSQL tidak satu transaksi;
jika Auth berhasil tetapi RPC gagal, hasilnya `PARTIAL_OPERATION` dan recovery server-only harus
memeriksa/menyelesaikan identity tombstone. Password, token, dan nilai tombstone tidak ditampilkan
ke UI atau log. Target self dan SUPER_ADMIN selalu ditolak.
