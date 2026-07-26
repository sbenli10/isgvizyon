create table if not exists public.suggestion_ledger_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  company_name text not null default '',
  sgk_registry_no text not null default '',
  hazard_class text not null default '',
  record_date date not null default current_date,
  general_note text not null default '',
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suggestion_ledger_status_check check (status in ('Taslak', 'Kaydedildi'))
);

create table if not exists public.suggestion_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.suggestion_ledger_records(id) on delete cascade,
  category text not null default '',
  finding text not null,
  suggestion text not null,
  legal_reference text not null default '',
  priority text not null default 'Genel',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint suggestion_ledger_priority_check check (priority in ('Yüksek Öncelik', 'Orta Öncelik', 'Bilgilendirme', 'Genel'))
);

create index if not exists idx_suggestion_ledger_records_user
  on public.suggestion_ledger_records(user_id, updated_at desc);

create index if not exists idx_suggestion_ledger_records_org
  on public.suggestion_ledger_records(organization_id, updated_at desc);

create index if not exists idx_suggestion_ledger_records_company
  on public.suggestion_ledger_records(company_id, record_date desc);

create index if not exists idx_suggestion_ledger_entries_record
  on public.suggestion_ledger_entries(record_id, sort_order);

create or replace function public.set_suggestion_ledger_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_suggestion_ledger_records_updated_at on public.suggestion_ledger_records;
create trigger set_suggestion_ledger_records_updated_at
before update on public.suggestion_ledger_records
for each row execute function public.set_suggestion_ledger_updated_at();

alter table public.suggestion_ledger_records enable row level security;
alter table public.suggestion_ledger_entries enable row level security;

create policy "Suggestion ledger records are scoped to user or active workspace"
on public.suggestion_ledger_records
for all
to authenticated
using (
  user_id = auth.uid()
  or (
    organization_id is not null
    and public.is_organization_member(organization_id)
  )
)
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or public.is_organization_member(organization_id)
  )
);

create policy "Suggestion ledger entries follow parent record scope"
on public.suggestion_ledger_entries
for all
to authenticated
using (
  exists (
    select 1 from public.suggestion_ledger_records r
    where r.id = record_id
      and (
        r.user_id = auth.uid()
        or (r.organization_id is not null and public.is_organization_member(r.organization_id))
      )
  )
)
with check (
  exists (
    select 1 from public.suggestion_ledger_records r
    where r.id = record_id
      and r.user_id = auth.uid()
      and (r.organization_id is null or public.is_organization_member(r.organization_id))
  )
);
