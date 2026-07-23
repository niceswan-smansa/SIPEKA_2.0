# ADR 0010: Username-only account identity

Status: Accepted

SIPEKA hanya meminta username dan password. `profiles.email` selalu `NULL`.
Supabase Auth tetap menerima password sign-in melalui synthetic email acak yang
dibuat server-side, confirmed langsung melalui Admin API, dan tidak pernah
ditampilkan, dicatat, atau dikirim ke browser. Username tidak berasal dari atau
mengubah identity Auth.

Tidak ada signup publik, email verification, email recovery, magic link, OTP,
atau MFA aplikasi. Reset ADMIN/USER dilakukan Super Admin dengan temporary
password dan `must_change_password`; pemulihan SUPER_ADMIN dilakukan developer
melalui Dashboard Supabase atau tool server-only.

Saat tombstone, Auth identity diganti identity acak pada domain invalid dan
password diacak; profile tombstone dipertahankan untuk histori. Desain hanya
menggunakan fitur password/Admin API Supabase Free dan tidak memerlukan SMTP.
