create table if not exists public.application_email_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.opportunity_applications(id) on delete set null,
  recipient_email text not null check (char_length(recipient_email) <= 254),
  email_type text not null check (email_type in ('application_acknowledgement','admin_notification','shortlist','interview','selection','rejection','test')),
  subject text not null check (char_length(subject) between 1 and 200),
  delivery_status text not null check (delivery_status in ('sent','failed','not_configured')),
  provider_message_id text,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists application_email_history_created_idx
  on public.application_email_history(created_at desc);
create index if not exists application_email_history_application_idx
  on public.application_email_history(application_id, created_at desc);

alter table public.application_email_history enable row level security;
revoke all on public.application_email_history from anon, authenticated;
grant select on public.application_email_history to authenticated;
grant all on public.application_email_history to service_role;

drop policy if exists "Admins view application email history" on public.application_email_history;
create policy "Admins view application email history"
  on public.application_email_history for select to authenticated
  using (public.is_admin());
