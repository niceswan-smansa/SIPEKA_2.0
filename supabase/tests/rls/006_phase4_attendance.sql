begin;

select plan(24);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('62000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'attendance-admin@example.test', '', now()),
  ('62000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'attendance-user@example.test', '', now());

insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('62000000-0000-4000-8000-000000000001', 'attendance.admin', 'attendance-admin@example.test', 'Admin Attendance Sintetis', 'ADMIN', true, false),
  ('62000000-0000-4000-8000-000000000002', 'attendance.user', 'attendance-user@example.test', 'User Attendance Sintetis', 'USER', true, false);

select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.phase3_create_student(
    'Siswa Attendance Sintetis', 'SYN-ATT-001', 'SYN-N-ATT-001', 'L', 'X',
    '20000000-0000-4000-8000-000000000001', 2026, true
  )$$,
  'ADMIN menyiapkan siswa attendance sintetis'
);

select lives_ok(
  $$select public.phase4_get_class_attendance(
    '20000000-0000-4000-8000-000000000001', current_date
  )$$,
  'ADMIN dapat membaca roster attendance melalui read model'
);

select lives_ok(
  $$select public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001', current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', 1, 'mode', 'upsert', 'status', 'IZIN', 'note', 'Sintetis'
    ))
  )$$,
  'preview attendance menghasilkan token'
);

select is(
  (public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001', current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', 1, 'mode', 'upsert', 'status', 'IZIN'
    ))
  )->'summary'->>'new')::integer,
  1,
  'preview mengklasifikasikan record baru'
);

create temp table phase4_apply_fixture(token text, payload jsonb);
insert into phase4_apply_fixture(token, payload)
select
  public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001', current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', 1, 'mode', 'upsert', 'status', 'IZIN'
    ))
  )->>'token',
  jsonb_build_array(jsonb_build_object(
    'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
    'period_number', 1, 'mode', 'upsert', 'status', 'IZIN'
  ));
select lives_ok(
  (select format(
    'select public.phase4_apply_attendance(%L, %L::uuid, current_date, %L::jsonb)',
    token, '20000000-0000-4000-8000-000000000001', payload::text
  ) from phase4_apply_fixture),
  'apply menyimpan attendance secara atomik'
);
select is((select count(*) from public.attendance_records where student_id = (select id from public.students where nis = 'SYN-ATT-001')), 1::bigint, 'satu record attendance tersimpan');
select is((select count(*) from public.attendance_revisions where student_id = (select id from public.students where nis = 'SYN-ATT-001')), 1::bigint, 'revision CREATE tersimpan');
select is((select count(*) from public.attendance_batches), 1::bigint, 'batch attendance tersimpan');
select is((select count(*) from public.audit_logs where action = 'ATTENDANCE_BATCH_APPLY'), 1::bigint, 'audit batch tersimpan');
select throws_like(
  (select format(
    'select public.phase4_apply_attendance(%L, %L::uuid, current_date, %L::jsonb)',
    token, '20000000-0000-4000-8000-000000000001', payload::text
  ) from phase4_apply_fixture),
  '%ATTENDANCE_TOKEN_USED%',
  'token selesai tidak dapat menghasilkan mutation ganda'
);

reset role;
create function public.test_phase4_fail_audit()
returns trigger language plpgsql as $$ begin raise exception 'PHASE4_AUDIT_FAILURE'; end; $$;
create trigger test_phase4_fail_audit before insert on public.audit_logs
for each row when (new.action = 'ATTENDANCE_BATCH_APPLY')
execute function public.test_phase4_fail_audit();
set local role authenticated;
create temp table phase4_audit_fixture(token text, payload jsonb);
insert into phase4_audit_fixture(token, payload)
select
  public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001', current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', 3, 'mode', 'upsert', 'status', 'SAKIT'
    ))
  )->>'token',
  jsonb_build_array(jsonb_build_object(
    'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
    'period_number', 3, 'mode', 'upsert', 'status', 'SAKIT'
  ));
