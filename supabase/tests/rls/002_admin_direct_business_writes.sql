begin;

select plan(43);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '50000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'hardening.admin@sipeka.test',
  '',
  now()
);

insert into public.profiles (id, username, email, full_name, role)
values (
  '50000000-0000-4000-8000-000000000001',
  'hardening.admin',
  'hardening.admin@sipeka.test',
  'Admin Hardening Sintetis',
  'ADMIN'
);

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  format('select * from public.%I limit 1', table_name),
  format('ADMIN tetap dapat SELECT %s', table_name)
)
from (
  values
    ('academic_years'),
    ('classes'),
    ('students'),
    ('student_enrollments'),
    ('attendance_records'),
    ('attendance_revisions'),
    ('import_batches'),
    ('attendance_batches'),
    ('promotion_batches'),
    ('promotion_batch_items')
) as protected_tables (table_name);

select throws_like(
  format('insert into public.%I default values', table_name),
  '%permission denied%',
  format('ADMIN direct INSERT %s ditolak', table_name)
)
from (
  values
    ('academic_years'),
    ('classes'),
    ('students'),
    ('student_enrollments'),
    ('attendance_records'),
    ('attendance_revisions'),
    ('import_batches'),
    ('attendance_batches'),
    ('promotion_batches'),
    ('promotion_batch_items')
) as protected_tables (table_name);

select throws_like(update_sql, '%permission denied%', description)
from (
  values
    ('update public.academic_years set id = id where false', 'ADMIN direct UPDATE academic_years ditolak'),
    ('update public.classes set id = id where false', 'ADMIN direct UPDATE classes ditolak'),
    ('update public.students set id = id where false', 'ADMIN direct UPDATE students ditolak'),
    ('update public.student_enrollments set id = id where false', 'ADMIN direct UPDATE student_enrollments ditolak'),
    ('update public.attendance_records set id = id where false', 'ADMIN direct UPDATE attendance_records ditolak'),
    ('update public.attendance_revisions set id = id where false', 'ADMIN direct UPDATE attendance_revisions ditolak'),
    ('update public.import_batches set id = id where false', 'ADMIN direct UPDATE import_batches ditolak'),
    ('update public.attendance_batches set id = id where false', 'ADMIN direct UPDATE attendance_batches ditolak'),
    ('update public.promotion_batches set id = id where false', 'ADMIN direct UPDATE promotion_batches ditolak'),
    ('update public.promotion_batch_items set batch_id = batch_id where false', 'ADMIN direct UPDATE promotion_batch_items ditolak')
) as update_attempts (update_sql, description);

select throws_like(
  format('delete from public.%I where false', table_name),
  '%permission denied%',
  format('ADMIN direct DELETE %s ditolak', table_name)
)
from (
  values
    ('academic_years'),
    ('classes'),
    ('students'),
    ('student_enrollments'),
    ('attendance_records'),
    ('attendance_revisions'),
    ('import_batches'),
    ('attendance_batches'),
    ('promotion_batches'),
    ('promotion_batch_items')
) as protected_tables (table_name);

select throws_like(
  'insert into public.audit_logs default values',
  '%permission denied%',
  'ADMIN direct INSERT audit_logs ditolak'
);
select throws_like(
  'update public.audit_logs set id = id where false',
  '%permission denied%',
  'ADMIN direct UPDATE audit_logs ditolak'
);
select throws_like(
  'delete from public.audit_logs where false',
  '%permission denied%',
  'ADMIN direct DELETE audit_logs ditolak'
);

select * from finish();

rollback;
