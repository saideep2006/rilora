create table if not exists public.career_interest_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  role_title text not null check (char_length(role_title) between 2 and 100),
  resume_path text not null,
  status text not null default 'new' check (status in ('new','reviewed','contacted','closed')),
  created_at timestamptz not null default now()
);
create index if not exists career_interest_created_idx
  on public.career_interest_submissions(created_at desc);

alter table public.career_interest_submissions enable row level security;
revoke all on public.career_interest_submissions from anon, authenticated;
grant select, update on public.career_interest_submissions to authenticated;
grant all on public.career_interest_submissions to service_role;

drop policy if exists "Admins manage career interests" on public.career_interest_submissions;
create policy "Admins manage career interests"
  on public.career_interest_submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.career_interest_rate_limits (
  email_hash text primary key check (email_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0)
);
create index if not exists career_interest_rate_window_idx
  on public.career_interest_rate_limits(window_started_at);
alter table public.career_interest_rate_limits enable row level security;
revoke all on public.career_interest_rate_limits from public, anon, authenticated;
grant all on public.career_interest_rate_limits to service_role;

create or replace function public.check_career_interest_rate_limit(p_email_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare allowed boolean;
begin
  if p_email_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate limit key';
  end if;
  delete from public.career_interest_rate_limits
    where window_started_at < now() - interval '48 hours';
  insert into public.career_interest_rate_limits(email_hash, window_started_at, request_count)
  values (p_email_hash, now(), 1)
  on conflict (email_hash) do update set
    request_count = case
      when public.career_interest_rate_limits.window_started_at < now() - interval '24 hours' then 1
      else public.career_interest_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.career_interest_rate_limits.window_started_at < now() - interval '24 hours' then now()
      else public.career_interest_rate_limits.window_started_at
    end
  returning request_count <= 3 into allowed;
  return allowed;
end;
$$;
revoke all on function public.check_career_interest_rate_limit(text) from public, anon, authenticated;
grant execute on function public.check_career_interest_rate_limit(text) to service_role;
