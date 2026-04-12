insert into storage.buckets (id, name, public)
select 'capa-evidence', 'capa-evidence', false
where not exists (select 1 from storage.buckets where id = 'capa-evidence');

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'CAPA evidence org members read'
  ) then
    create policy "CAPA evidence org members read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'capa-evidence'
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
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'CAPA evidence org members upload'
  ) then
    create policy "CAPA evidence org members upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'capa-evidence'
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
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'CAPA evidence org members update'
  ) then
    create policy "CAPA evidence org members update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'capa-evidence'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      )
      with check (
        bucket_id = 'capa-evidence'
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
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'CAPA evidence org members delete'
  ) then
    create policy "CAPA evidence org members delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'capa-evidence'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.organization_id::text = (storage.foldername(name))[1]
        )
      );
  end if;
end $$;
