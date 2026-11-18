-- Additive public application and enquiry support. Existing applicant rows are preserved.
alter table public.opportunities
  add column if not exists job_id text,
  add column if not exists job_category text,
  add column if not exists employment_type text,
  add column if not exists vacancy_count integer,
  add column if not exists country text,
  add column if not exists state text,
  add column if not exists city text,
  add column if not exists office_location text,
  add column if not exists qualifications text,
  add column if not exists eligible_degrees text[] not null default '{}',
  add column if not exists eligible_branches text[] not null default '{}',
  add column if not exists graduation_year text,
  add column if not exists experience_required text,
  add column if not exists freshers_eligible boolean not null default false,
  add column if not exists preferred_skills text[] not null default '{}',
  add column if not exists salary_min numeric,
  add column if not exists salary_max numeric,
  add column if not exists currency text,
  add column if not exists benefits text[] not null default '{}',
  add column if not exists compensation_disclosure text,
  add column if not exists selection_process text,
  add column if not exists additional_information text,
  add column if not exists contact_email text,
  add column if not exists application_instructions text,
  add column if not exists image_url text;
create unique index if not exists opportunities_job_id_unique on public.opportunities(job_id) where job_id is not null;
create index if not exists opportunities_public_jobs_idx on public.opportunities(is_published,is_closed,created_at desc);

alter table public.opportunity_applications alter column applicant_id drop not null;
alter table public.opportunity_applications
  add column if not exists applicant_full_name text,
  add column if not exists applicant_email text,
  add column if not exists applicant_phone text,
  add column if not exists qualification text,
  add column if not exists institution text,
  add column if not exists graduation_year text,
  add column if not exists applicant_skills text,
  add column if not exists applicant_experience text,
  add column if not exists linkedin_url text,
  add column if not exists github_url text,
  add column if not exists portfolio_url text,
  add column if not exists additional_information text;
create index if not exists applications_public_email_created_idx on public.opportunity_applications(lower(applicant_email),created_at desc) where applicant_email is not null;

alter table public.service_enquiries
  add column if not exists enquiry_id text,
  add column if not exists category text,
  add column if not exists subject text,
  add column if not exists internal_notes text,
  add column if not exists read_at timestamptz;
update public.service_enquiries set enquiry_id='ENQ-'||upper(substr(replace(id::text,'-',''),1,12)) where enquiry_id is null;
alter table public.service_enquiries alter column enquiry_id set default ('ENQ-'||upper(substr(encode(gen_random_bytes(8),'hex'),1,12)));
create unique index if not exists service_enquiries_reference_unique on public.service_enquiries(enquiry_id);
create index if not exists service_enquiries_status_created_idx on public.service_enquiries(status,created_at desc);
drop policy if exists "admin deletes enquiries" on public.service_enquiries;
create policy "admin deletes enquiries" on public.service_enquiries for delete to authenticated using(public.is_admin());

alter table public.site_content add column if not exists is_public boolean not null default true;
drop policy if exists "public reads site content" on public.site_content;
create policy "public reads site content" on public.site_content for select using(is_public or public.is_admin());

alter table public.application_email_history drop constraint if exists application_email_history_email_type_check;
alter table public.application_email_history add constraint application_email_history_email_type_check
  check(email_type in ('application_acknowledgement','admin_notification','shortlist','interview','selection','rejection','test','general'));

create table if not exists public.riloragpt_rate_limits(
  client_hash text primary key check(client_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check(request_count>0)
);
alter table public.riloragpt_rate_limits enable row level security;
revoke all on public.riloragpt_rate_limits from public,anon,authenticated;
grant all on public.riloragpt_rate_limits to service_role;
create or replace function public.check_riloragpt_rate_limit(p_client_hash text)
returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
  if p_client_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid rate key'; end if;
  delete from public.riloragpt_rate_limits where window_started_at < now()-interval '2 hours';
  insert into public.riloragpt_rate_limits(client_hash,window_started_at,request_count) values(p_client_hash,now(),1)
  on conflict(client_hash) do update set
    request_count=case when public.riloragpt_rate_limits.window_started_at < now()-interval '1 hour' then 1 else public.riloragpt_rate_limits.request_count+1 end,
    window_started_at=case when public.riloragpt_rate_limits.window_started_at < now()-interval '1 hour' then now() else public.riloragpt_rate_limits.window_started_at end
  returning request_count<=30 into allowed;
  return allowed;
end; $$;
revoke all on function public.check_riloragpt_rate_limit(text) from public,anon,authenticated;
grant execute on function public.check_riloragpt_rate_limit(text) to service_role;

-- Candidates apply using server-side validation and the service role; anonymous clients never receive table access.
revoke all on public.opportunity_applications from anon;
grant select,insert,update on public.opportunity_applications to authenticated;
drop policy if exists "applicant creates own application" on public.opportunity_applications;
create policy "applicant creates own application" on public.opportunity_applications for insert to authenticated with check(applicant_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('job-images','job-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Admin manages job images" on storage.objects;
create policy "Admin manages job images" on storage.objects for all to authenticated
using(bucket_id='job-images' and public.is_admin()) with check(bucket_id='job-images' and public.is_admin());
