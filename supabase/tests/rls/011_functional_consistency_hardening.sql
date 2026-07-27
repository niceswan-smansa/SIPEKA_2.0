begin;

select no_plan();

select is(
  (select count(*) from public.periods where number between 1 and 10),
  10::bigint,
  'migration menjamin sepuluh period'
);

select is(
  (select count(*) from public.periods where number between 1 and 10 and is_active),
  10::bigint,
  'semua period operasional aktif'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.students'::regclass
      and conname = 'students_year_entered_range'
  ),
  'constraint tahun masuk tersedia'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.attendance_days'::regclass
      and conname = 'attendance_days_note_length'
  ),
  'constraint panjang catatan tersedia'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '6f000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'functional-hardening-admin@example.test',
  '',
  now()
);

insert into public.profiles (
  id, username, email, full_name, role, is_active, must_change_password
) values (
  '6f000000-0000-4000-8000-000000000001',
  'functional.hardening.admin',
  'functional-hardening-admin@example.test',
  'Admin Functional Hardening',
  'ADMIN',
  true,
  false
);

select set_config(
  'request.jwt.claim.sub',
  '6f000000-0000-4000-8000-000000000001',
  true
);

select set_config('request.jwt.claim.role', 'authenticated', true);

set local role authenticated;

select throws_like(
  $$select public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000001',
    current_date,
    '[]'::jsonb
  )$$,
  '%ATTENDANCE_NO_CHANGES%',
  'preview kosong ditolak'
);

select throws_like(
  $$select public.phase3_create_academic_year(
    'Tahun Overlap Sintetis',
    date '2026-08-01',
    date '2027-05-31',
    false
  )$$,
  '%ACADEMIC_YEAR_OVERLAP%',
  'tahun ajaran overlap ditolak'
);

select lives_ok(
  $$select public.phase3_create_student(
    'Siswa Histori Functional',
    '969001',
    '9969000001',
    'L',
    'X',
    '20000000-0000-4000-8000-000000000001',
    2026,
    true
  )$$,
  'fixture siswa histori dibuat'
);

reset role;

update public.student_enrollments
set is_current = false,
    ended_on = current_date
where student_id = (select id from public.students where nis = '969001')
  and is_current;

insert into public.student_enrollments (
  student_id, academic_year_id, class_id, grade,
  started_on, is_current, created_by
)
select
  s.id,
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  'X',
  current_date,
  true,
  '6f000000-0000-4000-8000-000000000001'
from public.students s
where s.nis = '969001';

update public.students
set current_class_id = '20000000-0000-4000-8000-000000000002'
where nis = '969001';

set local role authenticated;

select is(
  public.phase11_get_student_class_on_date(
    (select id from public.students where nis = '969001'),
    current_date
  ),
  '20000000-0000-4000-8000-000000000002'::uuid,
  'kelas terbaru menang untuk perpindahan pada hari yang sama'
);

select is(
  (
    public.phase4_get_class_attendance(
      '20000000-0000-4000-8000-000000000001',
      current_date
    )->'items'
  ) @> jsonb_build_array(jsonb_build_object(
    'id', (select id from public.students where nis = '969001')
  )),
  false,
  'roster kelas lama tidak memuat siswa yang sudah pindah'
);

reset role;

update public.periods set is_active = false where number = 10;

set local role authenticated;

select throws_like(
  $$select public.phase4_preview_attendance(
    '20000000-0000-4000-8000-000000000002',
    current_date,
    jsonb_build_array(jsonb_build_object(
      'student_id', (select id from public.students where nis = '969001'),
      'period_number', 1,
      'mode', 'upsert',
      'status', 'IZIN'
    ))
  )$$,
  '%ATTENDANCE_PERIOD_CONFIGURATION_INVALID%',
  'konfigurasi period tidak lengkap ditolak sebelum insert'
);

select * from finish();

rollback;
