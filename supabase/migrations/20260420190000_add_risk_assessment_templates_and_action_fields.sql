create table if not exists public.risk_assessment_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sector text,
  method text not null default 'fine_kinney',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.risk_assessment_templates enable row level security;

drop policy if exists "Risk assessment templates org members select" on public.risk_assessment_templates;
create policy "Risk assessment templates org members select"
  on public.risk_assessment_templates
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = risk_assessment_templates.org_id
    )
  );

drop policy if exists "Risk assessment templates org members insert" on public.risk_assessment_templates;
create policy "Risk assessment templates org members insert"
  on public.risk_assessment_templates
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = risk_assessment_templates.org_id
    )
  );

drop policy if exists "Risk assessment templates owners update" on public.risk_assessment_templates;
create policy "Risk assessment templates owners update"
  on public.risk_assessment_templates
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Risk assessment templates owners delete" on public.risk_assessment_templates;
create policy "Risk assessment templates owners delete"
  on public.risk_assessment_templates
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists risk_assessment_templates_org_idx
  on public.risk_assessment_templates (org_id, created_at desc);

drop trigger if exists update_risk_assessment_templates_updated_at on public.risk_assessment_templates;
create trigger update_risk_assessment_templates_updated_at
  before update on public.risk_assessment_templates
  for each row
  execute function public.update_updated_at_column();

alter table if exists public.risk_items
  add column if not exists completion_date date,
  add column if not exists completed_activity text;
