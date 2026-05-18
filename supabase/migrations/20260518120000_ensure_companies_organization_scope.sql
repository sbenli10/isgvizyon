alter table public.companies
  add column if not exists organization_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_companies_organization_id_active
  on public.companies(organization_id, is_active, created_at desc);

update public.companies c
set organization_id = p.organization_id
from public.profiles p
where c.organization_id is null
  and c.user_id = p.id
  and p.organization_id is not null;
