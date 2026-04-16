create table if not exists public.osgb_external_integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'rest_api' check (provider in ('rest_api', 'custom_isgkatip')),
  integration_name text not null,
  base_url text not null,
  api_path text not null default '/companies',
  source_key text,
  status text not null default 'active' check (status in ('active', 'inactive', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_external_integrations_org
  on public.osgb_external_integrations(organization_id, status, created_at desc);

alter table public.osgb_external_integrations enable row level security;

drop policy if exists "Organization members can view OSGB external integrations" on public.osgb_external_integrations;
create policy "Organization members can view OSGB external integrations"
on public.osgb_external_integrations
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Organization members can manage OSGB external integrations" on public.osgb_external_integrations;
create policy "Organization members can manage OSGB external integrations"
on public.osgb_external_integrations
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

create table if not exists public.osgb_client_portal_uploads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal_link_id uuid not null references public.osgb_client_portal_links(id) on delete cascade,
  company_id uuid not null references public.isgkatip_companies(id) on delete cascade,
  required_document_id uuid references public.osgb_required_documents(id) on delete set null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  file_size bigint,
  note text,
  submitted_by_name text,
  submitted_by_email text,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_osgb_client_portal_uploads_org_status
  on public.osgb_client_portal_uploads(organization_id, review_status, created_at desc);

create index if not exists idx_osgb_client_portal_uploads_link
  on public.osgb_client_portal_uploads(portal_link_id, created_at desc);

alter table public.osgb_client_portal_uploads enable row level security;

drop policy if exists "Organization members can view OSGB client portal uploads" on public.osgb_client_portal_uploads;
create policy "Organization members can view OSGB client portal uploads"
on public.osgb_client_portal_uploads
for select
to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists "Organization members can manage OSGB client portal uploads" on public.osgb_client_portal_uploads;
create policy "Organization members can manage OSGB client portal uploads"
on public.osgb_client_portal_uploads
for all
to authenticated
using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));

do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_updated_at_column') then
    if not exists (select 1 from pg_trigger where tgname = 'trg_osgb_external_integrations_updated_at') then
      create trigger trg_osgb_external_integrations_updated_at
      before update on public.osgb_external_integrations
      for each row execute function public.update_updated_at_column();
    end if;

    if not exists (select 1 from pg_trigger where tgname = 'trg_osgb_client_portal_uploads_updated_at') then
      create trigger trg_osgb_client_portal_uploads_updated_at
      before update on public.osgb_client_portal_uploads
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end
$$;

insert into storage.buckets (id, name, public)
select 'osgb-client-portal', 'osgb-client-portal', false
where not exists (
  select 1 from storage.buckets where id = 'osgb-client-portal'
);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB client portal files read own organization'
  ) then
    create policy "OSGB client portal files read own organization"
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'osgb-client-portal'
        and public.is_organization_member(((storage.foldername(name))[1])::uuid)
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB client portal files update own organization'
  ) then
    create policy "OSGB client portal files update own organization"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'osgb-client-portal'
        and public.is_organization_member(((storage.foldername(name))[1])::uuid)
      )
      with check (
        bucket_id = 'osgb-client-portal'
        and public.is_organization_member(((storage.foldername(name))[1])::uuid)
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'OSGB client portal files delete own organization'
  ) then
    create policy "OSGB client portal files delete own organization"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'osgb-client-portal'
        and public.is_organization_member(((storage.foldername(name))[1])::uuid)
      );
  end if;
end
$$;

create or replace function public.get_osgb_client_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link record;
  v_documents jsonb := '[]'::jsonb;
  v_visits jsonb := '[]'::jsonb;
  v_finance jsonb := '{}'::jsonb;
  v_uploads jsonb := '[]'::jsonb;
begin
  select
    link.id,
    link.organization_id,
    link.company_id,
    link.contact_name,
    link.contact_email,
    link.portal_status,
    link.expires_at,
    company.company_name,
    company.hazard_class,
    company.employee_count,
    org.name as organization_name
  into v_link
  from public.osgb_client_portal_links link
  join public.isgkatip_companies company on company.id = link.company_id
  left join public.organizations org on org.id = link.organization_id
  where link.access_token = p_token
    and link.portal_status = 'active'
    and (link.expires_at is null or link.expires_at > now())
  limit 1;

  if not found then
    return null;
  end if;

  update public.osgb_client_portal_links
  set last_viewed_at = now()
  where id = v_link.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', doc.id,
        'documentType', doc.document_type,
        'requiredReason', doc.required_reason,
        'riskIfMissing', doc.risk_if_missing,
        'dueDate', doc.due_date,
        'status', doc.status,
        'delayDays', doc.delay_days,
        'riskLevel', doc.risk_level
      )
      order by doc.delay_days desc, doc.due_date asc
    ),
    '[]'::jsonb
  )
  into v_documents
  from (
    select *
    from public.osgb_required_documents
    where organization_id = v_link.organization_id
      and company_id = v_link.company_id
    order by delay_days desc, due_date asc nulls last
    limit 12
  ) doc;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', visit.id,
        'plannedAt', visit.planned_start_at,
        'completedAt', visit.actual_end_at,
        'status', visit.visit_status,
        'visitType', visit.visit_type,
        'serviceSummary', visit.service_summary,
        'nextActionSummary', visit.next_action_summary
      )
      order by visit.planned_start_at desc
    ),
    '[]'::jsonb
  )
  into v_visits
  from (
    select *
    from public.osgb_field_visits
    where organization_id = v_link.organization_id
      and company_id = v_link.company_id
    order by planned_start_at desc
    limit 8
  ) visit;

  select jsonb_build_object(
    'currentBalance', coalesce(account.current_balance, 0),
    'overdueBalance', coalesce(account.overdue_balance, 0),
    'collectionRiskScore', coalesce(account.collection_risk_score, 0),
    'profitabilityScore', coalesce(account.profitability_score, 0)
  )
  into v_finance
  from public.osgb_finance_accounts account
  where account.organization_id = v_link.organization_id
    and account.company_id = v_link.company_id
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', upload.id,
        'fileName', upload.file_name,
        'note', upload.note,
        'reviewStatus', upload.review_status,
        'reviewNote', upload.review_note,
        'submittedByName', upload.submitted_by_name,
        'submittedByEmail', upload.submitted_by_email,
        'createdAt', upload.created_at,
        'documentType', doc.document_type
      )
      order by upload.created_at desc
    ),
    '[]'::jsonb
  )
  into v_uploads
  from (
    select *
    from public.osgb_client_portal_uploads
    where organization_id = v_link.organization_id
      and company_id = v_link.company_id
    order by created_at desc
    limit 8
  ) upload
  left join public.osgb_required_documents doc on doc.id = upload.required_document_id;

  return jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_link.company_id,
      'companyName', v_link.company_name,
      'hazardClass', v_link.hazard_class,
      'employeeCount', coalesce(v_link.employee_count, 0)
    ),
    'meta', jsonb_build_object(
      'organizationName', coalesce(v_link.organization_name, 'OSGB'),
      'contactName', v_link.contact_name,
      'contactEmail', v_link.contact_email,
      'expiresAt', v_link.expires_at
    ),
    'documents', v_documents,
    'visits', v_visits,
    'finance', coalesce(v_finance, '{}'::jsonb),
    'uploads', v_uploads
  );
end;
$$;

grant execute on function public.get_osgb_client_portal_snapshot(text) to anon;
grant execute on function public.get_osgb_client_portal_snapshot(text) to authenticated;
