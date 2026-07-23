begin;

select plan(9);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '30000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'constraint.admin@sipeka.test',
  '',
  now()
);

insert into public.profiles (id, username, email, full_name, role)
values (
  '30000000-0000-4000-8000-000000000001',
  'constraint.admin',
  'constraint.admin@sipeka.test',
  'Admin Constraint Sintetis',
  'ADMIN'
);

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
  '31000000-0000-4000-8000-000000000001',
  '900001',
  '9900000001',
  'Siswa Constraint Sintetis',
  'siswa constraint sintetis',
  'L',
  'X',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001'
);

select throws_like(
  $$
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id, created_by, updated_by
    ) values (
      '900001', '9900000002', 'Duplikat Sintetis', 'duplikat sintetis', 'P', 'X',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    )
  $$,
  '%duplicate key value violates unique constraint%students_nis_unique_not_null_idx%',
  'NIS harus unik'
);

select throws_like(
  $$
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id, created_by, updated_by
    ) values (
      '900002', '9900000001', 'Duplikat Sintetis', 'duplikat sintetis', 'P', 'X',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    )
  $$,
  '%duplicate key value violates unique constraint%students_nisn_unique_not_null_idx%',
  'NISN harus unik'
);

select throws_like(
  $$
    insert into public.academic_years (name, start_date, end_date, is_active)
    values ('2027/2028', date '2027-07-01', date '2028-06-30', true)
  $$,
  '%duplicate key value violates unique constraint%academic_years_one_active_idx%',
  'hanya satu tahun ajaran aktif'
);

select throws_like(
  $$
    insert into public.classes (academic_year_id, grade, class_number)
    values ('10000000-0000-4000-8000-000000000001', 'X', 11)
  $$,
  '%violates check constraint%classes_number_range%',
  'nomor kelas dibatasi 1 sampai 10'
);

select throws_like(
  $$
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id,
      created_by, updated_by
    ) values (
      '900003', '9900000003', 'Mismatch Sintetis', 'mismatch sintetis', 'L', 'XI',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    )
  $$,
  '%Grade siswa tidak sesuai dengan kelas aktif%',
  'grade siswa harus sesuai kelas aktif'
);

select throws_like(
  $$
    insert into public.students (
      nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id,
      created_by, updated_by
    ) values (
      '900004', '9900000004', 'Alumni Sintetis', 'alumni sintetis', 'P', 'ALUMNI',
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    )
  $$,
  '%Alumni tidak boleh mempunyai kelas aktif%',
  'alumni tidak boleh mempunyai kelas aktif'
);

insert into public.student_enrollments (
  student_id,
  academic_year_id,
  class_id,
  grade,
  started_on,
  is_current,
  created_by
)
values (
  '31000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'X',
  date '2026-07-01',
  true,
  '30000000-0000-4000-8000-000000000001'
);

select throws_like(
  $$
    insert into public.student_enrollments (
      student_id, academic_year_id, class_id, grade, started_on, is_current, created_by
    ) values (
      '31000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002',
      'X', date '2026-07-02', true,
      '30000000-0000-4000-8000-000000000001'
    )
  $$,
  '%duplicate key value violates unique constraint%student_enrollments_one_current_idx%',
  'hanya satu enrollment aktif per siswa'
);

insert into public.attendance_records (
  student_id,
  class_id,
  attendance_date,
  period_number,
  status,
  created_by,
  updated_by
)
values (
  '31000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  date '2026-07-23',
  1,
  'SAKIT',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001'
);

select throws_like(
  $$
    insert into public.attendance_records (
      student_id, class_id, attendance_date, period_number, status, created_by, updated_by
    ) values (
      '31000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      date '2026-07-23', 1, 'IZIN',
      '30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001'
    )
  $$,
  '%duplicate key value violates unique constraint%attendance_records_student_date_period_key%',
  'presensi unik per siswa tanggal dan jam'
);

insert into public.audit_logs (
  id,
  scope,
  actor_name_snapshot,
  action,
  entity_type
)
values (
  '32000000-0000-4000-8000-000000000001',
  'OPERATIONAL',
  'Admin Constraint Sintetis',
  'TEST',
  'constraint_test'
);

select throws_like(
  $$
    update public.audit_logs
    set action = 'TAMPERED'
    where id = '32000000-0000-4000-8000-000000000001'
  $$,
  '%Audit log bersifat append-only%',
  'audit log tidak dapat diubah'
);

select * from finish();

rollback;
