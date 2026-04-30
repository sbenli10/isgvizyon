alter table public.isgkatip_companies enable row level security;
alter table public.isgkatip_compliance_flags enable row level security;
alter table public.isgkatip_predictive_alerts enable row level security;
alter table public.isgkatip_sync_logs enable row level security;
alter table public.osgb_tasks enable row level security;

drop policy if exists "OSGB members can view isgkatip companies" on public.isgkatip_companies;
drop policy if exists "OSGB members can manage isgkatip companies" on public.isgkatip_companies;

create policy "ISGBot org members can view companies"
on public.isgkatip_companies
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_companies.org_id
      and coalesce(p.is_active, true) = true
  )
);

create policy "ISGBot org members can manage companies"
on public.isgkatip_companies
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_companies.org_id
      and coalesce(p.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_companies.org_id
      and coalesce(p.is_active, true) = true
  )
);

drop policy if exists "ISGBot org members can view flags" on public.isgkatip_compliance_flags;
drop policy if exists "ISGBot org members can manage flags" on public.isgkatip_compliance_flags;

create policy "ISGBot org members can view flags"
on public.isgkatip_compliance_flags
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_compliance_flags.org_id
      and coalesce(p.is_active, true) = true
  )
);

create policy "ISGBot org members can manage flags"
on public.isgkatip_compliance_flags
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_compliance_flags.org_id
      and coalesce(p.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_compliance_flags.org_id
      and coalesce(p.is_active, true) = true
  )
);

drop policy if exists "ISGBot org members can view alerts" on public.isgkatip_predictive_alerts;
drop policy if exists "ISGBot org members can manage alerts" on public.isgkatip_predictive_alerts;

create policy "ISGBot org members can view alerts"
on public.isgkatip_predictive_alerts
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_predictive_alerts.org_id
      and coalesce(p.is_active, true) = true
  )
);

create policy "ISGBot org members can manage alerts"
on public.isgkatip_predictive_alerts
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_predictive_alerts.org_id
      and coalesce(p.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_predictive_alerts.org_id
      and coalesce(p.is_active, true) = true
  )
);

drop policy if exists "ISGBot org members can view sync logs" on public.isgkatip_sync_logs;
drop policy if exists "ISGBot org members can manage sync logs" on public.isgkatip_sync_logs;

create policy "ISGBot org members can view sync logs"
on public.isgkatip_sync_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_sync_logs.org_id
      and coalesce(p.is_active, true) = true
  )
);

create policy "ISGBot org members can manage sync logs"
on public.isgkatip_sync_logs
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_sync_logs.org_id
      and coalesce(p.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = isgkatip_sync_logs.org_id
      and coalesce(p.is_active, true) = true
  )
);

drop policy if exists "Organization members can view OSGB tasks" on public.osgb_tasks;
drop policy if exists "Organization members can manage OSGB tasks" on public.osgb_tasks;

create policy "ISGBot org members can view tasks"
on public.osgb_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = osgb_tasks.organization_id
      and coalesce(p.is_active, true) = true
  )
);

create policy "ISGBot org members can manage tasks"
on public.osgb_tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = osgb_tasks.organization_id
      and coalesce(p.is_active, true) = true
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = osgb_tasks.organization_id
      and coalesce(p.is_active, true) = true
  )
);
