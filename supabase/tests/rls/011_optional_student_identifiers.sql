begin;

select plan(21);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '92000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'optional-identifiers@invalid.local',
  '',
  now()
);
insert into public.profiles (id, username, full_name, role, is_active, must_change_password)
values (
  '92000000-0000-4000-8000-000000000001',
  'optional.identifiers',
  'Admin Optional Identifiers',
  'ADMIN',
  true,
  false
);

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.phase3_create_student(
    'Tanpa NIS', null, '9200000001', 'L', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  'create siswa tanpa NIS'
);
select lives_ok(
  $$select public.phase3_create_student(
    'Tanpa NISN', '920002', null, 'P', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  'create siswa tanpa NISN'
);
select lives_ok(
  $$select public.phase3_create_student(
    'Tanpa Keduanya', null, null, 'L', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  'create siswa tanpa kedua identifier'
);
select lives_ok(
  $$select public.phase3_create_student(
    'Tanpa Keduanya Dua', null, null, 'P', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  'beberapa siswa boleh memiliki identifier NULL'
);
select is((select count(*) from public.students where nis is null), 3::bigint, 'tiga NIS NULL tersimpan');
select is((select count(*) from public.students where nisn is null), 3::bigint, 'tiga NISN NULL tersimpan');
select is((select count(*) from public.student_enrollments where is_current), 4::bigint, 'seluruh enrollment dibuat');

select throws_like(
  $$select public.phase3_create_student(
    'Duplikat NIS', '920002', '9200000002', 'L', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  '%DUPLICATE_NIS%',
  'duplicate NIS non-null ditolak'
);
select throws_like(
  $$select public.phase3_create_student(
    'Duplikat NISN', '920003', '9200000001', 'L', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  '%DUPLICATE_NISN%',
  'duplicate NISN non-null ditolak'
);
select throws_like(
  $$select public.phase3_create_student(
    'NISN Malformed', '920004', '123456789', 'L', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  '%NISN_FORMAT_INVALID%',
  'NISN malformed non-null ditolak RPC'
);

select lives_ok(
  $$select public.phase3_update_student_identity(
    (select id from public.students where full_name = 'Tanpa NIS'),
    'Tanpa NIS', '920005', '9200000001', 'L', 2026
  )$$,
  'edit NULL menjadi identifier valid'
);
select is(
  (select nis from public.students where full_name = 'Tanpa NIS'),
  '920005',
  'identifier valid tersimpan'
);
select lives_ok(
  $$select public.phase3_update_student_identity(
    (select id from public.students where full_name = 'Tanpa NIS'),
    'Tanpa NIS', null, null, 'L', 2026
  )$$,
  'edit identifier menjadi NULL'
);
select is(
  (public.phase3_search_students('tanpa nis', null, null, null, null, 1, 20)->>'total')::integer,
  2,
  'search nama menemukan siswa tanpa identifier'
);
select is(
  (select count(*) from public.audit_logs where action = 'STUDENT_CREATE'),
  4::bigint,
  'create siswa tanpa identifier tetap diaudit'
);
select is(
  (select count(*) from public.audit_logs where action = 'STUDENT_UPDATE'),
  2::bigint,
  'edit identifier tetap diaudit'
);
select lives_ok(
  $$select public.phase7_import_students(
    '20000000-0000-4000-8000-000000000001',
    'optional.csv',
    2026,
    '[{"nis":"","nisn":"","name":"Import Null Satu","gender":"L"},{"nis":"","nisn":"","name":"Import Null Dua","gender":"P"}]'::jsonb
  )$$,
  'import CSV menerima beberapa identifier kosong'
);
select is(
  (select count(*) from public.students where full_name like 'Import Null%'),
  2::bigint,
  'import membuat seluruh siswa tanpa placeholder'
);
select throws_like(
  $$select public.phase7_import_students(
    '20000000-0000-4000-8000-000000000001',
    'malformed.csv',
    2026,
    '[{"nis":"920099","nisn":"123","name":"Import Invalid","gender":"L"}]'::jsonb
  )$$,
  '%IMPORT_ROW_INVALID%',
  'import CSV menolak NISN malformed'
);

reset role;
select has_index(
  'public',
  'students',
  'students_nis_unique_not_null_idx',
  'partial unique index NIS tersedia'
);
select has_index(
  'public',
  'students',
  'students_nisn_unique_not_null_idx',
  'partial unique index NISN tersedia'
);

select * from finish();
rollback;
