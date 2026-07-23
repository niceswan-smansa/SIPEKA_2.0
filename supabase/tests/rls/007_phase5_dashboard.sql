begin;

select plan(13);

select has_index(
  'public',
  'attendance_records',
  'attendance_records_date_idx',
  'dashboard memakai index tanggal presensi'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('63000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'dashboard-admin@example.test', '', now()),
  ('63000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'dashboard-user@example.test', '', now()),
  ('63000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'dashboard-super@example.test', '', now());
insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('63000000-0000-4000-8000-000000000001', 'dashboard.admin', 'dashboard-admin@example.test', 'Admin Dashboard Sintetis', 'ADMIN', true, false),
  ('63000000-0000-4000-8000-000000000002', 'dashboard.user', 'dashboard-user@example.test', 'User Dashboard Sintetis', 'USER', true, false),
  ('63000000-0000-4000-8000-000000000003', 'dashboard.super', 'dashboard-super@example.test', 'Super Dashboard Sintetis', 'SUPER_ADMIN', true, false);

select set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select lives_ok(
  $$select public.phase3_create_student('Dashboard Satu Sintetis', '960001', '9960000001', 'P', 'X', '20000000-0000-4000-8000-000000000001', 2026, true)$$,
  'fixture siswa pertama dibuat'
);
select lives_ok(
  $$select public.phase3_create_student('Dashboard Dua Sintetis', '960002', '9960000002', 'L', 'X', '20000000-0000-4000-8000-000000000001', 2026, true)$$,
  'fixture siswa kedua dibuat'
);

reset role;
insert into public.attendance_records (
  student_id, class_id, attendance_date, period_number, status, created_by, updated_by
)
values
  ((select id from public.students where nis = '960001'), '20000000-0000-4000-8000-000000000001', current_date, 1, 'IZIN', '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001'),
  ((select id from public.students where nis = '960001'), '20000000-0000-4000-8000-000000000001', current_date, 2, 'IZIN', '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001'),
  ((select id from public.students where nis = '960001'), '20000000-0000-4000-8000-000000000001', current_date, 3, 'SAKIT', '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001'),
  ((select id from public.students where nis = '960002'), '20000000-0000-4000-8000-000000000001', current_date, 1, 'TANPA_KETERANGAN', '63000000-0000-4000-8000-000000000001', '63000000-0000-4000-8000-000000000001');

set local role authenticated;
select is((public.phase5_get_dashboard(current_date)->'summary'->>'total')::integer, 2, 'summary menghitung dua siswa unik');
select is((public.phase5_get_dashboard(current_date)->'summary'->>'izin')::integer, 1, 'dua period izin dihitung satu siswa');
select is((public.phase5_get_dashboard(current_date)->'summary'->>'sakit')::integer, 1, 'mixed category tetap menghitung kategori siswa');
select is((public.phase5_get_dashboard(current_date)->'summary'->>'tanpa_keterangan')::integer, 1, 'tanpa keterangan menghitung siswa unik');
select is(jsonb_array_length(public.phase5_get_dashboard(current_date)->'daily'), 30, 'daily memuat 30 kelas aktif termasuk nilai nol');
select is(jsonb_array_length(public.phase5_get_dashboard(current_date)->'weekly'), 6, 'weekly memuat Senin sampai Sabtu');
select is((select max((item->>'total')::integer) from jsonb_array_elements(public.phase5_get_dashboard(current_date)->'monthly') item), 2, 'monthly menghitung siswa unik per tanggal');

reset role;
select set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select lives_ok($$select public.phase5_get_dashboard(current_date)$$, 'USER dapat membaca dashboard');

reset role;
select set_config('request.jwt.claim.sub', '63000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_like($$select public.phase5_get_dashboard(current_date)$$, '%DASHBOARD_FORBIDDEN%', 'SUPER_ADMIN ditolak');

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_like($$select public.phase5_get_dashboard(current_date)$$, '%permission denied%', 'anonymous tidak dapat menjalankan query dashboard');

select * from finish();
rollback;
