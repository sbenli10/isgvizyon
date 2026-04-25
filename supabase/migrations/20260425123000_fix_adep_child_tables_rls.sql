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
          and p.organization_id = ap.org_id
          and coalesce(p.is_active, true) = true
        )
      )
  );
$$;

alter table public.adep_teams enable row level security;
alter table public.adep_emergency_contacts enable row level security;
alter table public.adep_scenarios enable row level security;
alter table public.adep_preventive_measures enable row level security;
alter table public.adep_equipment_inventory enable row level security;
alter table public.adep_drills enable row level security;
alter table public.adep_checklists enable row level security;
alter table public.adep_raci_matrix enable row level security;
alter table public.adep_legal_references enable row level security;
alter table public.adep_risk_sources enable row level security;

drop policy if exists "Users can view own adep teams" on public.adep_teams;
drop policy if exists "Users can insert own adep teams" on public.adep_teams;
drop policy if exists "Users can update own adep teams" on public.adep_teams;
drop policy if exists "Users can delete own adep teams" on public.adep_teams;
create policy "Users can view own adep teams"
  on public.adep_teams
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep teams"
  on public.adep_teams
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep teams"
  on public.adep_teams
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep teams"
  on public.adep_teams
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep emergency contacts" on public.adep_emergency_contacts;
drop policy if exists "Users can insert own adep emergency contacts" on public.adep_emergency_contacts;
drop policy if exists "Users can update own adep emergency contacts" on public.adep_emergency_contacts;
drop policy if exists "Users can delete own adep emergency contacts" on public.adep_emergency_contacts;
create policy "Users can view own adep emergency contacts"
  on public.adep_emergency_contacts
  for select
  to authenticated
  using (plan_id is not null and public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep emergency contacts"
  on public.adep_emergency_contacts
  for insert
  to authenticated
  with check (plan_id is not null and public.can_access_adep_plan(plan_id));
create policy "Users can update own adep emergency contacts"
  on public.adep_emergency_contacts
  for update
  to authenticated
  using (plan_id is not null and public.can_access_adep_plan(plan_id))
  with check (plan_id is not null and public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep emergency contacts"
  on public.adep_emergency_contacts
  for delete
  to authenticated
  using (plan_id is not null and public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep scenarios" on public.adep_scenarios;
drop policy if exists "Users can insert own adep scenarios" on public.adep_scenarios;
drop policy if exists "Users can update own adep scenarios" on public.adep_scenarios;
drop policy if exists "Users can delete own adep scenarios" on public.adep_scenarios;
create policy "Users can view own adep scenarios"
  on public.adep_scenarios
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep scenarios"
  on public.adep_scenarios
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep scenarios"
  on public.adep_scenarios
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep scenarios"
  on public.adep_scenarios
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep preventive measures" on public.adep_preventive_measures;
drop policy if exists "Users can insert own adep preventive measures" on public.adep_preventive_measures;
drop policy if exists "Users can update own adep preventive measures" on public.adep_preventive_measures;
drop policy if exists "Users can delete own adep preventive measures" on public.adep_preventive_measures;
create policy "Users can view own adep preventive measures"
  on public.adep_preventive_measures
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep preventive measures"
  on public.adep_preventive_measures
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep preventive measures"
  on public.adep_preventive_measures
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep preventive measures"
  on public.adep_preventive_measures
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep equipment inventory" on public.adep_equipment_inventory;
drop policy if exists "Users can insert own adep equipment inventory" on public.adep_equipment_inventory;
drop policy if exists "Users can update own adep equipment inventory" on public.adep_equipment_inventory;
drop policy if exists "Users can delete own adep equipment inventory" on public.adep_equipment_inventory;
create policy "Users can view own adep equipment inventory"
  on public.adep_equipment_inventory
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep equipment inventory"
  on public.adep_equipment_inventory
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep equipment inventory"
  on public.adep_equipment_inventory
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep equipment inventory"
  on public.adep_equipment_inventory
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep drills" on public.adep_drills;
drop policy if exists "Users can insert own adep drills" on public.adep_drills;
drop policy if exists "Users can update own adep drills" on public.adep_drills;
drop policy if exists "Users can delete own adep drills" on public.adep_drills;
create policy "Users can view own adep drills"
  on public.adep_drills
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep drills"
  on public.adep_drills
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep drills"
  on public.adep_drills
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep drills"
  on public.adep_drills
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep checklists" on public.adep_checklists;
drop policy if exists "Users can insert own adep checklists" on public.adep_checklists;
drop policy if exists "Users can update own adep checklists" on public.adep_checklists;
drop policy if exists "Users can delete own adep checklists" on public.adep_checklists;
create policy "Users can view own adep checklists"
  on public.adep_checklists
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep checklists"
  on public.adep_checklists
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep checklists"
  on public.adep_checklists
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep checklists"
  on public.adep_checklists
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep raci matrix" on public.adep_raci_matrix;
drop policy if exists "Users can insert own adep raci matrix" on public.adep_raci_matrix;
drop policy if exists "Users can update own adep raci matrix" on public.adep_raci_matrix;
drop policy if exists "Users can delete own adep raci matrix" on public.adep_raci_matrix;
create policy "Users can view own adep raci matrix"
  on public.adep_raci_matrix
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep raci matrix"
  on public.adep_raci_matrix
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep raci matrix"
  on public.adep_raci_matrix
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep raci matrix"
  on public.adep_raci_matrix
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep legal references" on public.adep_legal_references;
drop policy if exists "Users can insert own adep legal references" on public.adep_legal_references;
drop policy if exists "Users can update own adep legal references" on public.adep_legal_references;
drop policy if exists "Users can delete own adep legal references" on public.adep_legal_references;
create policy "Users can view own adep legal references"
  on public.adep_legal_references
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep legal references"
  on public.adep_legal_references
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep legal references"
  on public.adep_legal_references
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep legal references"
  on public.adep_legal_references
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));

drop policy if exists "Users can view own adep risk sources" on public.adep_risk_sources;
drop policy if exists "Users can insert own adep risk sources" on public.adep_risk_sources;
drop policy if exists "Users can update own adep risk sources" on public.adep_risk_sources;
drop policy if exists "Users can delete own adep risk sources" on public.adep_risk_sources;
create policy "Users can view own adep risk sources"
  on public.adep_risk_sources
  for select
  to authenticated
  using (public.can_access_adep_plan(plan_id));
create policy "Users can insert own adep risk sources"
  on public.adep_risk_sources
  for insert
  to authenticated
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can update own adep risk sources"
  on public.adep_risk_sources
  for update
  to authenticated
  using (public.can_access_adep_plan(plan_id))
  with check (public.can_access_adep_plan(plan_id));
create policy "Users can delete own adep risk sources"
  on public.adep_risk_sources
  for delete
  to authenticated
  using (public.can_access_adep_plan(plan_id));
