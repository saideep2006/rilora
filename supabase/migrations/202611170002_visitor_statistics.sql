create table if not exists public.site_visits (
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  visit_date date not null,
  created_at timestamptz not null default now(),
  primary key (visitor_hash, visit_date)
);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant all on public.site_visits to service_role;

create or replace function public.record_site_visit(p_visitor_hash text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_visitor_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid visitor token';
  end if;
  insert into public.site_visits (visitor_hash, visit_date)
  values (p_visitor_hash, timezone('Asia/Kolkata', now())::date)
  on conflict (visitor_hash, visit_date) do nothing;
end;
$$;

create or replace function public.get_site_visit_stats()
returns table(total_visitors bigint, today_visitors bigint)
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct visitor_hash),
         count(*) filter (where visit_date = timezone('Asia/Kolkata', now())::date)
  from public.site_visits;
$$;

revoke all on function public.record_site_visit(text) from public, anon, authenticated;
revoke all on function public.get_site_visit_stats() from public, anon, authenticated;
grant execute on function public.record_site_visit(text) to service_role;
grant execute on function public.get_site_visit_stats() to service_role;
