create extension if not exists pgcrypto;

create type public.opportunity_kind as enum ('job','internship','contributor');
create type public.application_status as enum ('submitted','under_review','shortlisted','assessment','interview','selected','onboarding','in_progress','completed','rejected','withdrawn');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '', phone text, education text, skills text[] not null default '{}',
  experience text, linkedin_url text, github_url text, portfolio_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','applicant')) default 'applicant', created_at timestamptz not null default now()
);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;

create table public.projects (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null, category text,
  description text not null, status text not null default 'In development', image_url text, logo_url text,
  technologies text[] not null default '{}', collaboration text, collaboration_url text,
  approved_updates jsonb not null default '[]', public_url text, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.opportunities (
  id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null,
  kind public.opportunity_kind not null, department text not null, description text not null,
  responsibilities text[] not null default '{}', required_skills text[] not null default '{}', eligibility text,
  experience_level text, engagement_type text not null, work_mode text not null, duration text, location text,
  compensation text, application_deadline date, positions integer check(positions is null or positions > 0),
  requirements text[] not null default '{}', certificate_eligible boolean not null default false,
  certificate_criteria text, mentorship text, is_published boolean not null default false,
  is_closed boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(kind <> 'job' or nullif(trim(compensation),'') is not null),
  check(not certificate_eligible or nullif(trim(certificate_criteria),'') is not null)
);
create table public.opportunity_applications (
  id uuid primary key default gen_random_uuid(), opportunity_id uuid not null references public.opportunities(id),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  cover_letter text, resume_url text, status public.application_status not null default 'submitted',
  internal_notes text, status_updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique(opportunity_id, applicant_id)
);
create index applications_by_applicant on public.opportunity_applications(applicant_id, created_at desc);
create index applications_by_opportunity on public.opportunity_applications(opportunity_id, status);
create table public.service_enquiries (
  id uuid primary key default gen_random_uuid(), name text not null, organisation text, email text not null,
  phone text, service_required text not null, project_description text not null, budget_range text,
  expected_timeline text, status text not null default 'new', created_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text not null, is_published boolean not null default false, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.site_content (
  content_key text primary key, content_value text not null, updated_at timestamptz not null default now()
);
create table public.partnerships (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text not null, logo_url text, website_url text, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_assignments (
  id uuid primary key default gen_random_uuid(), application_id uuid not null references public.opportunity_applications(id),
  project_id uuid not null references public.projects(id), department text, responsibilities text[] not null default '{}',
  starts_on date, expected_completion date, progress integer not null default 0 check(progress between 0 and 100),
  internal_feedback text, status text not null default 'active', created_at timestamptz not null default now(),
  unique(application_id, project_id)
);
create table public.contributor_progress (
  id uuid primary key default gen_random_uuid(), assignment_id uuid not null references public.project_assignments(id) on delete cascade,
  contributor_id uuid not null references auth.users(id) on delete cascade,
  progress integer not null check(progress between 0 and 100), update_text text not null,
  visible_to_contributor boolean not null default true, created_at timestamptz not null default now()
);
create table public.certificates (
  id uuid primary key default gen_random_uuid(), certificate_id text not null unique default ('RILORA-' || upper(substr(encode(gen_random_bytes(8),'hex'),1,12))),
  application_id uuid not null references public.opportunity_applications(id), contributor_id uuid not null references auth.users(id),
  project_id uuid references public.projects(id), certificate_type text not null, recipient_name text not null,
  programme_name text not null, issued_at timestamptz not null default now(), revoked_at timestamptz,
  unique(application_id, certificate_type)
);
create index certificates_by_contributor on public.certificates(contributor_id, issued_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end; $$;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function public.touch_updated_at();
create trigger projects_touch_updated_at before update on public.projects for each row execute function public.touch_updated_at();
create trigger opportunities_touch_updated_at before update on public.opportunities for each row execute function public.touch_updated_at();
create trigger services_touch_updated_at before update on public.services for each row execute function public.touch_updated_at();
create trigger site_content_touch_updated_at before update on public.site_content for each row execute function public.touch_updated_at();
create trigger partnerships_touch_updated_at before update on public.partnerships for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.projects enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_applications enable row level security;
alter table public.service_enquiries enable row level security;
alter table public.services enable row level security;
alter table public.site_content enable row level security;
alter table public.partnerships enable row level security;
alter table public.project_assignments enable row level security;
alter table public.contributor_progress enable row level security;
alter table public.certificates enable row level security;

create policy "profiles self or admin" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "profile update self" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "profile insert self" on public.profiles for insert to authenticated with check(id=auth.uid());
create policy "roles self read" on public.user_roles for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "published projects public" on public.projects for select using(is_published or public.is_admin());
create policy "assigned contributors see their project" on public.projects for select to authenticated using(exists(select 1 from public.project_assignments pa join public.opportunity_applications oa on oa.id=pa.application_id where pa.project_id=projects.id and oa.applicant_id=auth.uid()));
create policy "admin manages projects" on public.projects for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "published opportunities public" on public.opportunities for select using((is_published and not is_closed) or public.is_admin());
create policy "admin manages opportunities" on public.opportunities for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "application applicant or admin read" on public.opportunity_applications for select to authenticated using(applicant_id=auth.uid() or public.is_admin());
create policy "applicant creates own application" on public.opportunity_applications for insert to authenticated with check(applicant_id=auth.uid());
create policy "admin updates applications" on public.opportunity_applications for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin reads enquiries" on public.service_enquiries for select to authenticated using(public.is_admin());
create policy "admin manages enquiries" on public.service_enquiries for update to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "public submits service enquiries" on public.service_enquiries for insert to anon, authenticated with check(length(name)>0 and length(email)>3 and length(service_required)>0 and length(project_description)>0);
create policy "published services public" on public.services for select using(is_published or public.is_admin());
create policy "admin manages services" on public.services for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "public reads site content" on public.site_content for select using(true);
create policy "admin manages site content" on public.site_content for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "public reads published partnerships" on public.partnerships for select using(is_published or public.is_admin());
create policy "admin manages partnerships" on public.partnerships for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "admin manages assignments" on public.project_assignments for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "contributor sees assigned projects" on public.project_assignments for select to authenticated using(public.is_admin() or exists(select 1 from public.opportunity_applications a where a.id=application_id and a.applicant_id=auth.uid()));
create policy "progress admin or owner reads" on public.contributor_progress for select to authenticated using(public.is_admin() or contributor_id=auth.uid());
create policy "progress admin writes" on public.contributor_progress for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy "certificate owner or admin reads" on public.certificates for select to authenticated using(contributor_id=auth.uid() or public.is_admin());
create policy "admin manages certificates" on public.certificates for all to authenticated using(public.is_admin()) with check(public.is_admin());

create or replace function public.bootstrap_profile() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;
 insert into public.user_roles(user_id,role) values(new.id,'applicant') on conflict(user_id) do nothing;
 return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.bootstrap_profile();

create or replace function public.guard_open_application() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.opportunities o where o.id=new.opportunity_id and o.is_published and not o.is_closed and (o.application_deadline is null or o.application_deadline >= current_date) and (o.positions is null or (select count(*) from public.opportunity_applications a where a.opportunity_id=o.id) < o.positions)) then
   raise exception 'This opportunity is not accepting applications.';
 end if;
 new.status := 'submitted';
 new.internal_notes := null;
 new.status_updated_at := now();
 return new;
end; $$;
create trigger application_requires_open_opportunity before insert on public.opportunity_applications for each row execute function public.guard_open_application();

create or replace function public.guard_application_update() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Only administrators can update application status.'; end if;
 return new;
end; $$;
create trigger application_admin_only_updates before update on public.opportunity_applications for each row execute function public.guard_application_update();

create or replace function public.verify_certificate(lookup_id text)
returns table(certificate_id text, recipient_name text, programme_name text, certificate_type text, issued_at timestamptz)
language sql stable security definer set search_path=public as $$
 select c.certificate_id,c.recipient_name,c.programme_name,c.certificate_type,c.issued_at
 from public.certificates c where c.certificate_id=lookup_id and c.revoked_at is null limit 1;
$$;
revoke all on function public.verify_certificate(text) from public;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Admin bootstrap: promote only a known account by UUID using the Supabase SQL editor.
-- insert into public.user_roles(user_id, role) values ('AUTH_USER_UUID', 'admin')
-- on conflict(user_id) do update set role='admin';
