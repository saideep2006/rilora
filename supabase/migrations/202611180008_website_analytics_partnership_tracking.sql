-- Add page-view analytics and private partnership enquiries without replacing existing tables.
create table if not exists public.website_visits (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  visitor_hash text not null check (visitor_hash ~ '^[a-f0-9]{64}$'),
  session_hash text not null check (session_hash ~ '^[a-f0-9]{64}$'),
  page_path text not null check (page_path ~ '^/[^?#]{0,199}$' and page_path not like '//%'),
  visited_at timestamptz not null default now()
);
create index if not exists website_visits_time_idx on public.website_visits(visited_at desc);
create index if not exists website_visits_visitor_time_idx on public.website_visits(visitor_hash, visited_at desc);
create index if not exists website_visits_session_time_idx on public.website_visits(session_hash, visited_at desc);
create index if not exists website_visits_page_time_idx on public.website_visits(page_path, visited_at desc);
alter table public.website_visits enable row level security;
revoke all on public.website_visits from public, anon, authenticated;
grant all on public.website_visits to service_role;

create or replace function public.record_website_page_view(
  p_event_id uuid, p_visitor_hash text, p_session_hash text, p_page_path text
) returns text language plpgsql security definer set search_path=public as $$
declare page_count integer;
begin
  if p_event_id is null or p_visitor_hash !~ '^[a-f0-9]{64}$' or p_session_hash !~ '^[a-f0-9]{64}$'
    or p_page_path !~ '^/[^?#]{0,199}$' or p_page_path like '//%' then
    raise exception 'Invalid page view';
  end if;
  if exists(select 1 from public.website_visits where event_id=p_event_id) then return 'duplicate'; end if;
  select count(*) into page_count from public.website_visits
    where visitor_hash=p_visitor_hash
      and visited_at >= (timezone('Asia/Kolkata',now())::date::timestamp at time zone 'Asia/Kolkata');
  if page_count >= 200 then return 'limited'; end if;
  insert into public.website_visits(event_id,visitor_hash,session_hash,page_path)
    values(p_event_id,p_visitor_hash,p_session_hash,p_page_path)
    on conflict(event_id) do nothing;
  if not found then return 'duplicate'; end if;
  insert into public.site_visits(visitor_hash,visit_date)
    values(p_visitor_hash,timezone('Asia/Kolkata',now())::date)
    on conflict(visitor_hash,visit_date) do nothing;
  return 'recorded';
