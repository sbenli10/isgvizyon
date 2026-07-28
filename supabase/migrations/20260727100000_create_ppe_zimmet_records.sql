create table if not exists public.ppe_zimmet_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  form_no text not null default '',
  delivery_date date null,
  periodic_control_date date null,
  employees jsonb not null default '[]'::jsonb,
  ppe_items jsonb not null default '[]'::jsonb,
  delivered_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ppe_zimmet_records_user_updated
  on public.ppe_zimmet_records(user_id, updated_at desc);

create index if not exists idx_ppe_zimmet_records_company
  on public.ppe_zimmet_records(company_id, updated_at desc);

create index if not exists idx_ppe_zimmet_records_org
  on public.ppe_zimmet_records(organization_id, updated_at desc);

create or replace function public.set_ppe_zimmet_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ppe_zimmet_records_updated_at on public.ppe_zimmet_records;
create trigger trg_ppe_zimmet_records_updated_at
before update on public.ppe_zimmet_records
for each row
execute function public.set_ppe_zimmet_records_updated_at();

alter table public.ppe_zimmet_records enable row level security;

drop policy if exists "Users can view PPE zimmet records" on public.ppe_zimmet_records;
create policy "Users can view PPE zimmet records"
on public.ppe_zimmet_records
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert PPE zimmet records" on public.ppe_zimmet_records;
create policy "Users can insert PPE zimmet records"
on public.ppe_zimmet_records
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update PPE zimmet records" on public.ppe_zimmet_records;
create policy "Users can update PPE zimmet records"
on public.ppe_zimmet_records
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete PPE zimmet records" on public.ppe_zimmet_records;
create policy "Users can delete PPE zimmet records"
on public.ppe_zimmet_records
for delete
to authenticated
using (user_id = auth.uid());
