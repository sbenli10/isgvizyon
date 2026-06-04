insert into storage.buckets (id, name, public)
values ('safety_documents', 'safety_documents', false)
on conflict (id) do nothing;

create table if not exists public.osgb_archive_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  folder_path text not null default '',
  file_name text not null,
  file_type text,
  file_size bigint,
  storage_bucket text not null default 'safety_documents',
  storage_path text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_archive_files_org_company
  on public.osgb_archive_files(organization_id, company_id, uploaded_at desc);

create index if not exists idx_osgb_archive_files_user_company
  on public.osgb_archive_files(user_id, company_id, uploaded_at desc);

create unique index if not exists idx_osgb_archive_files_storage_path
  on public.osgb_archive_files(storage_bucket, storage_path);

drop trigger if exists trg_osgb_archive_files_updated_at on public.osgb_archive_files;
create trigger trg_osgb_archive_files_updated_at
before update on public.osgb_archive_files
for each row
execute function public.update_updated_at_column();

alter table public.osgb_archive_files enable row level security;

drop policy if exists "OSGB members can view archive files" on public.osgb_archive_files;
create policy "OSGB members can view archive files"
on public.osgb_archive_files
for select
to authenticated
using (
  user_id = auth.uid()
  or (organization_id is not null and public.is_osgb_org_member(organization_id))
);

drop policy if exists "OSGB members can insert archive files" on public.osgb_archive_files;
create policy "OSGB members can insert archive files"
on public.osgb_archive_files
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or public.is_osgb_org_member(organization_id)
  )
  and exists (
    select 1
    from public.isgkatip_companies company
    where company.id = company_id
      and coalesce(company.is_deleted, false) = false
      and (
        organization_id is null
        or company.org_id = organization_id
      )
  )
);

drop policy if exists "OSGB members can update archive files" on public.osgb_archive_files;
create policy "OSGB members can update archive files"
on public.osgb_archive_files
for update
to authenticated
using (
  user_id = auth.uid()
  or (organization_id is not null and public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']))
)
with check (
  user_id = auth.uid()
  or (organization_id is not null and public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']))
);

drop policy if exists "OSGB members can delete archive files" on public.osgb_archive_files;
create policy "OSGB members can delete archive files"
on public.osgb_archive_files
for delete
to authenticated
using (
  user_id = auth.uid()
  or (organization_id is not null and public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager']))
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB archive authenticated read'
  ) then
    create policy "OSGB archive authenticated read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'safety_documents'
        and (storage.foldername(name))[1] = 'osgb-archive'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB archive authenticated upload'
  ) then
    create policy "OSGB archive authenticated upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'safety_documents'
        and (storage.foldername(name))[1] = 'osgb-archive'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB archive authenticated update'
  ) then
    create policy "OSGB archive authenticated update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'safety_documents'
        and (storage.foldername(name))[1] = 'osgb-archive'
      )
      with check (
        bucket_id = 'safety_documents'
        and (storage.foldername(name))[1] = 'osgb-archive'
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB archive authenticated delete'
  ) then
    create policy "OSGB archive authenticated delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'safety_documents'
        and (storage.foldername(name))[1] = 'osgb-archive'
      );
  end if;
end $$;
