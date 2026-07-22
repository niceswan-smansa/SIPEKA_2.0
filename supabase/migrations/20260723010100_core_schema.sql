create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  email text unique,
  full_name text not null,
  role public.app_role not null,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_lowercase check (
    username = lower(btrim(username)) and username <> ''
  ),
  constraint profiles_email_normalized check (
    email is null or (email = lower(btrim(email)) and email <> '')
  ),
  constraint profiles_full_name_not_blank check (btrim(full_name) <> '')
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_valid_dates check (start_date <= end_date),
  constraint academic_years_name_not_blank check (btrim(name) <> '')
);

create unique index academic_years_one_active_idx
  on public.academic_years ((is_active))
  where is_active;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  grade public.grade_level not null,
  class_number smallint not null,
  homeroom_teacher text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_grade_not_alumni check (grade <> 'ALUMNI'),
  constraint classes_number_range check (class_number between 1 and 10),
  constraint classes_academic_year_grade_number_key unique (
    academic_year_id,
    grade,
    class_number
  )
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nisn text not null unique,
  full_name text not null,
  normalized_name text not null,
  gender public.gender not null,
  current_grade public.grade_level not null,
  current_class_id uuid references public.classes (id) on delete restrict,
  year_entered integer,
  graduation_year integer,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_nis_not_blank check (btrim(nis) <> ''),
  constraint students_nisn_not_blank check (btrim(nisn) <> ''),
  constraint students_full_name_not_blank check (btrim(full_name) <> ''),
  constraint students_normalized_name_not_blank check (btrim(normalized_name) <> ''),
  constraint students_alumni_without_current_class check (
    current_grade <> 'ALUMNI' or current_class_id is null
  )
);

create table public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  class_id uuid references public.classes (id) on delete restrict,
  grade public.grade_level not null,
  started_on date not null,
  ended_on date,
  is_current boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint student_enrollments_valid_dates check (
    ended_on is null or ended_on >= started_on
  ),
  constraint student_enrollments_alumni_without_class check (
    grade <> 'ALUMNI' or class_id is null
  )
);

create unique index student_enrollments_one_current_idx
  on public.student_enrollments (student_id)
  where is_current;

create table public.periods (
  number smallint primary key,
  label text not null,
  is_active boolean not null default true,
  constraint periods_number_range check (number between 1 and 10),
  constraint periods_label_not_blank check (btrim(label) <> '')
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  attendance_date date not null,
  period_number smallint not null references public.periods (number) on delete restrict,
  status public.attendance_status not null,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_student_date_period_key unique (
    student_id,
    attendance_date,
    period_number
  ),
  constraint attendance_records_version_positive check (version > 0)
);

create table public.attendance_revisions (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid references public.attendance_records (id) on delete set null,
  student_id uuid not null references public.students (id) on delete restrict,
  operation public.revision_operation not null,
  before_data jsonb,
  after_data jsonb,
  actor_id uuid references public.profiles (id) on delete set null,
  request_id uuid not null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  scope public.audit_scope not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_name_snapshot text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  request_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_name_not_blank check (btrim(actor_name_snapshot) <> ''),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_entity_type_not_blank check (btrim(entity_type) <> '')
);

create table public.attendance_batches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  attendance_date date not null,
  class_id uuid not null references public.classes (id) on delete restrict,
  status public.batch_status not null default 'PREVIEWED',
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  file_name text not null,
  row_count integer not null,
  summary jsonb not null default '{}'::jsonb,
  status public.batch_status not null default 'PREVIEWED',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint import_batches_file_name_not_blank check (btrim(file_name) <> ''),
  constraint import_batches_row_count_nonnegative check (row_count >= 0)
);

create table public.promotion_batches (
  id uuid primary key default gen_random_uuid(),
  from_academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  to_academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  status public.batch_status not null default 'PREVIEWED',
  created_by uuid references public.profiles (id) on delete set null,
  reverted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  constraint promotion_batches_distinct_years check (
    from_academic_year_id <> to_academic_year_id
  ),
  constraint promotion_batches_revert_fields_consistent check (
    (status = 'REVERTED' and reverted_at is not null)
    or (status <> 'REVERTED' and reverted_at is null)
  )
);

