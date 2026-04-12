create table if not exists public.bulk_capa_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bulk_capa_templates enable row level security;

drop policy if exists "Bulk CAPA templates org members select" on public.bulk_capa_templates;
create policy "Bulk CAPA templates org members select"
  on public.bulk_capa_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = bulk_capa_templates.org_id
    )
  );

drop policy if exists "Bulk CAPA templates org members insert" on public.bulk_capa_templates;
create policy "Bulk CAPA templates org members insert"
  on public.bulk_capa_templates
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = bulk_capa_templates.org_id
    )
  );

drop policy if exists "Bulk CAPA templates owners update" on public.bulk_capa_templates;
create policy "Bulk CAPA templates owners update"
  on public.bulk_capa_templates
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Bulk CAPA templates owners delete" on public.bulk_capa_templates;
create policy "Bulk CAPA templates owners delete"
  on public.bulk_capa_templates
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop trigger if exists update_bulk_capa_templates_updated_at on public.bulk_capa_templates;
create trigger update_bulk_capa_templates_updated_at
  before update on public.bulk_capa_templates
  for each row
  execute function public.update_updated_at_column();
