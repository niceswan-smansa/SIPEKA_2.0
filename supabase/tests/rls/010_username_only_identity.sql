begin;

select plan(8);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '91000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'fixture-identity@invalid.local',
  '',
  now()
);

insert into public.profiles (id, username, email, full_name, role)
values (
  '91000000-0000-4000-8000-000000000001',
  'identity.fixture',
  'should-not-persist@example.test',
  'Identity Fixture',
  'ADMIN'
);

select is(
  (select email from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  null::text,
  'profile email selalu NULL'
);

update public.profiles
set email = 'another@example.test'
where id = '91000000-0000-4000-8000-000000000001';

select is(
  (select email from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  null::text,
  'profile email tetap NULL setelah update'
);

select is(
  (select email from auth.users where id = '91000000-0000-4000-8000-000000000001'),
  'fixture-identity@invalid.local',
  'synthetic Auth identity terpisah dari profile'
);

select is(
  (select username from public.profiles where id = '91000000-0000-4000-8000-000000000001'),
  'identity.fixture',
  'username menjadi identity aplikasi'
);

select is(
  has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  false,
  'authenticated tidak dapat insert profile langsung'
);

select is(
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  false,
  'authenticated tidak dapat update profile langsung'
);

select is(
  has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  false,
  'authenticated tidak dapat delete profile langsung'
);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  '91000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'fixture-identity-2@invalid.local',
  '',
  now()
);

select throws_like(
  $$
    insert into public.profiles (id, username, full_name, role)
    values (
      '91000000-0000-4000-8000-000000000002',
      'identity.fixture',
      'Duplicate Username Fixture',
      'USER'
    )
  $$,
  '%duplicate key value violates unique constraint%',
  'duplicate username ditolak'
);

select * from finish();
rollback;
