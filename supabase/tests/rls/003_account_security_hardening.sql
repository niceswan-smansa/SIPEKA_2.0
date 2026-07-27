begin;

select no_plan();

select is(
  has_function_privilege('anon', 'public.admin_create_account_profile(uuid,uuid,text,text,text,public.app_role,boolean,boolean,uuid)', 'execute'),
  false,
  'anon tidak dapat menjalankan RPC account create'
);

select is(
  has_function_privilege('authenticated', 'public.admin_update_account_profile(uuid,uuid,text,text,text,public.app_role,boolean,text,uuid)', 'execute'),
  false,
  'authenticated tidak dapat menjalankan RPC account update'
);

select is(
  has_function_privilege('service_role', 'public.admin_tombstone_account(uuid,uuid,text,uuid)', 'execute'),
  true,
  'service_role dapat menjalankan RPC tombstone server-only'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('50000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'hardening-super@example.test', '', now()),
  ('50000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'hardening-user@example.test', '', now()),
  ('50000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'hardening-other@example.test', '', now());

insert into public.profiles (id, username, email, full_name, role, is_active, must_change_password)
values
  ('50000000-0000-4000-8000-000000000001', 'hardening.super', 'hardening-super@example.test', 'Hardening Super', 'SUPER_ADMIN', true, false),
  ('50000000-0000-4000-8000-000000000003', 'hardening.super2', 'hardening-other@example.test', 'Hardening Super 2', 'SUPER_ADMIN', true, false);

select is((public.admin_create_account_profile(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'Hardening User', 'hardening.user', 'hardening-user@example.test', 'USER', true, true
)->>'username'), 'hardening.user', 'create RPC menormalisasi dan mengembalikan profile');

select is((public.admin_update_account_profile(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'Hardening User Updated', 'hardening.user.updated', 'hardening-user@example.test', 'USER', true, 'UPDATE'
)->>'full_name'), 'Hardening User Updated', 'update RPC mengembalikan profile terbaru');

select is((public.admin_mark_account_password_reset(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002'
)->>'must_change_password')::boolean, true, 'reset RPC mengaktifkan must_change_password');

select is((public.admin_tombstone_account(
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  'deleted_0123456789abcdef0123456789abcdef'
)->>'username'), 'deleted_0123456789abcdef0123456789abcdef', 'tombstone RPC mengembalikan username tombstone');

select is((select is_active from public.profiles where id = '50000000-0000-4000-8000-000000000002'), false, 'tombstone menonaktifkan profile');

select is((select email from public.profiles where id = '50000000-0000-4000-8000-000000000002'), null, 'tombstone mengosongkan email profile');

set local role authenticated;

select throws_like(
  $$select public.admin_update_account_profile('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'x', 'x', '', 'USER', false, 'UPDATE')$$,
  '%permission denied%',
  'caller Data API tidak dapat memanggil RPC account'
);

reset role;

select throws_like(
  $$select public.admin_tombstone_account('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'deleted_0123456789abcdef0123456789abcdef')$$,
  '%Target akun dilindungi%',
  'self target ditolak oleh RPC'
);

select throws_like(
  $$select public.admin_tombstone_account('50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'deleted_0123456789abcdef0123456789abcdef')$$,
  '%Target akun dilindungi%',
  'SUPER_ADMIN target ditolak oleh RPC'
);

select * from finish();

rollback;
