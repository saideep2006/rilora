create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.opportunity_applications(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists application_status_history_app_idx
  on public.application_status_history(application_id, changed_at desc);
alter table public.application_status_history enable row level security;
revoke all on public.application_status_history from anon, authenticated;
grant select on public.application_status_history to authenticated;
grant all on public.application_status_history to service_role;

drop policy if exists "Applicants and admins view application status history" on public.application_status_history;
create policy "Applicants and admins view application status history"
  on public.application_status_history for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.opportunity_applications a
      where a.id = application_id and a.applicant_id = auth.uid()
    )
  );

create or replace function public.record_application_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.application_status_history(application_id, previous_status, new_status, changed_by)
    values (new.id, null, new.status::text, auth.uid());
  elsif old.status is distinct from new.status then
    insert into public.application_status_history(application_id, previous_status, new_status, changed_by)
    values (new.id, old.status::text, new.status::text, auth.uid());
  end if;
  return new;
end;
$$;
revoke all on function public.record_application_status_history() from public, anon, authenticated;
drop trigger if exists record_application_status_history on public.opportunity_applications;
create trigger record_application_status_history
  after insert or update on public.opportunity_applications
  for each row execute function public.record_application_status_history();
