begin;
select plan(7);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at) values
('72000000-0000-4000-8000-000000000001','authenticated','authenticated','clear-admin@example.test','',now()),
('72000000-0000-4000-8000-000000000002','authenticated','authenticated','clear-super@example.test','',now());

insert into public.profiles (
  id, username, email, full_name, role, is_active, must_change_password
) values
('72000000-0000-4000-8000-000000000001','clear.admin','clear-admin@example.test','Admin Clear Sintetis','ADMIN',true,false),
('72000000-0000-4000-8000-000000000002','clear.super','clear-super@example.test','Super Clear Sintetis','SUPER_ADMIN',true,false);

insert into public.audit_logs (
  scope, actor_id, actor_name_snapshot, action, entity_type, entity_id, request_id
) values
('OPERATIONAL','72000000-0000-4000-8000-000000000001','Admin Clear Sintetis','CLEAR_FIXTURE_A','student','fixture-a','72000000-0000-4000-8000-000000000011'),
('OPERATIONAL','72000000-0000-4000-8000-000000000001','Admin Clear Sintetis','CLEAR_FIXTURE_B','class','fixture-b','72000000-0000-4000-8000-000000000012'),
('ACCOUNT','72000000-0000-4000-8000-000000000002','Super Clear Sintetis','ACCOUNT_FIXTURE','profile','fixture-account','72000000-0000-4000-8000-000000000013');

set local role service_role;

select throws_like(
  $$select public.phase12_clear_operational_audit(
    '72000000-0000-4000-8000-000000000002',
    'SALAH',
    '72000000-0000-4000-8000-000000000021'
  )$$,
  '%AUDIT_CLEAR_CONFIRMATION_INVALID%',
  'SUPER_ADMIN wajib memberi konfirmasi exact'
);

select throws_like(
  $$select public.phase12_clear_operational_audit(
    '72000000-0000-4000-8000-000000000001',
    'HAPUS SEMUA RIWAYAT OPERASIONAL',
    '72000000-0000-4000-8000-000000000022'
  )$$,
  '%SUPER_ADMIN_REQUIRED%',
  'ADMIN tidak dapat membersihkan audit'
);

select is(
  public.phase12_clear_operational_audit(
    '72000000-0000-4000-8000-000000000002',
    'HAPUS SEMUA RIWAYAT OPERASIONAL',
    '72000000-0000-4000-8000-000000000023'
  ),
  2,
  'SUPER_ADMIN menghapus seluruh audit operasional'
);

reset role;

select is(
  (select count(*)::integer from public.audit_logs where scope = 'OPERATIONAL'),
  0,
  'audit operasional kosong'
);

select is(
  (select count(*)::integer from public.audit_logs where scope = 'ACCOUNT'),
  2,
  'audit akun lama dan catatan pembersihan dipertahankan'
);

select is(
  (
    select (metadata->>'deleted_count')::integer
    from public.audit_logs
    where scope = 'ACCOUNT' and action = 'OPERATIONAL_AUDIT_CLEAR'
  ),
  2,
  'jumlah audit yang dihapus tercatat pada audit akun'
);

set local role authenticated;
select throws_like(
  $$select public.phase12_clear_operational_audit(
    '72000000-0000-4000-8000-000000000002',
    'HAPUS SEMUA RIWAYAT OPERASIONAL',
    '72000000-0000-4000-8000-000000000024'
  )$$,
  '%permission denied%',
  'authenticated tidak dapat memanggil RPC langsung'
);
reset role;

select * from finish();
rollback;
