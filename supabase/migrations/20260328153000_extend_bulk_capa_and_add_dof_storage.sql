create extension if not exists pgcrypto;

alter table if exists public.bulk_capa_sessions
  add column if not exists organization_id uuid references public.organizations(id) on delete set null,
  add column if not exists company_name text,
  add column if not exists department_name text,
  add column if not exists overall_analysis text,
  add column if not exists generated_doc_path text,
  add column if not exists report_file_url text;

alter table if exists public.bulk_capa_entries
  add column if not exists risk_definition text,
  add column if not exists corrective_action text,
  add column if not exists preventive_action text,
  add column if not exists priority text default 'medium',
  add column if not exists due_date date,
  add column if not exists related_department text,
  add column if not exists notification_method text,
  add column if not exists responsible_name text,
  add column if not exists responsible_role text,
  add column if not exists approver_name text,
  add column if not exists approver_title text default 'İş Güvenliği Uzmanı',
  add column if not exists include_stamp boolean not null default true,
  add column if not exists media_urls jsonb not null default '[]'::jsonb,
  add column if not exists ai_analyzed boolean not null default false;

alter table if exists public.bulk_capa_entries
  drop constraint if exists bulk_capa_entries_priority_check;

alter table if exists public.bulk_capa_entries
  add constraint bulk_capa_entries_priority_check
  check (priority in ('low', 'medium', 'high', 'critical'));

alter table if exists public.profiles
  add column if not exists stamp_url text;

insert into storage.buckets (id, name, public)
select 'dof-reports', 'dof-reports', false
where not exists (select 1 from storage.buckets where id = 'dof-reports');

insert into storage.buckets (id, name, public)
select 'dof-images', 'dof-images', false
where not exists (select 1 from storage.buckets where id = 'dof-images');

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF reports org members read'
  ) then
    create policy "DOF reports org members read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'dof-reports'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF reports org members upload'
  ) then
    create policy "DOF reports org members upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'dof-reports'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF reports org members update'
  ) then
    create policy "DOF reports org members update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'dof-reports'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      )
      with check (
        bucket_id = 'dof-reports'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF reports org members delete'
  ) then
    create policy "DOF reports org members delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'dof-reports'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF images org members read'
  ) then
    create policy "DOF images org members read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'dof-images'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF images org members upload'
  ) then
    create policy "DOF images org members upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'dof-images'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF images org members update'
  ) then
    create policy "DOF images org members update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'dof-images'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      )
      with check (
        bucket_id = 'dof-images'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'DOF images org members delete'
  ) then
    create policy "DOF images org members delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'dof-images'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;
end $$;
