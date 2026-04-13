insert into storage.buckets (id, name, public)
select 'inspection-photos', 'inspection-photos', true
where not exists (
  select 1 from storage.buckets where id = 'inspection-photos'
);

update storage.buckets
set public = true
where id = 'inspection-photos';

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Inspection photos own read'
  ) then
    create policy "Inspection photos own read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'inspection-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Inspection photos own upload'
  ) then
    create policy "Inspection photos own upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'inspection-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Inspection photos own update'
  ) then
    create policy "Inspection photos own update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'inspection-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'inspection-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Inspection photos own delete'
  ) then
    create policy "Inspection photos own delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'inspection-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
