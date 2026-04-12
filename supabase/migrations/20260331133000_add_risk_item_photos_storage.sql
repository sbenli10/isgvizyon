alter table if exists public.risk_items
  add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
select 'risk-item-photos', 'risk-item-photos', true
where not exists (
  select 1 from storage.buckets where id = 'risk-item-photos'
);

update storage.buckets
set public = true
where id = 'risk-item-photos';

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Risk item photos own read'
  ) then
    create policy "Risk item photos own read"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'risk-item-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Risk item photos own upload'
  ) then
    create policy "Risk item photos own upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'risk-item-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Risk item photos own update'
  ) then
    create policy "Risk item photos own update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'risk-item-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      )
      with check (
        bucket_id = 'risk-item-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Risk item photos own delete'
  ) then
    create policy "Risk item photos own delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'risk-item-photos'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;
