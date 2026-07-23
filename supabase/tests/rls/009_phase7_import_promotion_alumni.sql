begin;

select plan(20);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('70000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase7-admin@test.invalid', '', now()),
  ('70000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase7-user@test.invalid', '', now()),
  ('70000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'phase7-super@test.invalid', '', now());

insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('70000000-0000-4000-8000-000000000001', 'phase7.admin', 'phase7-admin@test.invalid', 'Admin Phase 7', 'ADMIN', true, false),
  ('70000000-0000-4000-8000-000000000002', 'phase7.user', 'phase7-user@test.invalid', 'User Phase 7', 'USER', true, false),
  ('70000000-0000-4000-8000-000000000003', 'phase7.super', 'phase7-super@test.invalid', 'Super Phase 7', 'SUPER_ADMIN', true, false);

select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.phase7_import_students(
    '20000000-0000-4000-8000-000000000001', 'synthetic.csv', 2026,
    '[{"nis":"980001","nisn":"9980000001","name":"Nabila Phase Tujuh","gender":"P"}]'::jsonb
  )$$,
  'ADMIN import satu batch sintetis'
);
select is((select count(*) from public.import_batches where status = 'COMPLETED'), 1::bigint, 'import batch selesai');
select is((select count(*) from public.students where nis = '980001'), 1::bigint, 'import membuat siswa');
select is((select count(*) from public.student_enrollments e join public.students s on s.id = e.student_id where s.nis = '980001' and e.is_current), 1::bigint, 'import membuat current enrollment');
select is((select count(*) from public.audit_logs where action = 'STUDENT_IMPORT'), 1::bigint, 'import diaudit');
select throws_like(
  $$select public.phase7_import_students(
    '20000000-0000-4000-8000-000000000001', 'bad.csv', 2026,
    '[{"nis":"980001","nisn":"9980000002","name":"Duplikat","gender":"L"}]'::jsonb
  )$$,
  '%DUPLICATE_NIS%',
  'duplicate database ditolak all-or-none'
);
select is((select count(*) from public.students where nis = '980002'), 0::bigint, 'import gagal tidak menulis baris');
select throws_like(
  $$insert into public.import_batches (class_id, file_name, row_count, created_by)
    values ('20000000-0000-4000-8000-000000000001', 'direct.csv', 0, '70000000-0000-4000-8000-000000000001')$$,
  '%permission denied%',
  'ADMIN direct write batch ditolak'
);

select lives_ok(
  $$select public.phase3_create_academic_year('2027/2028', date '2027-07-01', date '2028-06-30', false)$$,
  'ADMIN membuat tahun tujuan promotion'
);
select lives_ok(
  $$select public.phase7_promote_academic_year((select id from public.academic_years where name = '2027/2028'))$$,
  'promotion mengganti tahun secara atomik'
);
select is((select current_grade from public.students where nis = '980001'), 'XI'::public.grade_level, 'X naik menjadi XI');
select is((select count(*) from public.student_enrollments where student_id = (select id from public.students where nis = '980001') and not is_current), 1::bigint, 'enrollment lama dipertahankan');
select is((select count(*) from public.audit_logs where action = 'STUDENT_PROMOTION_APPLY'), 1::bigint, 'promotion diaudit');
select lives_ok(
  $$select public.phase7_rollback_promotion((select id from public.promotion_batches order by created_at desc limit 1))$$,
  'rollback snapshot berhasil'
);
select is((select current_grade from public.students where nis = '980001'), 'X'::public.grade_level, 'rollback mengembalikan grade tepat');
select is((select status from public.promotion_batches order by created_at desc limit 1), 'REVERTED'::public.batch_status, 'batch ditandai reverted');

reset role;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_like(
  $$select public.phase7_import_students('20000000-0000-4000-8000-000000000001', 'x.csv', 2026, '[]'::jsonb)$$,
  '%PHASE3_FORBIDDEN%',
  'USER tidak dapat import'
);
select throws_like(
  $$select public.phase7_promote_academic_year('10000000-0000-4000-8000-000000000001')$$,
  '%PHASE3_FORBIDDEN%',
  'USER tidak dapat promotion'
);

reset role;
select set_config('request.jwt.claim.sub', '70000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.students), 0::bigint, 'SUPER_ADMIN tidak dapat membaca data operasional');
select throws_like(
  $$select public.phase7_archive_alumni('70000000-0000-4000-8000-000000000001')$$,
  '%PHASE3_FORBIDDEN%',
  'SUPER_ADMIN tidak dapat alumni mutation'
);

select * from finish();
rollback;
