begin;

select plan(53);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('60000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'phase3-admin@example.test', '', now()),
  ('60000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'phase3-user@example.test', '', now()),
  ('60000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'phase3-super@example.test', '', now()),
  ('60000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'phase3-inactive@example.test', '', now()),
  ('60000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'phase3-change@example.test', '', now());

insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('60000000-0000-4000-8000-000000000001', 'phase3.admin', 'phase3-admin@example.test', 'Admin Phase 3', 'ADMIN', true, false),
  ('60000000-0000-4000-8000-000000000002', 'phase3.user', 'phase3-user@example.test', 'User Phase 3', 'USER', true, false),
  ('60000000-0000-4000-8000-000000000003', 'phase3.super', 'phase3-super@example.test', 'Super Phase 3', 'SUPER_ADMIN', true, false),
  ('60000000-0000-4000-8000-000000000004', 'phase3.inactive', 'phase3-inactive@example.test', 'Admin Nonaktif Phase 3', 'ADMIN', false, false),
  ('60000000-0000-4000-8000-000000000005', 'phase3.change', 'phase3-change@example.test', 'Admin Ganti Password Phase 3', 'ADMIN', true, true);

select throws_like(
  $$insert into public.academic_years (name, start_date, end_date) values ('Invalid', date '2027-01-01', date '2027-01-01')$$,
  '%academic_years_valid_dates%',
  'tanggal tahun ajaran wajib start < end'
);

select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.phase3_create_academic_year('2027/2028', date '2027-07-01', date '2028-06-30', false)$$,
  'ADMIN membuat tahun ajaran'
);
select is(
  (select count(*) from public.classes where academic_year_id = (select id from public.academic_years where name = '2027/2028')),
  30::bigint,
  'tahun ajaran membuat tepat 30 slot'
);
select is(
  (select count(*) from public.audit_logs where action = 'ACADEMIC_YEAR_CREATE' and entity_id = (select id::text from public.academic_years where name = '2027/2028')),
  1::bigint,
  'create tahun ajaran diaudit'
);
select is((select count(*) from public.academic_years where is_active), 1::bigint, 'create inactive mempertahankan satu active year');

select lives_ok(
  $$select public.phase3_activate_academic_year((select id from public.academic_years where name = '2027/2028'))$$,
  'ADMIN mengaktifkan tahun kosong'
);
select is((select count(*) from public.academic_years where is_active), 1::bigint, 'activation menjaga satu active year');
select is((select is_active from public.academic_years where name = '2026/2027'), false, 'tahun lama dinonaktifkan atomik');
select is((select count(*) from public.audit_logs where action = 'ACADEMIC_YEAR_ACTIVATE'), 1::bigint, 'activation diaudit');
select throws_like(
  $$select public.phase3_create_academic_year('2027/2028', date '2027-07-01', date '2028-06-30', false)$$,
  '%ACADEMIC_YEAR_DUPLICATE%',
  'duplicate academic year ditolak'
);
select lives_ok(
  $$select public.phase3_update_class(
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 10),
    'Wali Sintetis', 'Kelas kosong', false
  )$$,
  'kelas kosong dapat dinonaktifkan'
);
select throws_like(
  $$select public.phase3_create_student(
    'Kelas Nonaktif', 'SYN-P3-OFF', 'SYN-N-P3-OFF', 'L', 'X',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 10), 2027, true
  )$$,
  '%CLASS_INACTIVE_OR_NOT_FOUND%',
  'siswa tidak dapat dibuat pada kelas nonaktif'
);
select lives_ok(
  $$select public.phase3_update_class(
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 10),
    'Wali Sintetis', 'Aktif kembali', true
  )$$,
  'kelas kosong dapat diaktifkan kembali'
);

select lives_ok(
  $$select public.phase3_create_student(
    'Nabila Sintetis', 'SYN-P3-001', 'SYN-N-P3-001', 'P', 'X',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 1),
    2027, true
  )$$,
  'ADMIN membuat siswa dan enrollment atomik'
);
select is((select count(*) from public.student_enrollments where is_current), 1::bigint, 'current enrollment dibuat bersama siswa');
select is((select count(*) from public.audit_logs where action = 'STUDENT_CREATE'), 1::bigint, 'create siswa diaudit');
select throws_like(
  $$select public.phase3_create_student(
    'Duplikat NIS', 'SYN-P3-001', 'SYN-N-P3-002', 'L', 'X',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 1), 2027, true
  )$$,
  '%DUPLICATE_NIS%',
  'duplicate NIS mempunyai error stabil'
);
select throws_like(
  $$select public.phase3_create_student(
    'Duplikat NISN', 'SYN-P3-002', 'SYN-N-P3-001', 'L', 'X',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 1), 2027, true
  )$$,
  '%DUPLICATE_NISN%',
  'duplicate NISN mempunyai error stabil'
);
select throws_like(
  $$select public.phase3_create_student(
    'Mismatch', 'SYN-P3-003', 'SYN-N-P3-003', 'L', 'XI',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 1), 2027, true
  )$$,
  '%GRADE_CLASS_MISMATCH%',
  'grade dan kelas mismatch ditolak'
);
select lives_ok(
  $$select public.phase3_create_academic_year('2028/2029', date '2028-07-01', date '2029-06-30', false)$$,
  'ADMIN membuat calon tahun ajaran berikutnya'
);
select throws_like(
  $$select public.phase3_activate_academic_year((select id from public.academic_years where name = '2028/2029'))$$,
  '%ACADEMIC_YEAR_SWITCH_REQUIRES_PROMOTION%',
  'switch tahun ditolak saat tahun aktif masih memiliki siswa aktif/current'
);

