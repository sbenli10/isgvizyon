alter table if exists public.risk_assessments
  add column if not exists employer_representative_signature_url text,
  add column if not exists occupational_safety_specialist_signature_url text,
  add column if not exists workplace_doctor_signature_url text,
  add column if not exists employee_representative_signature_url text,
  add column if not exists support_personnel_signature_url text;

insert into storage.buckets (id, name, public)
select 'risk-assessment-signatures', 'risk-assessment-signatures', true
where not exists (
  select 1 from storage.buckets where id = 'risk-assessment-signatures'
);

drop policy if exists "Risk assessment signatures are publicly readable" on storage.objects;
create policy "Risk assessment signatures are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'risk-assessment-signatures');

drop policy if exists "Authenticated users can upload their risk assessment signature assets" on storage.objects;
create policy "Authenticated users can upload their risk assessment signature assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'risk-assessment-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can update their risk assessment signature assets" on storage.objects;
create policy "Authenticated users can update their risk assessment signature assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'risk-assessment-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'risk-assessment-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Authenticated users can delete their risk assessment signature assets" on storage.objects;
create policy "Authenticated users can delete their risk assessment signature assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'risk-assessment-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);
