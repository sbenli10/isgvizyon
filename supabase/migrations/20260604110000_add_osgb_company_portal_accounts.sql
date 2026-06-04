create table if not exists public.osgb_company_portal_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  username text not null,
  password_plain text,
  password_hash text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint osgb_company_portal_accounts_org_company_key unique (organization_id, company_id),
  constraint osgb_company_portal_accounts_org_username_key unique (organization_id, username)
);

create index if not exists idx_osgb_company_portal_accounts_org_status
  on public.osgb_company_portal_accounts(organization_id, is_active, created_at desc);

create index if not exists idx_osgb_company_portal_accounts_user
  on public.osgb_company_portal_accounts(user_id, created_at desc);

create index if not exists idx_osgb_company_portal_accounts_company
  on public.osgb_company_portal_accounts(company_id);

drop trigger if exists trg_osgb_company_portal_accounts_updated_at on public.osgb_company_portal_accounts;
create trigger trg_osgb_company_portal_accounts_updated_at
before update on public.osgb_company_portal_accounts
for each row
execute function public.update_updated_at_column();

alter table public.osgb_company_portal_accounts enable row level security;

drop policy if exists "OSGB members can view company portal accounts" on public.osgb_company_portal_accounts;
create policy "OSGB members can view company portal accounts"
on public.osgb_company_portal_accounts
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_osgb_org_member(organization_id)
);

drop policy if exists "OSGB operators can insert company portal accounts" on public.osgb_company_portal_accounts;
create policy "OSGB operators can insert company portal accounts"
on public.osgb_company_portal_accounts
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_osgb_org_member(organization_id)
  and exists (
    select 1
    from public.isgkatip_companies company
    where company.id = company_id
      and company.org_id = organization_id
      and coalesce(company.is_deleted, false) = false
      and coalesce(company.is_osgb_managed, false) = true
  )
);

drop policy if exists "OSGB operators can update company portal accounts" on public.osgb_company_portal_accounts;
create policy "OSGB operators can update company portal accounts"
on public.osgb_company_portal_accounts
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
)
with check (
  user_id = auth.uid()
  or public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
);

drop policy if exists "OSGB operators can delete company portal accounts" on public.osgb_company_portal_accounts;
create policy "OSGB operators can delete company portal accounts"
on public.osgb_company_portal_accounts
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_osgb_org_role(organization_id, array['owner', 'admin', 'operations_manager'])
);
