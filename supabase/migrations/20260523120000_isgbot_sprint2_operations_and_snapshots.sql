-- ISGBot Sprint 2: operation history and reliable previous snapshot support.

create table if not exists public.isgbot_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  operation_type text not null,
  operation_title text not null,
  status text not null default 'started',
  source text not null default 'web_app',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  input_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb,
  error_message text,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists idx_isgbot_operations_org_created
  on public.isgbot_operations(organization_id, created_at desc);

create index if not exists idx_isgbot_operations_user_created
  on public.isgbot_operations(user_id, created_at desc);

create index if not exists idx_isgbot_operations_type_status
  on public.isgbot_operations(operation_type, status);

alter table public.isgbot_operations enable row level security;

drop policy if exists "Organization members can view isgbot operations" on public.isgbot_operations;
create policy "Organization members can view isgbot operations"
on public.isgbot_operations
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgbot_operations.organization_id
  )
);

drop policy if exists "Organization members can insert own isgbot operations" on public.isgbot_operations;
create policy "Organization members can insert own isgbot operations"
on public.isgbot_operations
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgbot_operations.organization_id
  )
);

drop policy if exists "Organization members can update own isgbot operations" on public.isgbot_operations;
create policy "Organization members can update own isgbot operations"
on public.isgbot_operations
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgbot_operations.organization_id
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgbot_operations.organization_id
  )
);

grant select, insert, update on public.isgbot_operations to authenticated;

alter table if exists public.isgkatip_companies_backup
  add column if not exists snapshot_id uuid,
  add column if not exists snapshot_at timestamptz,
  add column if not exists company_identifier text,
  add column if not exists contract_status text,
  add column if not exists is_deleted boolean;

update public.isgkatip_companies_backup
set snapshot_at = coalesce(snapshot_at, last_synced_at, updated_at, created_at, now()),
    company_identifier = coalesce(company_identifier, nullif(sgk_no, ''), id::text)
where snapshot_at is null
   or company_identifier is null;

create index if not exists idx_isgkatip_companies_backup_org_snapshot
  on public.isgkatip_companies_backup(org_id, snapshot_at desc);

create index if not exists idx_isgkatip_companies_backup_org_identifier
  on public.isgkatip_companies_backup(org_id, company_identifier);

alter table if exists public.isgkatip_companies_backup enable row level security;

drop policy if exists "Organization members can view isgkatip backup snapshots" on public.isgkatip_companies_backup;
create policy "Organization members can view isgkatip backup snapshots"
on public.isgkatip_companies_backup
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_companies_backup.org_id
  )
);

grant select on public.isgkatip_companies_backup to authenticated;
