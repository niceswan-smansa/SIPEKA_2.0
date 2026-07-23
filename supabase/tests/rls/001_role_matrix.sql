begin;

select plan(37);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('40000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'super.test@sipeka.test', '', now()),
  ('40000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'admin.test@sipeka.test', '', now()),
  ('40000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'user.test@sipeka.test', '', now()),
  ('40000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'inactive.test@sipeka.test', '', now()),
  ('40000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'change.test@sipeka.test', '', now());

insert into public.profiles (
  id,
  username,
  email,
  full_name,
  role,
  is_active,
  must_change_password
)
values
  ('40000000-0000-4000-8000-000000000001', 'super.test', 'super.test@sipeka.test', 'Super Admin Sintetis', 'SUPER_ADMIN', true, false),
  ('40000000-0000-4000-8000-000000000002', 'admin.test', 'admin.test@sipeka.test', 'Admin Sintetis', 'ADMIN', true, false),
  ('40000000-0000-4000-8000-000000000003', 'user.test', 'user.test@sipeka.test', 'User Sintetis', 'USER', true, false),
  ('40000000-0000-4000-8000-000000000004', 'inactive.test', 'inactive.test@sipeka.test', 'Akun Nonaktif Sintetis', 'USER', false, false),
  ('40000000-0000-4000-8000-000000000005', 'change.test', 'change.test@sipeka.test', 'Akun Ganti Password Sintetis', 'ADMIN', true, true);

insert into public.students (
  id,
  nis,
  nisn,
  full_name,
  normalized_name,
  gender,
  current_grade,
  current_class_id,
  created_by,
  updated_by
)
values (
  '41000000-0000-4000-8000-000000000001',
  '910001',
  '9910000001',
  'Siswa RLS Sintetis',
  'siswa rls sintetis',
  'L',
  'X',
  '20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000002'
);

insert into public.attendance_records (
  id,
  student_id,
  class_id,
  attendance_date,
  period_number,
  status,
  created_by,
  updated_by
)
values (
  '42000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  date '2026-07-23',
  1,
  'IZIN',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000002'
);

insert into public.audit_logs (
  scope, actor_id, actor_name_snapshot, action, entity_type, entity_id
)
values
  ('OPERATIONAL', '40000000-0000-4000-8000-000000000002', 'Admin Sintetis', 'TEST_OPERATIONAL', 'rls_test', 'operational'),
  ('ACCOUNT', '40000000-0000-4000-8000-000000000001', 'Super Admin Sintetis', 'TEST_ACCOUNT', 'rls_test', 'account');

set local role anon;

select throws_like('select * from public.profiles', '%permission denied%', 'anonymous tidak dapat membaca profiles');
select throws_like('select * from public.students', '%permission denied%', 'anonymous tidak dapat membaca students');
select throws_like('select * from public.attendance_records', '%permission denied%', 'anonymous tidak dapat membaca attendance');
select throws_like('select * from public.audit_logs', '%permission denied%', 'anonymous tidak dapat membaca audit');
select throws_like(
  $$insert into public.students (nis, nisn, full_name, normalized_name, gender, current_grade) values ('910003', '9910000003', 'Anon Sintetis', 'anon sintetis', 'L', 'X')$$,
  '%permission denied%',
  'anonymous tidak dapat mutation'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select is((select count(*) from public.students), 1::bigint, 'USER dapat membaca data operasional');
select throws_like(
  $$insert into public.students (nis, nisn, full_name, normalized_name, gender, current_grade) values ('910004', '9910000004', 'User Write Sintetis', 'user write sintetis', 'P', 'X')$$,
  '%permission denied%',
  'USER tidak dapat insert student'
);
select throws_like(
  $$update public.students set full_name = 'Tidak Boleh'$$,
  '%permission denied%',
  'USER tidak dapat update student'
);
select is(
  (select full_name from public.students where id = '41000000-0000-4000-8000-000000000001'),
  'Siswa RLS Sintetis',
  'USER tidak dapat update student'
);
select throws_like('delete from public.students', '%permission denied%', 'USER tidak dapat delete student');
select throws_like(
  $$insert into public.attendance_records (student_id, class_id, attendance_date, period_number, status) values ('41000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', date '2026-07-24', 1, 'SAKIT')$$,
  '%permission denied%',
  'USER tidak dapat membuat attendance'
);
select is((select count(*) from public.audit_logs), 0::bigint, 'USER tidak dapat membaca audit');
select throws_like($$update public.profiles set role = 'ADMIN'$$, '%permission denied%', 'USER tidak dapat mengubah role sendiri');
select throws_like('update public.profiles set is_active = true', '%permission denied%', 'USER tidak dapat mengaktifkan akun');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select is((select count(*) from public.students), 1::bigint, 'ADMIN dapat membaca data operasional');
select throws_like(
  $$insert into public.students (nis, nisn, full_name, normalized_name, gender, current_grade, created_by, updated_by) values ('910002', '9910000002', 'Admin Insert Sintetis', 'admin insert sintetis', 'P', 'X', '40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002')$$,
  '%permission denied%',
  'ADMIN belum dapat direct insert student'
);
select throws_like(
  $$update public.students set full_name = 'Admin Update Sintetis' where id = '41000000-0000-4000-8000-000000000001'$$,
  '%permission denied%',
  'ADMIN belum dapat direct update student'
);
select throws_like($$update public.profiles set role = 'SUPER_ADMIN'$$, '%permission denied%', 'ADMIN tidak dapat mengubah role akun');
select throws_like(
  $$insert into public.audit_logs (scope, actor_name_snapshot, action, entity_type) values ('OPERATIONAL', 'Admin Sintetis', 'FORGED', 'rls_test')$$,
  '%permission denied%',
  'ADMIN tidak dapat insert audit langsung'
);
select is((select count(*) from public.audit_logs where scope = 'ACCOUNT'), 0::bigint, 'ADMIN tidak dapat membaca account audit');
select throws_like('delete from public.students', '%permission denied%', 'ADMIN tidak dapat direct delete student');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select is((select count(*) from public.profiles), 1::bigint, 'SUPER_ADMIN hanya membaca profil sendiri');
select is((select count(*) from public.students), 0::bigint, 'SUPER_ADMIN tidak dapat membaca students');
select is((select count(*) from public.classes), 0::bigint, 'SUPER_ADMIN tidak dapat membaca classes');
select is((select count(*) from public.attendance_records), 0::bigint, 'SUPER_ADMIN tidak dapat membaca attendance');
select is((select count(*) from public.audit_logs where scope = 'OPERATIONAL'), 0::bigint, 'SUPER_ADMIN tidak dapat membaca operational audit');
select throws_like(
  $$insert into public.students (nis, nisn, full_name, normalized_name, gender, current_grade) values ('910005', '9910000005', 'Super Write Sintetis', 'super write sintetis', 'L', 'X')$$,
  '%permission denied%',
  'SUPER_ADMIN tidak dapat mutation operasional'
);

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
set local role authenticated;

select is(private.is_active_account(), false, 'helper menolak akun nonaktif');
select is((select count(*) from public.students), 0::bigint, 'akun nonaktif tidak dapat membaca operasional');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000005', true);
set local role authenticated;

select is(private.requires_password_change(), true, 'helper mendeteksi wajib ganti password');
select is((select count(*) from public.students), 0::bigint, 'wajib ganti password memblokir data operasional');

reset role;
select is(has_schema_privilege('authenticated', 'private', 'create'), false, 'authenticated tidak dapat membuat helper private');
select is(has_function_privilege('anon', 'private.current_profile_role()', 'execute'), false, 'anon tidak dapat menjalankan helper role');

select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set local role authenticated;
select is(private.current_profile_role(), 'USER'::public.app_role, 'helper mengabaikan role JWT yang dapat dimanipulasi');
select is((select count(*) from public.profiles), 1::bigint, 'authenticated hanya membaca profil sendiri');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select ok((select count(*) from public.audit_logs where scope = 'OPERATIONAL') > 0, 'ADMIN dapat membaca operational audit');

reset role;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select ok(
  (select count(*) from public.audit_logs where scope = 'ACCOUNT' and actor_id = '40000000-0000-4000-8000-000000000001') > 0,
  'SUPER_ADMIN dapat membaca account audit miliknya'
);

select * from finish();

rollback;
