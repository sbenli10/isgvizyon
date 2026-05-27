insert into storage.buckets (id, name, public)
values ('certificate-files', 'certificate-files', false)
on conflict (id) do update
set public = false;

drop policy if exists "Authenticated users can read certificate files" on storage.objects;
drop policy if exists "Authenticated users can upload certificate files" on storage.objects;
drop policy if exists "Authenticated users can update certificate files" on storage.objects;
drop policy if exists "Authenticated users can delete certificate files" on storage.objects;

create policy "Authenticated users can read certificate files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'certificate-files'
  and (storage.foldername(name))[1] in ('logos', 'pdf', 'archives')
);

create policy "Authenticated users can upload certificate files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'certificate-files'
  and (storage.foldername(name))[1] in ('logos', 'pdf', 'archives')
);

create policy "Authenticated users can update certificate files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'certificate-files'
  and (storage.foldername(name))[1] in ('logos', 'pdf', 'archives')
)
with check (
  bucket_id = 'certificate-files'
  and (storage.foldername(name))[1] in ('logos', 'pdf', 'archives')
);

create policy "Authenticated users can delete certificate files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'certificate-files'
  and (storage.foldername(name))[1] in ('logos', 'pdf', 'archives')
);