select lives_ok(
  $$select public.phase3_update_student_identity(
    (select id from public.students where nis = 'SYN-P3-001'),
    'Nabila Putri Sintetis', 'SYN-P3-001', 'SYN-N-P3-001', 'P', 2027
  )$$,
  'ADMIN memperbarui identitas siswa'
);
select is((select normalized_name from public.students where nis = 'SYN-P3-001'), 'nabila putri sintetis', 'normalized name diperbarui');
select is((select count(*) from public.audit_logs where action = 'STUDENT_UPDATE'), 1::bigint, 'identity update diaudit');

select lives_ok(
  $$select public.phase3_change_student_academic(
    (select id from public.students where nis = 'SYN-P3-001'), 'X',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'X' and c.class_number = 2), true
  )$$,
  'ADMIN memindahkan kelas siswa'
);
select is((select count(*) from public.student_enrollments where ended_on is not null and not is_current), 1::bigint, 'enrollment lama ditutup');
select is((select count(*) from public.student_enrollments where is_current), 1::bigint, 'hanya satu current enrollment setelah pindah');
select is((select count(*) from public.audit_logs where action = 'STUDENT_MOVE_CLASS'), 1::bigint, 'perpindahan kelas diaudit');

select lives_ok(
  $$select public.phase3_change_student_academic(
    (select id from public.students where nis = 'SYN-P3-001'), 'X',
    (select current_class_id from public.students where nis = 'SYN-P3-001'), false
  )$$,
  'ADMIN menonaktifkan siswa'
);
select is((select is_active from public.students where nis = 'SYN-P3-001'), false, 'status siswa menjadi nonaktif');
select lives_ok(
  $$select public.phase3_update_class(
    (select current_class_id from public.students where nis = 'SYN-P3-001'), '', '', false
  )$$,
  'kelas dengan current enrollment siswa nonaktif dapat dinonaktifkan'
);
select lives_ok(
  $$select public.phase3_update_class(
    (select current_class_id from public.students where nis = 'SYN-P3-001'), '', '', true
  )$$,
  'kelas diaktifkan kembali sebelum siswa diaktifkan'
);
select lives_ok(
  $$select public.phase3_change_student_academic(
    (select id from public.students where nis = 'SYN-P3-001'), 'X',
    (select current_class_id from public.students where nis = 'SYN-P3-001'), true
  )$$,
  'ADMIN mengaktifkan kembali siswa'
);
select lives_ok(
  $$select public.phase3_change_student_academic(
    (select id from public.students where nis = 'SYN-P3-001'), 'XI',
    (select c.id from public.classes c join public.academic_years y on y.id = c.academic_year_id where y.name = '2027/2028' and c.grade = 'XI' and c.class_number = 1), true
  )$$,
  'ADMIN melakukan koreksi grade individual ke kelas yang sesuai'
);
select is((select current_grade from public.students where nis = 'SYN-P3-001'), 'XI'::public.grade_level, 'grade siswa diperbarui');
select is((select count(*) from public.audit_logs where action = 'STUDENT_CHANGE_GRADE'), 1::bigint, 'perubahan grade individual diaudit');

