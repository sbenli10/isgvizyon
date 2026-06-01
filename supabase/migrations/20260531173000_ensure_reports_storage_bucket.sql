insert into storage.buckets (id, name, public)
select 'reports', 'reports', false
where not exists (
  select 1
  from storage.buckets
  where id = 'reports'
);

update storage.buckets
set public = false
where id = 'reports';

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports bucket authenticated read'
  ) then
    create policy "Reports bucket authenticated read"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'reports');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports bucket authenticated upload'
  ) then
    create policy "Reports bucket authenticated upload"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'reports');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports bucket authenticated update'
  ) then
    create policy "Reports bucket authenticated update"
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'reports')
      with check (bucket_id = 'reports');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Reports bucket authenticated delete'
  ) then
    create policy "Reports bucket authenticated delete"
      on storage.objects
      for delete
      to authenticated
      using (bucket_id = 'reports');
  end if;
end $$;
