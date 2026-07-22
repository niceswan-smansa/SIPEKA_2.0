# ADR 0003: Sumber daftar akun yang authoritative

Status: Accepted

Daftar akun portal memakai `public.profiles` sebagai sumber query, karena profile menyimpan username,
nama, role, status, email, dan timestamp yang dibutuhkan UI. Query service-role dipaginasi, difilter,
dan di-sort di server. Supabase Auth Admin tetap menjadi sumber operasi credential, bukan daftar UI;
pendekatan ini menghindari `listUsers` lalu N+1 lookup profile.
