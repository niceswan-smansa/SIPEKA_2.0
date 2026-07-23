begin;
select plan(15);

select ok(
  not has_function_privilege('anon', 'public.consume_auth_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'anonymous cannot consume login buckets'
);
select ok(
  not has_function_privilege('authenticated', 'public.consume_auth_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'authenticated cannot consume login buckets'
);
select ok(
  has_function_privilege('service_role', 'public.consume_auth_rate_limit(text,text,integer,integer)', 'EXECUTE'),
  'service role can consume login buckets'
);

set local role service_role;
select ok(public.consume_auth_rate_limit(repeat('a', 64), 'login-address', 2, 60), 'first attempt allowed');
select ok(public.consume_auth_rate_limit(repeat('a', 64), 'login-address', 2, 60), 'second attempt allowed');
select ok(not public.consume_auth_rate_limit(repeat('a', 64), 'login-address', 2, 60), 'limit is atomic');
reset role;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('72000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'hardening-admin@test.invalid', '', now()),
  ('72000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'hardening-super@test.invalid', '', now());
insert into public.profiles (id, username, full_name, role, is_active, must_change_password)
values
  ('72000000-0000-4000-8000-000000000001', 'hardening.admin', 'Admin Hardening', 'ADMIN', true, false),
  ('72000000-0000-4000-8000-000000000002', 'hardening.super', 'Super Hardening', 'SUPER_ADMIN', true, false);
insert into public.academic_years (id, name, start_date, end_date, is_active)
values ('10000000-0000-4000-8000-000000000099', 'Hardening Target', '2027-07-01', '2028-06-30', false);
insert into public.classes (academic_year_id, grade, class_number, is_active)
select '10000000-0000-4000-8000-000000000099', grade, class_number, true
from unnest(array['X','XI','XII']::public.grade_level[]) grade
cross join generate_series(1, 10) class_number;

insert into public.students (
  nis, nisn, full_name, normalized_name, gender, current_grade, current_class_id,
  year_entered, is_active
)
select
  '88' || lpad(value::text, 5, '0'),
  '88' || lpad(value::text, 8, '0'),
  'Siswa Sintetis ' || value,
  'siswa sintetis ' || value,
  'L', 'X', '20000000-0000-4000-8000-000000000001', 2026, true
from generate_series(1, 1001) value;
insert into public.student_enrollments (
  student_id, academic_year_id, class_id, grade, started_on, is_current
)
select id, '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 'X', date '2026-07-01', true
from public.students where nis like '88%';

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select is(
  (select active_student_count from public.phase10_list_classes(
    '10000000-0000-4000-8000-000000000001', 'X'
  ) where id = '20000000-0000-4000-8000-000000000001'),
  1001::bigint,
  'class aggregation remains exact above one thousand enrollments'
);
select lives_ok(
  $$select public.phase10_get_student_report(
    (select id from public.students where nis = '8800001'),
    date '2026-01-01', date '2027-01-01'
  )$$,
  '366-day report is accepted'
);
select throws_like(
  $$select public.phase10_get_student_report(
    (select id from public.students where nis = '8800001'),
    date '2026-01-01', date '2027-01-02'
  )$$,
  '%REPORT_DATE_RANGE_INVALID%',
  '367-day report is rejected'
);
select lives_ok(
  $$select public.phase10_preview_promotion('10000000-0000-4000-8000-000000000099')$$,
  'promotion preview is callable by active ADMIN'
);
select is((select count(*) from public.promotion_batches), 0::bigint,
  'promotion preview performs no write');

reset role;
insert into public.audit_logs (
  scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, before_data, after_data
) values (
  'OPERATIONAL', '72000000-0000-4000-8000-000000000001', 'Admin Hardening',
  'STUDENT_UPDATE', 'student', gen_random_uuid()::text,
  '{"nis":"secret","full_name":"secret","current_grade":"X"}',
  '{"nisn":"secret","normalized_name":"secret","is_active":true}'
);
select is(
  (select before_data from public.audit_logs where action = 'STUDENT_UPDATE' order by created_at desc limit 1),
  '{"current_grade":"X"}'::jsonb,
  'student audit before snapshot is redacted'
);
select is(
  (select after_data from public.audit_logs where action = 'STUDENT_UPDATE' order by created_at desc limit 1),
  '{"is_active":true}'::jsonb,
  'student audit after snapshot is redacted'
);

select set_config('request.jwt.claim.sub', '72000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_like(
  $$select public.phase10_preview_promotion('10000000-0000-4000-8000-000000000099')$$,
  '%PHASE3_FORBIDDEN%',
  'SUPER_ADMIN cannot preview operational promotion'
);
select is((select count(*) from public.phase10_list_classes(null, null)), 0::bigint,
  'SUPER_ADMIN cannot list operational classes');

select * from finish();
rollback;
