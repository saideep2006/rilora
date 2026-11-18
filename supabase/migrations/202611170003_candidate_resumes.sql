alter table public.opportunity_applications
  add column if not exists resume_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-resumes',
  'candidate-resumes',
  false,
  5242880,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Applicants upload own resumes"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'candidate-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Applicants and admins read resumes"
on storage.objects for select to authenticated
using (
  bucket_id = 'candidate-resumes'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

create policy "Applicants delete own unsubmitted resumes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'candidate-resumes'
  and (storage.foldername(name))[1] = auth.uid()::text
);
