begin;

select plan(15);

select has_function(
  'public',
  'phase13_get_class_dashboard',
  array['uuid', 'date'],
  'dashboard kelas tersedia'
);
select has_function(
  'public',
  'phase13_import_students_bulk',
  array['jsonb', 'uuid'],
  'bulk import transaksional tersedia'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('6a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase13-admin@example.test', '', now()),
  ('6a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase13-user@example.test', '', now()),
  ('6a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'phase13-super@example.test', '', now());

insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('6a000000-0000-4000-8000-000000000001', 'phase13.admin', 'phase13-admin@example.test', 'Admin Phase 13 Sintetis', 'ADMIN', true, false),
  ('6a000000-0000-4000-8000-000000000002', 'phase13.user', 'phase13-user@example.test', 'User Phase 13 Sintetis', 'USER', true, false),
  ('6a000000-0000-4000-8000-000000000003', 'phase13.super', 'phase13-super@example.test', 'Super Phase 13 Sintetis', 'SUPER_ADMIN', true, false);

select set_config('request.jwt.claim.sub', '6a000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.phase3_create_student('Hadir Tanpa Record Phase 13', '970101', '9970100001', 'P', 'X', '20000000-0000-4000-8000-000000000001', 2026, true)$$,
  'fixture siswa tanpa record ketidakhadiran dibuat'
);
select lives_ok(
  $$select public.phase3_create_student('Campuran Phase 13', '970102', '9970100002', 'L', 'X', '20000000-0000-4000-8000-000000000001', 2026, true)$$,
  'fixture siswa status campuran dibuat'
);
select lives_ok(
  $$select public.phase3_create_student('Tanpa Keterangan Phase 13', '970103', '9970100003', 'P', 'X', '20000000-0000-4000-8000-000000000001', 2026, true)$$,
  'fixture siswa tanpa keterangan dibuat'
);

reset role;
insert into public.attendance_records (
  student_id,
  class_id,
  attendance_date,
  period_number,
  status,
  created_by,
  updated_by
)
values
  ((select id from public.students where nis = '970102'), '20000000-0000-4000-8000-000000000001', '2026-07-15', 1, 'IZIN', '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001'),
  ((select id from public.students where nis = '970102'), '20000000-0000-4000-8000-000000000001', '2026-07-15', 2, 'IZIN', '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001'),
  ((select id from public.students where nis = '970102'), '20000000-0000-4000-8000-000000000001', '2026-07-15', 3, 'SAKIT', '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001'),
  ((select id from public.students where nis = '970103'), '20000000-0000-4000-8000-000000000001', '2026-07-15', 1, 'TANPA_KETERANGAN', '6a000000-0000-4000-8000-000000000001', '6a000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claim.sub', '6a000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select lives_ok(
  $$select public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')$$,
  'USER dapat membaca dashboard kelas'
);
select is(
  jsonb_array_length(public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'total'),
  2,
  'Total menghitung siswa unik yang mempunyai record ketidakhadiran'
);
select ok(
  not exists (
    select 1
    from jsonb_array_elements(public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'total') item
    where item->>'full_name' = 'Hadir Tanpa Record Phase 13'
  ),
  'siswa tanpa record ketidakhadiran tidak masuk kolom Total'
);
select is(
  jsonb_array_length(public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'izin'),
  1,
  'Izin menghitung siswa unik'
);
select is(
  (public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'izin'->0->'periods')::text,
  '[1, 2]',
  'Izin menampilkan nomor jam unik dan terurut'
);
select is(
  jsonb_array_length(public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'sakit'),
  1,
  'Sakit menghitung siswa unik'
);
select is(
  jsonb_array_length(public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'tanpa_keterangan'),
  1,
  'Tanpa Keterangan menghitung siswa unik'
);
select is(
  (
    select concat_ws(',', item->>'izin', item->>'sakit', item->>'tanpa_keterangan')
    from jsonb_array_elements(public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')->'monthly') item
    where item->>'date' = '2026-07-15'
  ),
  '1,1,1',
  'tren bulanan menghitung siswa unik per status'
);

reset role;
select set_config('request.jwt.claim.sub', '6a000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_like(
  $$select public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')$$,
  '%CLASS_DASHBOARD_FORBIDDEN%',
  'SUPER_ADMIN ditolak dari dashboard kelas'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;
select throws_like(
  $$select public.phase13_get_class_dashboard('20000000-0000-4000-8000-000000000001', '2026-07-15')$$,
  '%permission denied%',
  'anonymous tidak dapat menjalankan dashboard kelas'
);

select * from finish();
rollback;
