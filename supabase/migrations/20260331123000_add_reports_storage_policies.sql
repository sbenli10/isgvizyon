insert into storage.buckets (id, name, public)
select 'reports', 'reports', true
where not exists (
  select 1 from storage.buckets where id = 'reports'
);

update storage.buckets
set public = true
where id = 'reports';

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports own files read'
  ) then
    create policy "Reports own files read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'reports'
        and auth.uid()::text = (storage.foldername(name))[2]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports own files upload'
  ) then
    create policy "Reports own files upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'reports'
        and auth.uid()::text = (storage.foldername(name))[2]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports own files update'
  ) then
    create policy "Reports own files update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'reports'
        and auth.uid()::text = (storage.foldername(name))[2]
      )
      with check (
        bucket_id = 'reports'
        and auth.uid()::text = (storage.foldername(name))[2]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports own files delete'
  ) then
    create policy "Reports own files delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'reports'
        and auth.uid()::text = (storage.foldername(name))[2]
      );
  end if;
end $$;
