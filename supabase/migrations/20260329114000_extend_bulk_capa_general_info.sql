alter table if exists public.bulk_capa_sessions
  add column if not exists area_region text,
  add column if not exists observation_date_range text,
  add column if not exists report_date date,
  add column if not exists observer_name text,
  add column if not exists observer_certificate_no text,
  add column if not exists responsible_person text,
  add column if not exists employer_representative_title text,
  add column if not exists employer_representative_name text,
  add column if not exists report_no text,
  add column if not exists service_company_logo_url text;

insert into storage.buckets (id, name, public)
select 'dof-branding', 'dof-branding', false
where not exists (select 1 from storage.buckets where id = 'dof-branding');

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'DOF branding org members read'
  ) then
    create policy "DOF branding org members read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'dof-branding'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'DOF branding org members upload'
  ) then
    create policy "DOF branding org members upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'dof-branding'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'DOF branding org members update'
  ) then
    create policy "DOF branding org members update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'dof-branding'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      )
      with check (
        bucket_id = 'dof-branding'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'DOF branding org members delete'
  ) then
    create policy "DOF branding org members delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'dof-branding'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;
end $$;