select is(
  (public.phase3_search_students('nabil', null, null, true, null, 1, 20)->>'total')::integer,
  1,
  'partial search nabil menemukan Nabila'
);

reset role;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select is((public.phase3_search_students('nabil')->>'total')::integer, 1, 'USER dapat mencari siswa');
select throws_like(
  $$select public.phase3_update_student_identity((select id from public.students limit 1), 'x', 'x', 'x', 'L', 2027)$$,
  '%PHASE3_FORBIDDEN%',
  'USER tidak dapat mutation RPC'
);
select set_config('request.jwt.claim.app_role', 'ADMIN', true);
select throws_like(
  $$select public.phase3_create_academic_year('Forged', date '2030-01-01', date '2030-12-31', false)$$,
  '%PHASE3_FORBIDDEN%',
  'claim role palsu tidak meningkatkan privilege USER'
);

reset role;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.students), 0::bigint, 'SUPER_ADMIN tidak dapat membaca siswa');
select throws_like(
  $$select public.phase3_create_academic_year('Blocked', date '2030-01-01', date '2030-12-31', false)$$,
  '%PHASE3_FORBIDDEN%',
  'SUPER_ADMIN tidak dapat mutation RPC'
);

reset role;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select throws_like(
  $$select public.phase3_create_academic_year('Blocked Inactive', date '2030-01-01', date '2030-12-31', false)$$,
  '%PHASE3_FORBIDDEN%',
  'ADMIN nonaktif ditolak'
);

reset role;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000005', true);
set local role authenticated;
select throws_like(
  $$select public.phase3_create_academic_year('Blocked Password', date '2030-01-01', date '2030-12-31', false)$$,
  '%PHASE3_FORBIDDEN%',
  'ADMIN must-change-password ditolak'
);

reset role;
set local role anon;
select throws_like(
  $$select public.phase3_create_academic_year('Blocked Anonymous', date '2030-01-01', date '2030-12-31', false)$$,
  '%permission denied%',
  'anonymous tidak dapat menjalankan RPC'
);
select throws_like(
  $$select public.phase3_search_students('nabil')$$,
  '%permission denied%',
  'anonymous tidak dapat menjalankan RPC pencarian'
);

reset role;
select set_config('request.jwt.claim.sub', '60000000-0000-4000-8000-000000000001', true);
create function public.test_phase3_fail_audit()
returns trigger language plpgsql as $$ begin raise exception 'PHASE3_AUDIT_FAILURE'; end; $$;
create trigger test_phase3_fail_audit before insert on public.audit_logs
for each row when (new.scope = 'OPERATIONAL') execute function public.test_phase3_fail_audit();
set local role authenticated;
select throws_like(
  $$select public.phase3_update_student_identity(
    (select id from public.students where nis = 'SYN-P3-001'),
    'Should Roll Back', 'SYN-P3-001', 'SYN-N-P3-001', 'P', 2027
  )$$,
  '%PHASE3_AUDIT_FAILURE%',
  'audit failure menggagalkan mutation'
);
select is((select full_name from public.students where nis = 'SYN-P3-001'), 'Nabila Putri Sintetis', 'student rollback saat audit gagal');
reset role;
drop trigger test_phase3_fail_audit on public.audit_logs;
drop function public.test_phase3_fail_audit();

select has_index('public', 'students', 'students_normalized_name_trgm_idx', 'normalized name mempunyai trigram index');
select has_index('public', 'students', 'students_nis_trgm_idx', 'NIS mempunyai trigram index');
select has_index('public', 'students', 'students_nisn_trgm_idx', 'NISN mempunyai trigram index');
select throws_like(
  $$select public.phase3_search_students(null, null, null, null, null, 0, 20)$$,
  '%PAGINATION_INVALID%',
  'RPC menolak page di bawah batas'
);

set local enable_seqscan = off;
create function pg_temp.phase3_name_search_plan()
returns text
language plpgsql
as $fn$
declare
  plan_line text;
  output text := '';
begin
  for plan_line in execute
    $$explain (costs off) select id from public.students where normalized_name ilike '%nabil%'$$
  loop
    output := output || E'\n' || plan_line;
  end loop;
  return output;
end;
$fn$;
select matches(
  pg_temp.phase3_name_search_plan(),
  'students_normalized_name_trgm_idx',
  'query plan partial name dapat memakai trigram index'
);

select * from finish();
rollback;
