alter table public.companies
  add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can view company logos" on storage.objects;
drop policy if exists "Authenticated users can upload company logos" on storage.objects;
drop policy if exists "Authenticated users can update company logos" on storage.objects;
drop policy if exists "Authenticated users can delete company logos" on storage.objects;

create policy "Authenticated users can view company logos"
on storage.objects
for select
to authenticated
using (bucket_id = 'company-logos');

create policy "Authenticated users can upload company logos"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'company-logos');

create policy "Authenticated users can update company logos"
on storage.objects
for update
to authenticated
using (bucket_id = 'company-logos')
with check (bucket_id = 'company-logos');

create policy "Authenticated users can delete company logos"
on storage.objects
for delete
to authenticated
using (bucket_id = 'company-logos');
