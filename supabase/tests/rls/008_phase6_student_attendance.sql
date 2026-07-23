begin;
select plan(7);
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at) values
('64000000-0000-4000-8000-000000000001','authenticated','authenticated','detail-admin@example.test','',now()),
('64000000-0000-4000-8000-000000000002','authenticated','authenticated','detail-user@example.test','',now()),
('64000000-0000-4000-8000-000000000003','authenticated','authenticated','detail-super@example.test','',now());
insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password) values
('64000000-0000-4000-8000-000000000001','detail.admin','detail-admin@example.test','Admin Detail Sintetis','ADMIN',true,false),
('64000000-0000-4000-8000-000000000002','detail.user','detail-user@example.test','User Detail Sintetis','USER',true,false),
('64000000-0000-4000-8000-000000000003','detail.super','detail-super@example.test','Super Detail Sintetis','SUPER_ADMIN',true,false);
select set_config('request.jwt.claim.sub','64000000-0000-4000-8000-000000000001',true); select set_config('request.jwt.claim.role','authenticated',true); set local role authenticated;
select lives_ok($$select public.phase3_create_student('Detail Sintetis','970001','9970000001','P','X','20000000-0000-4000-8000-000000000001',2026,true)$$,'fixture detail dibuat');
select lives_ok($$select public.phase4_preview_attendance('20000000-0000-4000-8000-000000000001',current_date,jsonb_build_array(jsonb_build_object('student_id',(select id from public.students where nis='970001'),'period_number',1,'mode','upsert','status','SAKIT')))$$,'preview detail dibuat');
select lives_ok($$select public.phase6_get_student_attendance((select id from public.students where nis='970001'),current_date,date_trunc('month',current_date)::date)$$,'ADMIN membaca detail presensi');
select is((public.phase6_get_student_attendance((select id from public.students where nis='970001'),current_date,date_trunc('month',current_date)::date)->'stats'->>'hours_total')::integer,0,'detail mempertahankan semantik tidak ada record sebagai Hadir');
reset role; select set_config('request.jwt.claim.sub','64000000-0000-4000-8000-000000000002',true); set local role authenticated;
select lives_ok($$select public.phase6_get_student_attendance((select id from public.students where nis='970001'),current_date,date_trunc('month',current_date)::date)$$,'USER read-only dapat membaca detail');
select throws_like($$select public.phase6_record_student_export((select id from public.students where nis='970001'),current_date,current_date,0)$$,'%ATTENDANCE_FORBIDDEN%','USER tidak dapat audit export');
reset role; select set_config('request.jwt.claim.sub','64000000-0000-4000-8000-000000000003',true); set local role authenticated;
select throws_like($$select public.phase6_get_student_attendance((select id from public.students where nis='970001'),current_date,date_trunc('month',current_date)::date)$$,'%STUDENT_ATTENDANCE_FORBIDDEN%','SUPER_ADMIN ditolak');
select * from finish(); rollback;
