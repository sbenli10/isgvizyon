alter table if exists public.adep_plans
  add column if not exists company_id uuid references public.companies(id) on delete set null,
  add column if not exists org_id uuid references public.organizations(id) on delete set null;

create index if not exists idx_adep_plans_company_id
  on public.adep_plans(company_id);

create index if not exists idx_adep_plans_org_id_active
  on public.adep_plans(org_id, is_deleted, updated_at desc);

update public.adep_plans ap
set company_id = c.id
from public.companies c
where ap.company_id is null
  and ap.user_id = c.user_id
  and lower(trim(ap.company_name)) = lower(trim(c.name));

update public.adep_plans ap
set org_id = p.organization_id
from public.profiles p
where ap.org_id is null
  and ap.user_id = p.id
  and p.organization_id is not null;

create or replace function public.can_access_adep_plan(_plan_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.adep_plans ap
    left join public.profiles p
      on p.id = auth.uid()
    where ap.id = _plan_id
      and coalesce(ap.is_deleted, false) = false
      and (
        ap.user_id = auth.uid()
        or (
          ap.org_id is not null
          and public.is_active_workspace_member(ap.org_id)
        )
        or (
          ap.org_id is not null
          and p.organization_id = ap.org_id
          and coalesce(p.is_active, true) = true
        )
      )
  );
$$;
