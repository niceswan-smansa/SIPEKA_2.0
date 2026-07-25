begin;

select plan(12);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at) values
('73000000-0000-4000-8000-000000000001','authenticated','authenticated','grade-export-admin@example.test','',now()),
('73000000-0000-4000-8000-000000000002','authenticated','authenticated','grade-export-user@example.test','',now()),
('73000000-0000-4000-8000-000000000003','authenticated','authenticated','grade-export-super@example.test','',now());

insert into public.profiles (
  id,
  username,
  email,
  full_name,
  role,
  is_active,
  must_change_password
) values
('73000000-0000-4000-8000-000000000001','grade.export.admin','grade-export-admin@example.test','Admin Export Grade','ADMIN',true,false),
('73000000-0000-4000-8000-000000000002','grade.export.user','grade-export-user@example.test','User Export Grade','USER',true,false),
('73000000-0000-4000-8000-000000000003','grade.export.super','grade-export-super@example.test','Super Export Grade','SUPER_ADMIN',true,false);

select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

select lives_ok(
  $$select public.phase3_create_student(
    'Export Grade Sintetis',
    '973001',
    '9973000001',
    'P',
    'X',
    '20000000-0000-4000-8000-000000000001',
    2026,
    true
  )$$,
  'fixture siswa export grade dibuat'
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
select
  s.id,
  '20000000-0000-4000-8000-000000000001',
  date '2026-07-02',
  1,
  'SAKIT',
  '73000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001'
from public.students s
where s.nis = '973001';

select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
set local role authenticated;

select lives_ok(
  $$select public.phase12_get_grade_attendance_export(
    'X',
    date '2026-07-01',
    least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
  )$$,
  'ADMIN dapat membaca export grade'
);

select is(
  public.phase12_get_grade_attendance_export(
    'X',
    date '2026-07-01',
    least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
  )->'academic_year'->>'name',
  '2026/2027',
  'export memakai tahun ajaran aktif'
);

select is(
  jsonb_array_length(
    public.phase12_get_grade_attendance_export(
      'X',
      date '2026-07-01',
      least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
    )->'classes'
  ),
  10,
  'semua slot kelas aktif pada grade dikembalikan'
);

select is(
  (
    select coalesce(sum(jsonb_array_length(class_item->'students')), 0)::integer
    from jsonb_array_elements(
      public.phase12_get_grade_attendance_export(
        'X',
        date '2026-07-01',
        least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
      )->'classes'
    ) class_item
  ),
  1,
  'roster siswa grade dikembalikan'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(
      public.phase12_get_grade_attendance_export(
        'X',
        date '2026-07-01',
        least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
      )->'classes'
    ) class_item
    cross join lateral jsonb_array_elements(class_item->'students') student_item
    cross join lateral jsonb_array_elements(student_item->'attendance') attendance_item
  ),
  1,
  'status harian unik dikembalikan'
);

select lives_ok(
  $$select public.phase12_record_grade_attendance_export(
    'X',
    date '2026-07-01',
    least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date),
    10,
    1,
    1
  )$$,
  'ADMIN dapat mencatat audit export grade'
);

select ok(
  exists (
    select 1
    from public.audit_logs
    where action = 'GRADE_ATTENDANCE_EXPORT'
      and entity_id = 'X'
      and metadata->>'student_count' = '1'
  ),
  'audit export grade tersimpan'
);

select throws_like(
  $$select public.phase12_get_grade_attendance_export(
    'X',
    date '2026-06-01',
    date '2026-06-30'
  )$$,
  '%GRADE_ATTENDANCE_EXPORT_RANGE_OUTSIDE_ACTIVE_YEAR%',
  'rentang di luar tahun ajaran aktif ditolak'
);

reset role;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
set local role authenticated;

select throws_like(
  $$select public.phase12_get_grade_attendance_export(
    'X',
    date '2026-07-01',
    least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
  )$$,
  '%GRADE_ATTENDANCE_EXPORT_FORBIDDEN%',
  'USER tidak dapat membaca export grade'
);

select throws_like(
  $$select public.phase12_record_grade_attendance_export(
    'X',
    date '2026-07-01',
    least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date),
    10,
    1,
    1
  )$$,
  '%ATTENDANCE_FORBIDDEN%',
  'USER tidak dapat mencatat audit export grade'
);

reset role;
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000003',true);
set local role authenticated;

select throws_like(
  $$select public.phase12_get_grade_attendance_export(
    'X',
    date '2026-07-01',
    least(date '2026-07-31', (now() at time zone 'Asia/Jakarta')::date)
  )$$,
  '%GRADE_ATTENDANCE_EXPORT_FORBIDDEN%',
  'SUPER_ADMIN tetap terisolasi dari export operasional'
);

select * from finish();
rollback;
