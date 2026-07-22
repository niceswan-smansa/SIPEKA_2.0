begin;

select plan(1);
select pass('Supabase local database accepts pgTAP tests');
select * from finish();

rollback;
