begin;

select plan(27);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('61000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'occupancy-admin@example.test', '', now()),
  ('61000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'occupancy-user@example.test', '', now()),
  ('61000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'occupancy-super@example.test', '', now());

insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('61000000-0000-4000-8000-000000000001', 'occupancy.admin', 'occupancy-admin@example.test', 'Admin Occupancy Sintetis', 'ADMIN', true, false),
  ('61000000-0000-4000-8000-000000000002', 'occupancy.user', 'occupancy-user@example.test', 'User Occupancy Sintetis', 'USER', true, false),
  ('61000000-0000-4000-8000-000000000003', 'occupancy.super', 'occupancy-super@example.test', 'Super Occupancy Sintetis', 'SUPER_ADMIN', true, false);

select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

select lives_ok(
  $$select public.phase3_create_student(
    'Siswa Occupancy Sintetis', 'SYN-OCC-001', 'SYN-N-OCC-001', 'L', 'X',
    '20000000-0000-4000-8000-000000000003', 2026, true
  )$$,
  'ADMIN membuat siswa aktif dengan current enrollment'
);
select is(
  (select count(*) from public.student_enrollments e join public.students s on s.id = e.student_id where e.class_id = '20000000-0000-4000-8000-000000000003' and e.is_current and s.is_active),
  1::bigint,
  'kelas menghitung satu siswa aktif dengan current enrollment'
);
select throws_like(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', false)$$,
  '%CLASS_HAS_ACTIVE_STUDENTS%',
  'kelas dengan siswa aktif tidak dapat dinonaktifkan'
);
select is(
  (select is_active from public.classes where id = '20000000-0000-4000-8000-000000000003'),
  true,
  'kegagalan tidak mengubah status kelas'
);
select is(
  (select count(*) from public.audit_logs where action = 'CLASS_DEACTIVATE' and entity_id = '20000000-0000-4000-8000-000000000003'),
  0::bigint,
  'kegagalan tidak membuat audit sukses'
);

select lives_ok(
  $$select public.phase3_change_student_academic(
    (select id from public.students where nis = 'SYN-OCC-001'), 'X',
    '20000000-0000-4000-8000-000000000003', false
  )$$,
  'ADMIN menonaktifkan siswa tanpa menghapus enrollment'
);
select is((select is_active from public.students where nis = 'SYN-OCC-001'), false, 'siswa menjadi nonaktif');
select is(
  (select count(*) from public.student_enrollments e join public.students s on s.id = e.student_id where e.class_id = '20000000-0000-4000-8000-000000000003' and e.is_current and s.is_active),
  0::bigint,
  'siswa nonaktif tidak dihitung sebagai siswa aktif kelas'
);
select is(
  (select count(*) from public.student_enrollments e join public.students s on s.id = e.student_id where s.nis = 'SYN-OCC-001'),
  1::bigint,
  'enrollment history siswa nonaktif tetap ada'
);
select is(
  (select is_current from public.student_enrollments e join public.students s on s.id = e.student_id where s.nis = 'SYN-OCC-001'),
  true,
  'current enrollment siswa nonaktif dipertahankan'
);
select lives_ok(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', false)$$,
  'kelas yang hanya berisi siswa nonaktif dapat dinonaktifkan'
);
select is(
  (select is_active from public.classes where id = '20000000-0000-4000-8000-000000000003'),
  false,
  'status kelas menjadi nonaktif'
);
select is(
  (select count(*) from public.audit_logs where action = 'CLASS_DEACTIVATE' and entity_id = '20000000-0000-4000-8000-000000000003'),
  1::bigint,
  'penonaktifan kelas ditulis ke audit'
);
select is(
  (select count(*) from public.audit_logs where action = 'STUDENT_DEACTIVATE' and entity_id = (select id::text from public.students where nis = 'SYN-OCC-001')),
  1::bigint,
  'penonaktifan siswa ditulis ke audit'
);
select throws_like(
  $$select public.phase3_change_student_academic(
    (select id from public.students where nis = 'SYN-OCC-001'), 'X',
    '20000000-0000-4000-8000-000000000003', true
  )$$,
  '%CLASS_INACTIVE_OR_NOT_FOUND%',
  'siswa tidak dapat diaktifkan kembali ke kelas nonaktif'
);
select is((select is_active from public.students where nis = 'SYN-OCC-001'), false, 'aktivasi gagal mempertahankan siswa nonaktif');
select is(
  (select count(*) from public.student_enrollments e join public.students s on s.id = e.student_id where s.nis = 'SYN-OCC-001'),
  1::bigint,
  'aktivasi gagal tidak menghapus enrollment history'
);
select is(
  (select count(*) from public.audit_logs where action = 'STUDENT_ACTIVATE' and entity_id = (select id::text from public.students where nis = 'SYN-OCC-001')),
  0::bigint,
  'aktivasi gagal tidak membuat audit sukses'
);

reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_like(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', true)$$,
  '%PHASE3_FORBIDDEN%',
  'USER tidak dapat menjalankan mutation kelas'
);

reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select throws_like(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', true)$$,
  '%PHASE3_FORBIDDEN%',
  'SUPER_ADMIN tidak dapat menjalankan mutation kelas'
);

reset role;
set local role anon;
select throws_like(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', true)$$,
  '%permission denied%',
  'anonymous tidak dapat menjalankan mutation kelas'
);

reset role;
select set_config('request.jwt.claim.sub', '61000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select throws_like(
  $$update public.classes set is_active = true where id = '20000000-0000-4000-8000-000000000003'$$,
  '%permission denied%',
  'ADMIN direct UPDATE classes tetap ditolak'
);
select throws_like(
  $$delete from public.student_enrollments where student_id = (select id from public.students where nis = 'SYN-OCC-001')$$,
  '%permission denied%',
  'ADMIN direct DELETE enrollment history tetap ditolak'
);
select lives_ok(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', true)$$,
  'ADMIN mengaktifkan kelas untuk uji atomicity'
);

reset role;
create function public.test_occupancy_fail_audit()
returns trigger language plpgsql as $$ begin raise exception 'OCCUPANCY_AUDIT_FAILURE'; end; $$;
create trigger test_occupancy_fail_audit before insert on public.audit_logs
for each row when (new.scope = 'OPERATIONAL' and new.action = 'CLASS_DEACTIVATE')
execute function public.test_occupancy_fail_audit();
set local role authenticated;
select throws_like(
  $$select public.phase3_update_class('20000000-0000-4000-8000-000000000003', '', '', false)$$,
  '%OCCUPANCY_AUDIT_FAILURE%',
  'audit failure menggagalkan penonaktifan kelas'
);
select is(
  (select is_active from public.classes where id = '20000000-0000-4000-8000-000000000003'),
  true,
  'status kelas rollback ketika audit gagal'
);
select is(
  (select count(*) from public.audit_logs where action = 'CLASS_DEACTIVATE' and entity_id = '20000000-0000-4000-8000-000000000003'),
  1::bigint,
  'audit gagal tidak menambah event penonaktifan'
);
reset role;
drop trigger test_occupancy_fail_audit on public.audit_logs;
drop function public.test_occupancy_fail_audit();

select * from finish();
rollback;
