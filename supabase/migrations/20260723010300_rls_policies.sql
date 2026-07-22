alter table public.profiles enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.student_enrollments enable row level security;
alter table public.periods enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_revisions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.attendance_batches enable row level security;
alter table public.import_batches enable row level security;
alter table public.promotion_batches enable row level security;
alter table public.promotion_batch_items enable row level security;

revoke all on all tables in schema public from anon, authenticated;

-- The bypass-RLS service role is restricted to server-only modules, but still
-- needs explicit table privileges because new public tables are not auto-granted.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;

grant select on public.profiles to authenticated;
grant select, insert, update on public.academic_years to authenticated;
grant select, insert, update on public.classes to authenticated;
grant select, insert, update on public.students to authenticated;
grant select, insert, update on public.student_enrollments to authenticated;
grant select on public.periods to authenticated;
grant select on public.attendance_records to authenticated;
grant select on public.attendance_revisions to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.attendance_batches to authenticated;
grant select on public.import_batches to authenticated;
grant select on public.promotion_batches to authenticated;
grant select on public.promotion_batch_items to authenticated;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = private.current_user_id());

create policy academic_years_select_operational
on public.academic_years
for select
to authenticated
using (private.can_access_operational());

create policy academic_years_insert_admin
on public.academic_years
for insert
to authenticated
with check (private.is_admin());

create policy academic_years_update_admin
on public.academic_years
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy classes_select_operational
on public.classes
for select
to authenticated
using (private.can_access_operational());

create policy classes_insert_admin
on public.classes
for insert
to authenticated
with check (private.is_admin());

create policy classes_update_admin
on public.classes
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy students_select_operational
on public.students
for select
to authenticated
using (private.can_access_operational());

create policy students_insert_admin
on public.students
for insert
to authenticated
with check (private.is_admin());

create policy students_update_admin
on public.students
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy student_enrollments_select_operational
on public.student_enrollments
for select
to authenticated
using (private.can_access_operational());

create policy student_enrollments_insert_admin
on public.student_enrollments
for insert
to authenticated
with check (private.is_admin());

create policy student_enrollments_update_admin
on public.student_enrollments
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

create policy periods_select_operational
on public.periods
for select
to authenticated
using (private.can_access_operational());

create policy attendance_records_select_operational
on public.attendance_records
for select
to authenticated
using (private.can_access_operational());

create policy attendance_revisions_select_operational
on public.attendance_revisions
for select
to authenticated
using (private.can_access_operational());

create policy attendance_batches_select_admin
on public.attendance_batches
for select
to authenticated
using (private.is_admin());

create policy import_batches_select_admin
on public.import_batches
for select
to authenticated
using (private.is_admin());

create policy promotion_batches_select_admin
on public.promotion_batches
for select
to authenticated
using (private.is_admin());

create policy promotion_batch_items_select_admin
on public.promotion_batch_items
for select
to authenticated
using (private.is_admin());

create policy audit_logs_select_operational_admin
on public.audit_logs
for select
to authenticated
using (scope = 'OPERATIONAL' and private.is_admin());

create policy audit_logs_select_account_super_admin
on public.audit_logs
for select
to authenticated
using (scope = 'ACCOUNT' and private.can_access_account_portal());