select throws_like(
  (select format(
    'select public.phase4_apply_attendance(%L, %L::uuid, current_date, %L::jsonb)',
    token, '20000000-0000-4000-8000-000000000001', payload::text
  ) from phase4_audit_fixture),
  '%PHASE4_AUDIT_FAILURE%',
  'audit failure menggagalkan seluruh attendance batch'
);
select is((select count(*) from public.attendance_records where period_number = 3), 0::bigint, 'record rollback saat audit gagal');
select is((select count(*) from public.attendance_batches), 1::bigint, 'batch rollback saat audit gagal');
reset role;
drop trigger test_phase4_fail_audit on public.audit_logs;
drop function public.test_phase4_fail_audit();
set local role authenticated;

select throws_like(
  $$select public.phase4_preview_attendance('20000000-0000-4000-8000-000000000001', current_date + 1, '[]'::jsonb)$$,
  '%FUTURE_DATE_NOT_ALLOWED%',
  'tanggal masa depan ditolak'
);

select lives_ok(
  $$select public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001', current_date,
    (select jsonb_agg(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', period_number, 'mode', 'upsert', 'status', 'SAKIT'
    )) from generate_series(1, 10) period_number)
  )$$,
  'preview Semua Jam menerima sepuluh operasi period'
);

select throws_like(
  $$insert into public.attendance_records (student_id, class_id, attendance_date, period_number, status, created_by, updated_by)
    values ((select id from public.students where nis = 'SYN-ATT-001'), '20000000-0000-4000-8000-000000000001', current_date, 2, 'SAKIT', '62000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001')$$,
  '%permission denied%',
  'ADMIN direct INSERT attendance tetap ditolak'
);
select throws_like(
  $$update public.attendance_records set status = 'SAKIT' where student_id = (select id from public.students where nis = 'SYN-ATT-001')$$,
  '%permission denied%',
  'ADMIN direct UPDATE attendance tetap ditolak'
);
select throws_like(
  $$delete from public.attendance_records where student_id = (select id from public.students where nis = 'SYN-ATT-001')$$,
  '%permission denied%',
  'ADMIN direct DELETE attendance tetap ditolak'
);

reset role;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_like(
  $$select public.phase4_preview_attendance('20000000-0000-4000-8000-000000000001', current_date, '[]'::jsonb)$$,
  '%ATTENDANCE_FORBIDDEN%',
  'USER tidak dapat preview attendance'
);
select throws_like(
  $$select public.phase4_apply_attendance('invalid', '20000000-0000-4000-8000-000000000001', current_date, '[]'::jsonb)$$,
  '%ATTENDANCE_FORBIDDEN%',
  'USER tidak dapat apply attendance'
);

reset role;
set local role anon;
select throws_like(
  $$select public.phase4_preview_attendance('20000000-0000-4000-8000-000000000001', current_date, '[]'::jsonb)$$,
  '%permission denied%',
  'anonymous tidak dapat preview attendance'
);

reset role;
select set_config('request.jwt.claim.sub', '62000000-0000-4000-8000-000000000001', true);
set local role authenticated;
create temp table phase4_preview_fixture(token text);
select lives_ok(
  $$select public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001', current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', 2, 'mode', 'upsert', 'status', 'SAKIT'
    ))
  )$$,
  'preview kedua tersedia untuk uji stale'
);
insert into phase4_preview_fixture(token)
select public.phase4_preview_attendance(
  '20000000-0000-4000-8000-000000000001', current_date,
  jsonb_build_array(jsonb_build_object(
    'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
    'period_number', 2, 'mode', 'upsert', 'status', 'SAKIT'
  ))
)->>'token';
reset role;
insert into public.attendance_records (student_id, class_id, attendance_date, period_number, status, created_by, updated_by)
values ((select id from public.students where nis = 'SYN-ATT-001'), '20000000-0000-4000-8000-000000000001', current_date, 2, 'IZIN', '62000000-0000-4000-8000-000000000001', '62000000-0000-4000-8000-000000000001');
select is((select count(*) from public.attendance_records where period_number = 2), 1::bigint, 'fixture stale tersimpan oleh database owner');
select throws_like(
  $$select public.phase4_apply_attendance(
    (select token from phase4_preview_fixture),
    '20000000-0000-4000-8000-000000000001', current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = 'SYN-ATT-001'),
      'period_number', 2, 'mode', 'upsert', 'status', 'SAKIT'
    ))
  )$$,
  '%STALE_PREVIEW%',
  'apply menolak preview stale'
);

select * from finish();
rollback;
