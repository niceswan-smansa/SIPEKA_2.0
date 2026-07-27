-- Compact no-history direct-write contract.
begin;

select no_plan();

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
  format('select * from public.%I limit 1', relation_name),
  format('ADMIN tetap dapat SELECT %s', relation_name)
)
from (
  values
    ('academic_years'),
    ('classes'),
    ('students'),
    ('student_enrollments'),
    ('attendance_days'),
    ('attendance_records'),
    ('import_batches'),
    ('promotion_batches'),
    ('promotion_batch_items')
) as readable_relations (relation_name);

select throws_like(
  format('insert into public.%I default values', relation_name),
  '%permission denied%',
  format('ADMIN direct INSERT %s ditolak', relation_name)
)
from (
  values
    ('academic_years'),
    ('classes'),
    ('students'),
    ('student_enrollments'),
    ('attendance_days'),
    ('attendance_records'),
    ('import_batches'),
    ('promotion_batches'),
    ('promotion_batch_items')
) as protected_relations (relation_name);

select throws_like(update_sql, '%permission denied%', description)
from (
  values
    ('update public.academic_years set id = id where false', 'ADMIN direct UPDATE academic_years ditolak'),
    ('update public.classes set id = id where false', 'ADMIN direct UPDATE classes ditolak'),
    ('update public.students set id = id where false', 'ADMIN direct UPDATE students ditolak'),
    ('update public.student_enrollments set id = id where false', 'ADMIN direct UPDATE student_enrollments ditolak'),
    ('update public.attendance_days set id = id where false', 'ADMIN direct UPDATE attendance_days ditolak'),
    ('update public.attendance_records set id = id where false', 'ADMIN direct UPDATE attendance_records ditolak'),
    ('update public.import_batches set id = id where false', 'ADMIN direct UPDATE import_batches ditolak'),
    ('update public.promotion_batches set id = id where false', 'ADMIN direct UPDATE promotion_batches ditolak'),
    ('update public.promotion_batch_items set batch_id = batch_id where false', 'ADMIN direct UPDATE promotion_batch_items ditolak')
) as update_attempts (update_sql, description);

select throws_like(
  format('delete from public.%I where false', relation_name),
  '%permission denied%',
  format('ADMIN direct DELETE %s ditolak', relation_name)
)
from (
  values
    ('academic_years'),
    ('classes'),
    ('students'),
    ('student_enrollments'),
    ('attendance_days'),
    ('attendance_records'),
    ('import_batches'),
    ('promotion_batches'),
    ('promotion_batch_items')
) as protected_relations (relation_name);

select * from finish();

rollback;