create table public.promotion_batch_items (
  batch_id uuid not null references public.promotion_batches (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  before_grade public.grade_level not null,
  before_class_id uuid references public.classes (id) on delete restrict,
  before_enrollment_id uuid references public.student_enrollments (id) on delete restrict,
  after_grade public.grade_level not null,
  after_class_id uuid references public.classes (id) on delete restrict,
  after_enrollment_id uuid references public.student_enrollments (id) on delete restrict,
  primary key (batch_id, student_id),
  constraint promotion_items_before_alumni_without_class check (
    before_grade <> 'ALUMNI' or before_class_id is null
  ),
  constraint promotion_items_after_alumni_without_class check (
    after_grade <> 'ALUMNI' or after_class_id is null
  )
);

create index students_normalized_name_trgm_idx
  on public.students using gin (normalized_name extensions.gin_trgm_ops);
create index students_nis_idx on public.students (nis);
create index students_nisn_idx on public.students (nisn);
create index students_grade_class_active_idx
  on public.students (current_grade, current_class_id, is_active);
create index attendance_records_date_idx on public.attendance_records (attendance_date);
create index attendance_records_class_date_idx
  on public.attendance_records (class_id, attendance_date);
create index attendance_records_student_date_idx
  on public.attendance_records (student_id, attendance_date);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_action_idx on public.audit_logs (action);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index student_enrollments_student_current_idx
  on public.student_enrollments (student_id, is_current);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.validate_student_class_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assigned_grade public.grade_level;
  assigned_active boolean;
begin
  if new.current_grade = 'ALUMNI' then
    if new.current_class_id is not null then
      raise exception using errcode = '23514', message = 'Alumni tidak boleh mempunyai kelas aktif.';
    end if;
    return new;
  end if;

  if new.current_class_id is null then
    return new;
  end if;

  select c.grade, c.is_active
  into assigned_grade, assigned_active
  from public.classes as c
  where c.id = new.current_class_id;

  if not found then
    raise exception using errcode = '23503', message = 'Kelas siswa tidak ditemukan.';
  end if;

  if assigned_grade <> new.current_grade or not assigned_active then
    raise exception using errcode = '23514', message = 'Grade siswa tidak sesuai dengan kelas aktif.';
  end if;

  return new;
end;
$$;

create function private.validate_enrollment_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assigned_grade public.grade_level;
  assigned_year uuid;
  assigned_active boolean;
begin
  if new.grade = 'ALUMNI' then
    if new.class_id is not null then
      raise exception using errcode = '23514', message = 'Enrollment alumni tidak boleh mempunyai kelas.';
    end if;
    return new;
  end if;

  if new.is_current and new.class_id is null then
    raise exception using errcode = '23514', message = 'Enrollment aktif wajib mempunyai kelas.';
  end if;

  if new.class_id is null then
    return new;
  end if;

  select c.grade, c.academic_year_id, c.is_active
  into assigned_grade, assigned_year, assigned_active
  from public.classes as c
  where c.id = new.class_id;

  if not found then
    raise exception using errcode = '23503', message = 'Kelas enrollment tidak ditemukan.';
  end if;

  if assigned_grade <> new.grade or assigned_year <> new.academic_year_id then
    raise exception using errcode = '23514', message = 'Grade atau tahun enrollment tidak sesuai kelas.';
  end if;

  if new.is_current and not assigned_active then
    raise exception using errcode = '23514', message = 'Enrollment aktif memerlukan kelas aktif.';
  end if;

  return new;
end;
$$;

create function private.prevent_referenced_class_breakage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.grade, new.academic_year_id) is distinct from (old.grade, old.academic_year_id)
    and (
      exists (select 1 from public.students as s where s.current_class_id = old.id)
      or exists (
        select 1 from public.student_enrollments as e
        where e.class_id = old.id and e.is_current
      )
    )
  then
    raise exception using errcode = '23514', message = 'Kelas yang masih digunakan tidak dapat dipindahkan.';
  end if;

  if old.is_active and not new.is_active
    and (
      exists (select 1 from public.students as s where s.current_class_id = old.id and s.is_active)
      or exists (
        select 1 from public.student_enrollments as e
        where e.class_id = old.id and e.is_current
      )
    )
  then
    raise exception using errcode = '23514', message = 'Kelas dengan siswa aktif tidak dapat dinonaktifkan.';
  end if;

  return new;
end;
$$;

create function private.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'Audit log bersifat append-only.';
end;
$$;

create function private.audit_operational_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  entity_identifier text;
begin
  if actor is null then
    return coalesce(new, old);
  end if;

  select p.full_name into actor_name
  from public.profiles as p
  where p.id = actor;

  entity_identifier := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

  insert into public.audit_logs (
    scope,
    actor_id,
    actor_name_snapshot,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  )
  values (
    'OPERATIONAL',
    actor,
    coalesce(actor_name, 'Akun tidak dikenal'),
    tg_op,
    tg_table_name,
    entity_identifier,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    jsonb_build_object('source', 'database_trigger')
  );

  return coalesce(new, old);
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger academic_years_set_updated_at
before update on public.academic_years
for each row execute function private.set_updated_at();

create trigger classes_set_updated_at
before update on public.classes
for each row execute function private.set_updated_at();

create trigger students_set_updated_at
before update on public.students
for each row execute function private.set_updated_at();

create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function private.set_updated_at();

create trigger students_validate_class
before insert or update of current_grade, current_class_id on public.students
for each row execute function private.validate_student_class_assignment();

create trigger student_enrollments_validate_class
before insert or update of academic_year_id, class_id, grade, is_current
on public.student_enrollments
for each row execute function private.validate_enrollment_assignment();

create trigger classes_prevent_reference_breakage
before update of academic_year_id, grade, is_active on public.classes
for each row execute function private.prevent_referenced_class_breakage();

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function private.prevent_audit_mutation();

create trigger academic_years_audit_change
after insert or update or delete on public.academic_years
for each row execute function private.audit_operational_change();

create trigger classes_audit_change
after insert or update or delete on public.classes
for each row execute function private.audit_operational_change();

create trigger students_audit_change
after insert or update or delete on public.students
for each row execute function private.audit_operational_change();

create trigger student_enrollments_audit_change
after insert or update or delete on public.student_enrollments
for each row execute function private.audit_operational_change();

revoke all on all functions in schema private from public;
