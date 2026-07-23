create table public.auth_rate_limit_buckets (
  key_hash text not null,
  scope text not null,
  window_started_at timestamptz not null,
  attempt_count integer not null check (attempt_count > 0),
  expires_at timestamptz not null,
  primary key (scope, key_hash)
);

alter table public.auth_rate_limit_buckets enable row level security;
revoke all on public.auth_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.auth_rate_limit_buckets to service_role;

create index auth_rate_limit_buckets_expiry_idx
  on public.auth_rate_limit_buckets (expires_at);

create function public.consume_auth_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if length(p_key_hash) <> 64
    or p_scope not in ('login-address', 'login-account')
    or p_limit < 1 or p_limit > 1000
    or p_window_seconds < 1 or p_window_seconds > 3600
  then
    raise exception using errcode = '22023', message = 'RATE_LIMIT_INPUT_INVALID';
  end if;

  delete from public.auth_rate_limit_buckets
  where expires_at < clock_timestamp()
  and ctid in (
    select ctid from public.auth_rate_limit_buckets
    where expires_at < clock_timestamp()
    limit 100
  );

  insert into public.auth_rate_limit_buckets (
    key_hash, scope, window_started_at, attempt_count, expires_at
  ) values (
    p_key_hash, p_scope, clock_timestamp(), 1,
    clock_timestamp() + make_interval(secs => p_window_seconds)
  )
  on conflict (scope, key_hash) do update
  set attempt_count = case
        when public.auth_rate_limit_buckets.expires_at <= clock_timestamp() then 1
        else public.auth_rate_limit_buckets.attempt_count + 1
      end,
      window_started_at = case
        when public.auth_rate_limit_buckets.expires_at <= clock_timestamp()
          then clock_timestamp()
        else public.auth_rate_limit_buckets.window_started_at
      end,
      expires_at = case
        when public.auth_rate_limit_buckets.expires_at <= clock_timestamp()
          then clock_timestamp() + make_interval(secs => p_window_seconds)
        else public.auth_rate_limit_buckets.expires_at
      end
  returning attempt_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_auth_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, text, integer, integer)
  to service_role;