end;
$$;
revoke all on function public.record_website_page_view(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.record_website_page_view(uuid,text,text,text) to service_role;

create or replace function public.get_public_site_visit_stats()
returns jsonb language sql stable security definer set search_path=public as $$
  with bounds as (
    select (timezone('Asia/Kolkata',now())::date::timestamp at time zone 'Asia/Kolkata') as today_start
  )
  select jsonb_build_object(
    'total_visits',(select count(distinct session_hash) from public.website_visits),
    'unique_visitors',(select count(distinct visitor_hash) from public.website_visits),
    'total_page_views',(select count(*) from public.website_visits),
    'today_visitors',(select count(distinct v.visitor_hash) from public.website_visits v,bounds b where v.visited_at>=b.today_start)
  );
$$;
revoke all on function public.get_public_site_visit_stats() from public, anon, authenticated;
grant execute on function public.get_public_site_visit_stats() to service_role;

create or replace function public.get_site_analytics(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare
  today_value date := timezone('Asia/Kolkata',now())::date;
  from_value date := coalesce(p_from,today_value-29);
  to_value date := coalesce(p_to,today_value);
  from_at timestamptz;
  until_at timestamptz;
  today_until timestamptz;
begin
  if from_value>to_value or to_value-from_value>365 then raise exception 'Choose a valid date range up to 366 days.'; end if;
  from_at := from_value::timestamp at time zone 'Asia/Kolkata';
  until_at := (to_value+1)::timestamp at time zone 'Asia/Kolkata';
  today_until := (today_value+1)::timestamp at time zone 'Asia/Kolkata';
  return (
    with view_data as (select * from public.website_visits),
    period as (select * from view_data where visited_at>=from_at and visited_at<until_at),
    dates as (select generate_series(from_value::timestamp,to_value::timestamp,interval '1 day')::date as day),
    daily as (
      select d.day,count(p.id)::bigint as page_views,count(distinct p.session_hash)::bigint as visits,
        count(distinct p.visitor_hash)::bigint as unique_visitors
      from dates d left join period p on (p.visited_at at time zone 'Asia/Kolkata')::date=d.day group by d.day order by d.day
    ),
    popular as (
      select page_path,count(*)::bigint as page_views from period group by page_path order by count(*) desc,page_path limit 10
    ),
    recent as (
      select page_path,visited_at from period order by visited_at desc limit 30
    ),
    summary as (
      select
        (select count(distinct session_hash) from view_data)::bigint as total_visits,
        (select count(distinct visitor_hash) from view_data)::bigint as unique_visitors,
        (select count(*) from view_data)::bigint as total_page_views,
        (select count(distinct session_hash) from view_data where visited_at>=from_at and visited_at<until_at)::bigint as range_visits,
        (select count(distinct visitor_hash) from view_data where visited_at>=from_at and visited_at<until_at)::bigint as range_unique_visitors,
        (select count(*) from view_data where visited_at>=from_at and visited_at<until_at)::bigint as range_page_views,
        (select count(distinct visitor_hash) from view_data where (visited_at at time zone 'Asia/Kolkata')::date=today_value)::bigint as today_visitors,
        (select count(distinct session_hash) from view_data where (visited_at at time zone 'Asia/Kolkata')::date=today_value)::bigint as today_visits,
        (select count(distinct visitor_hash) from view_data where (visited_at at time zone 'Asia/Kolkata')::date=today_value-1)::bigint as yesterday_visitors,
        (select count(distinct session_hash) from view_data where (visited_at at time zone 'Asia/Kolkata')::date=today_value-1)::bigint as yesterday_visits,
        (select count(distinct session_hash) from view_data where visited_at>=((today_value-6)::timestamp at time zone 'Asia/Kolkata') and visited_at<today_until)::bigint as last_7_days_visits,
        (select count(distinct visitor_hash) from view_data where visited_at>=((today_value-6)::timestamp at time zone 'Asia/Kolkata') and visited_at<today_until)::bigint as last_7_days_visitors,
        (select count(distinct session_hash) from view_data where visited_at>=((today_value-29)::timestamp at time zone 'Asia/Kolkata') and visited_at<today_until)::bigint as last_30_days_visits,
        (select count(distinct visitor_hash) from view_data where visited_at>=((today_value-29)::timestamp at time zone 'Asia/Kolkata') and visited_at<today_until)::bigint as last_30_days_visitors,
        (select count(distinct visitor_hash) from view_data where date_trunc('month',visited_at at time zone 'Asia/Kolkata')=date_trunc('month',now() at time zone 'Asia/Kolkata'))::bigint as monthly_visitors
    )
    select jsonb_build_object(
      'totalVisits',s.total_visits,'uniqueVisitors',s.unique_visitors,'totalPageViews',s.total_page_views,
      'rangeVisits',s.range_visits,'rangeUniqueVisitors',s.range_unique_visitors,'rangePageViews',s.range_page_views,
      'todayVisitors',s.today_visitors,'todayVisits',s.today_visits,'yesterdayVisitors',s.yesterday_visitors,'yesterdayVisits',s.yesterday_visits,
      'last7DaysVisits',s.last_7_days_visits,'last7DaysVisitors',s.last_7_days_visitors,
      'last30DaysVisits',s.last_30_days_visits,'last30DaysVisitors',s.last_30_days_visitors,'monthlyVisitors',s.monthly_visitors,
      'daily',coalesce((select jsonb_agg(jsonb_build_object('date',day,'pageViews',page_views,'visits',visits,'uniqueVisitors',unique_visitors) order by day) from daily),'[]'::jsonb),
      'popularPages',coalesce((select jsonb_agg(jsonb_build_object('path',page_path,'pageViews',page_views)) from popular),'[]'::jsonb),
      'recentActivity',coalesce((select jsonb_agg(jsonb_build_object('path',page_path,'visitedAt',visited_at) order by visited_at desc) from recent),'[]'::jsonb)
    ) from summary s
  );
end;
$$;
revoke all on function public.get_site_analytics(date,date) from public, anon, authenticated;
grant execute on function public.get_site_analytics(date,date) to service_role;

-- Partnership enquiries are private contact records. Published partners remain in the existing partnerships table.
alter table public.service_enquiries add column if not exists partnership_id text;
alter table public.service_enquiries add column if not exists partnership_status text;
update public.service_enquiries set partnership_id='PART-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10)),partnership_status=coalesce(partnership_status,'pending') where category='partnership' and partnership_id is null;
create unique index if not exists service_enquiries_partnership_id_unique on public.service_enquiries(partnership_id) where partnership_id is not null;
alter table public.service_enquiries drop constraint if exists service_enquiries_partnership_id_check;
alter table public.service_enquiries add constraint service_enquiries_partnership_id_check check(partnership_id is null or partnership_id ~ '^PART-[A-F0-9]{10}$');
alter table public.service_enquiries drop constraint if exists service_enquiries_partnership_status_check;
alter table public.service_enquiries add constraint service_enquiries_partnership_status_check check(partnership_status is null or partnership_status in ('pending','under_review','approved','active','rejected'));

create or replace function public.assign_partnership_reference()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.category='partnership' then
    if new.partnership_id is null then new.partnership_id:='PART-'||upper(substr(encode(gen_random_bytes(6),'hex'),1,10)); end if;
    if new.partnership_status is null then new.partnership_status:='pending'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists service_enquiries_partnership_reference on public.service_enquiries;
create trigger service_enquiries_partnership_reference before insert or update of category on public.service_enquiries for each row execute function public.assign_partnership_reference();

alter table public.partnerships add column if not exists partnership_enquiry_id uuid references public.service_enquiries(id) on delete set null;
alter table public.partnerships add column if not exists status text not null default 'active';
alter table public.partnerships drop constraint if exists partnerships_status_check;
alter table public.partnerships add constraint partnerships_status_check check(status in ('pending','under_review','approved','active','rejected'));
create unique index if not exists partnerships_enquiry_unique on public.partnerships(partnership_enquiry_id) where partnership_enquiry_id is not null;
create index if not exists partnerships_public_status_idx on public.partnerships(is_published,status,created_at desc);

create or replace function public.admin_update_partnership_enquiry(
  p_enquiry_id uuid, p_status text, p_internal_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  enquiry public.service_enquiries%rowtype;
  partner_slug text;
begin
  if not public.is_admin() then raise exception 'Administrator access required.'; end if;
  if p_status not in ('pending','under_review','approved','active','rejected') then raise exception 'Invalid partnership status.'; end if;
  if p_internal_notes is not null and char_length(p_internal_notes)>5000 then raise exception 'Internal notes exceed 5,000 characters.'; end if;
  select * into enquiry from public.service_enquiries where id=p_enquiry_id and category='partnership' for update;
  if not found then raise exception 'Partnership enquiry not found.'; end if;
  update public.service_enquiries set partnership_status=p_status,
    internal_notes=case when p_internal_notes is null then internal_notes else p_internal_notes end
    where id=p_enquiry_id;
  if p_status in ('approved','active') then
    partner_slug:='enquiry-'||lower(regexp_replace(enquiry.partnership_id,'[^a-zA-Z0-9-]','','g'));
    insert into public.partnerships(partnership_enquiry_id,slug,name,description,is_published,status)
      values(p_enquiry_id,partner_slug,coalesce(nullif(trim(enquiry.organisation),''),enquiry.name),
        'Approved RILORA partnership: '||coalesce(nullif(trim(enquiry.service_required),''),'collaboration')||'.',true,p_status)
      on conflict(partnership_enquiry_id) do update set
        name=excluded.name,description=excluded.description,is_published=true,status=excluded.status,updated_at=now();
  else
    update public.partnerships set is_published=false,status=p_status,updated_at=now() where partnership_enquiry_id=p_enquiry_id;
  end if;
end;
$$;
revoke all on function public.admin_update_partnership_enquiry(uuid,text,text) from public,anon;
grant execute on function public.admin_update_partnership_enquiry(uuid,text,text) to authenticated;

-- CureTrics is the existing confirmed collaboration already represented by the public brand assets and project.
insert into public.partnerships(slug,name,description,logo_url,is_published,status)
values('curetrics','CureTrics','Confirmed collaboration with RILORA on the Healthcare Management Application.','/brand/rilora-curetrics.jpeg',true,'active')
on conflict(slug) do nothing;
