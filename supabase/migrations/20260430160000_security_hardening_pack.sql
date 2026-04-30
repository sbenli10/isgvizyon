-- Security hardening pack
-- Goals:
-- 1) Enable/complete RLS on exposed public tables that were flagged.
-- 2) Reduce broad EXECUTE exposure on SECURITY DEFINER functions.
-- 3) Fix mutable search_path on privileged functions.
-- 4) Move sensitive values toward hash/encrypted shadow columns without breaking the app.
-- 5) Harden views and add baseline org policies for invite/join flows.
--
-- Notes:
-- - This migration is intentionally compatibility-first. Plaintext columns are not dropped here.
-- - Hashing uses pgcrypto and an optional pepper from `app.settings.hash_pepper`.
-- - Encryption uses an optional key from `app.settings.column_encryption_key`.
-- - If these settings are unset, hash columns still work and encrypted shadow columns stay null.
-- - Buckets that are currently used via `getPublicUrl()` are not force-switched to private here,
--   because that would require frontend signed URL refactors.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.app_hash_pepper()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(nullif(current_setting('app.settings.hash_pepper', true), ''), '')
$$;

create or replace function private.app_encryption_key()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(nullif(current_setting('app.settings.column_encryption_key', true), ''), '')
$$;

create or replace function private.normalize_text(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(btrim(coalesce(p_value, '')), '')
$$;

create or replace function private.normalize_email(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(lower(btrim(coalesce(p_value, ''))), '')
$$;

create or replace function private.normalize_identifier(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select nullif(regexp_replace(coalesce(p_value, ''), '\D', '', 'g'), '')
$$;

create or replace function private.hash_text_value(p_value text)
returns text
language sql
stable
set search_path = pg_catalog, private, extensions
as $$
  select case
    when private.normalize_text(p_value) is null then null
    else encode(
      extensions.digest(private.normalize_text(p_value) || private.app_hash_pepper(), 'sha256'::text),
      'hex'
    )
  end
$$;

create or replace function private.hash_email_value(p_value text)
returns text
language sql
stable
set search_path = pg_catalog, private, extensions
as $$
  select case
    when private.normalize_email(p_value) is null then null
    else encode(
      extensions.digest(private.normalize_email(p_value) || private.app_hash_pepper(), 'sha256'::text),
      'hex'
    )
  end
$$;

create or replace function private.hash_identifier_value(p_value text)
returns text
language sql
stable
set search_path = pg_catalog, private, extensions
as $$
  select case
    when private.normalize_identifier(p_value) is null then null
    else encode(
      extensions.digest(private.normalize_identifier(p_value) || private.app_hash_pepper(), 'sha256'::text),
      'hex'
    )
  end
$$;

create or replace function private.encrypt_text_value(p_value text)
returns bytea
language sql
stable
set search_path = pg_catalog, private, extensions
as $$
  select case
    when private.normalize_text(p_value) is null then null
    when private.app_encryption_key() = '' then null
    else extensions.pgp_sym_encrypt(private.normalize_text(p_value), private.app_encryption_key())
  end
$$;

-- ---------------------------------------------------------------------------
-- Sensitive shadow columns
-- ---------------------------------------------------------------------------

alter table if exists public.employees
  add column if not exists tc_number_hash text,
  add column if not exists email_hash text,
  add column if not exists phone_hash text,
  add column if not exists tc_number_encrypted bytea,
  add column if not exists email_encrypted bytea,
  add column if not exists phone_encrypted bytea;

alter table if exists public.companies
  add column if not exists tax_number_hash text,
  add column if not exists sgk_workplace_number_hash text,
  add column if not exists workplace_registration_number_hash text,
  add column if not exists email_hash text,
  add column if not exists phone_hash text,
  add column if not exists tax_number_encrypted bytea,
  add column if not exists sgk_workplace_number_encrypted bytea,
  add column if not exists workplace_registration_number_encrypted bytea,
  add column if not exists email_encrypted bytea,
  add column if not exists phone_encrypted bytea;

alter table if exists public.profiles
  add column if not exists email_hash text,
  add column if not exists phone_hash text,
  add column if not exists email_encrypted bytea,
  add column if not exists phone_encrypted bytea;

alter table if exists public.osgb_client_portal_links
  add column if not exists access_token_hash text,
  add column if not exists access_token_encrypted bytea;

alter table if exists public.user_sessions
  add column if not exists refresh_token_hash text,
  add column if not exists refresh_token_encrypted bytea;

create index if not exists idx_employees_tc_number_hash on public.employees (tc_number_hash);
create index if not exists idx_employees_email_hash on public.employees (email_hash);
create index if not exists idx_companies_tax_number_hash on public.companies (tax_number_hash);
create index if not exists idx_companies_sgk_workplace_number_hash on public.companies (sgk_workplace_number_hash);
create index if not exists idx_profiles_email_hash on public.profiles (email_hash);
create unique index if not exists idx_osgb_client_portal_links_access_token_hash
  on public.osgb_client_portal_links (access_token_hash)
  where access_token_hash is not null;
create index if not exists idx_user_sessions_refresh_token_hash on public.user_sessions (refresh_token_hash);

create or replace function public.apply_employee_security_shadows()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.tc_number_hash := private.hash_identifier_value(new.tc_number);
  new.email_hash := private.hash_email_value(new.email);
  new.phone_hash := private.hash_identifier_value(new.phone);
  new.tc_number_encrypted := private.encrypt_text_value(new.tc_number);
  new.email_encrypted := private.encrypt_text_value(new.email);
  new.phone_encrypted := private.encrypt_text_value(new.phone);
  return new;
end;
$$;

create or replace function public.apply_company_security_shadows()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.tax_number_hash := private.hash_identifier_value(new.tax_number);
  new.sgk_workplace_number_hash := private.hash_identifier_value(new.sgk_workplace_number);
  new.workplace_registration_number_hash := private.hash_identifier_value(new.workplace_registration_number);
  new.email_hash := private.hash_email_value(new.email);
  new.phone_hash := private.hash_identifier_value(new.phone);
  new.tax_number_encrypted := private.encrypt_text_value(new.tax_number);
  new.sgk_workplace_number_encrypted := private.encrypt_text_value(new.sgk_workplace_number);
  new.workplace_registration_number_encrypted := private.encrypt_text_value(new.workplace_registration_number);
  new.email_encrypted := private.encrypt_text_value(new.email);
  new.phone_encrypted := private.encrypt_text_value(new.phone);
  return new;
end;
$$;

create or replace function public.apply_profile_security_shadows()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.email_hash := private.hash_email_value(new.email);
  new.phone_hash := private.hash_identifier_value(new.phone);
  new.email_encrypted := private.encrypt_text_value(new.email);
  new.phone_encrypted := private.encrypt_text_value(new.phone);
  return new;
end;
$$;

create or replace function public.apply_portal_token_security_shadows()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.access_token_hash := private.hash_text_value(new.access_token);
  new.access_token_encrypted := private.encrypt_text_value(new.access_token);
  return new;
end;
$$;

create or replace function public.apply_user_session_security_shadows()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.refresh_token_hash := private.hash_text_value(new.refresh_token);
  new.refresh_token_encrypted := private.encrypt_text_value(new.refresh_token);
  return new;
end;
$$;

drop trigger if exists trg_employees_security_shadows on public.employees;
create trigger trg_employees_security_shadows
before insert or update of tc_number, email, phone
on public.employees
for each row
execute function public.apply_employee_security_shadows();

drop trigger if exists trg_companies_security_shadows on public.companies;
create trigger trg_companies_security_shadows
before insert or update of tax_number, sgk_workplace_number, workplace_registration_number, email, phone
on public.companies
for each row
execute function public.apply_company_security_shadows();

drop trigger if exists trg_profiles_security_shadows on public.profiles;
create trigger trg_profiles_security_shadows
before insert or update of email, phone
on public.profiles
for each row
execute function public.apply_profile_security_shadows();

drop trigger if exists trg_osgb_client_portal_links_security_shadows on public.osgb_client_portal_links;
create trigger trg_osgb_client_portal_links_security_shadows
before insert or update of access_token
on public.osgb_client_portal_links
for each row
execute function public.apply_portal_token_security_shadows();

drop trigger if exists trg_user_sessions_security_shadows on public.user_sessions;
create trigger trg_user_sessions_security_shadows
before insert or update of refresh_token
on public.user_sessions
for each row
execute function public.apply_user_session_security_shadows();

update public.employees
set
  tc_number_hash = private.hash_identifier_value(tc_number),
  email_hash = private.hash_email_value(email),
  phone_hash = private.hash_identifier_value(phone),
  tc_number_encrypted = private.encrypt_text_value(tc_number),
  email_encrypted = private.encrypt_text_value(email),
  phone_encrypted = private.encrypt_text_value(phone)
where true;

update public.companies
set
  tax_number_hash = private.hash_identifier_value(tax_number),
  sgk_workplace_number_hash = private.hash_identifier_value(sgk_workplace_number),
  workplace_registration_number_hash = private.hash_identifier_value(workplace_registration_number),
  email_hash = private.hash_email_value(email),
  phone_hash = private.hash_identifier_value(phone),
  tax_number_encrypted = private.encrypt_text_value(tax_number),
  sgk_workplace_number_encrypted = private.encrypt_text_value(sgk_workplace_number),
  workplace_registration_number_encrypted = private.encrypt_text_value(workplace_registration_number),
  email_encrypted = private.encrypt_text_value(email),
  phone_encrypted = private.encrypt_text_value(phone)
where true;

alter table if exists public.profiles disable trigger user;

update public.profiles
set
  email_hash = private.hash_email_value(email),
  phone_hash = private.hash_identifier_value(phone),
  email_encrypted = private.encrypt_text_value(email),
  phone_encrypted = private.encrypt_text_value(phone)
where true;

alter table if exists public.profiles enable trigger user;

update public.osgb_client_portal_links
set
  access_token_hash = private.hash_text_value(access_token),
  access_token_encrypted = private.encrypt_text_value(access_token)
where true;

update public.user_sessions
set
  refresh_token_hash = private.hash_text_value(refresh_token),
  refresh_token_encrypted = private.encrypt_text_value(refresh_token)
where true;

-- ---------------------------------------------------------------------------
-- RLS: enable on flagged public tables and add minimum-safe policies
-- ---------------------------------------------------------------------------

alter table if exists public.nace_hazard_library enable row level security;
alter table if exists public.isgkatip_companies_backup enable row level security;
alter table if exists public.safety_library enable row level security;
alter table if exists public.subscription_plans enable row level security;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'v_assessment_id'
  ) then
    execute 'alter table public.v_assessment_id enable row level security';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'v_company_id'
  ) then
    execute 'alter table public.v_company_id enable row level security';
  end if;
end $$;

drop policy if exists "Authenticated users can read nace hazard library" on public.nace_hazard_library;
create policy "Authenticated users can read nace hazard library"
on public.nace_hazard_library
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read safety library" on public.safety_library;
create policy "Authenticated users can read safety library"
on public.safety_library
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read active subscription plans" on public.subscription_plans;
create policy "Authenticated users can read active subscription plans"
on public.subscription_plans
for select
to authenticated
using (coalesce(is_active, false) = true);

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'isgkatip_companies_backup'
  ) then
    execute 'revoke all on public.isgkatip_companies_backup from public, anon, authenticated';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'v_assessment_id'
  ) then
    execute 'revoke all on public.v_assessment_id from public, anon, authenticated';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'v_company_id'
  ) then
    execute 'revoke all on public.v_company_id from public, anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Views: force invoker semantics where available
-- ---------------------------------------------------------------------------

do $$
declare
  v_name text;
begin
  foreach v_name in array array[
    'isgkatip_deleted_companies_view',
    'vw_compliance_dashboard',
    'v_dashboard_stats',
    'v_osgb_company_profitability',
    'isgkatip_active_companies',
    'v_recent_activities',
    'vw_expert_capacity',
    'v_risk_distribution'
  ]
  loop
    if exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v_name
        and c.relkind = 'v'
    ) then
      execute format('alter view public.%I set (security_invoker = true)', v_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Function hardening: fixed search_path
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'update_timestamp',
        'update_updated_at_column',
        'calculate_risk_class',
        'generate_risk_notifications',
        'restore_isgkatip_company',
        'permanently_delete_isgkatip_company',
        'generate_all_notifications',
        'update_company_compliance',
        'calculate_expert_capacity',
        'refresh_expert_capacity',
        'calculate_required_minutes',
        'auto_calculate_required_minutes',
        'sync_company_to_isgbot',
        'create_company_with_data',
        'soft_delete_isgkatip_company',
        'calculate_osgb_required_minutes',
        'generate_new_employee_notifications',
        'generate_finding_notifications',
        'generate_plan_review_notifications',
        'get_current_period_key',
        'slugify_text'
      ])
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, auth, extensions, pg_temp',
      rec.proname,
      rec.args
    );
  end loop;
end $$;

do $$
declare
  rec record;
begin
  revoke usage on schema private from public, anon, authenticated;

  for rec in
    select
      n.nspname,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  loop
    execute format(
      'revoke execute on function %I.%I(%s) from public, anon, authenticated',
      rec.nspname,
      rec.proname,
      rec.args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Function hardening: reduce broad execute grants on SECURITY DEFINER functions
-- ---------------------------------------------------------------------------

do $$
declare
  rec record;
begin
  for rec in
    select
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef = true
  loop
    execute format(
      'revoke execute on function public.%I(%s) from public, anon, authenticated',
      rec.proname,
      rec.args
    );
  end loop;
end $$;

do $$
declare
  rec record;
begin
  for rec in
    select
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'bootstrap_signup_organization',
        'bootstrap_signup_individual_profile',
        'create_workspace_organization',
        'create_organization_invite',
        'list_my_organization_invites',
        'list_organization_join_requests',
        'list_my_join_requests',
        'deactivate_organization_invite',
        'regenerate_organization_invite',
        'review_organization_join_request',
        'search_joinable_organizations',
        'submit_organization_join_request',
        'redeem_organization_invite',
        'get_my_billing_overview',
        'start_my_premium_trial',
        'backfill_my_feature_usage',
        'create_company_with_data',
        'soft_delete_isgkatip_company',
        'restore_isgkatip_company',
        'permanently_delete_isgkatip_company',
        'refresh_osgb_monthly_compliance',
        'get_osgb_company_tracking_page'
      ])
  loop
    execute format(
      'grant execute on function public.%I(%s) to authenticated',
      rec.proname,
      rec.args
    );
  end loop;

  for rec in
    select
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'get_osgb_client_portal_snapshot'
  loop
    execute format(
      'grant execute on function public.%I(%s) to authenticated, anon',
      rec.proname,
      rec.args
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Replace plaintext portal token lookup with hash-aware lookup
-- ---------------------------------------------------------------------------

create or replace function public.get_osgb_client_portal_snapshot(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_link record;
  v_documents jsonb := '[]'::jsonb;
  v_visits jsonb := '[]'::jsonb;
  v_finance jsonb := '{}'::jsonb;
  v_uploads jsonb := '[]'::jsonb;
  v_token_hash text := private.hash_text_value(p_token);
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
  where (
      (link.access_token_hash is not null and link.access_token_hash = v_token_hash)
      or link.access_token = p_token
    )
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

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'osgb_field_visits'
  ) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', visit.id,
          'visitType', visit.visit_type,
          'visitStatus', visit.visit_status,
          'plannedStartAt', visit.planned_start_at,
          'plannedEndAt', visit.planned_end_at,
          'serviceSummary', visit.service_summary,
          'nextActionSummary', visit.next_action_summary,
          'proofScore', visit.proof_score
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
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'osgb_finance_accounts'
  ) then
    select coalesce(
      jsonb_build_object(
        'currentBalance', acct.current_balance,
        'overdueBalance', acct.overdue_balance,
        'collectionRiskScore', acct.collection_risk_score,
        'profitabilityScore', acct.profitability_score,
        'lastInvoiceDate', acct.last_invoice_date,
        'lastCollectionDate', acct.last_collection_date
      ),
      '{}'::jsonb
    )
    into v_finance
    from public.osgb_finance_accounts acct
    where acct.organization_id = v_link.organization_id
      and acct.company_id = v_link.company_id
    limit 1;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'osgb_client_portal_uploads'
  ) then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', upload.id,
          'fileName', upload.file_name,
          'reviewStatus', upload.review_status,
          'note', upload.note,
          'submittedByName', upload.submitted_by_name,
          'submittedByEmail', upload.submitted_by_email,
          'createdAt', upload.created_at
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
      limit 12
    ) upload;
  end if;

  return jsonb_build_object(
    'link', jsonb_build_object(
      'id', v_link.id,
      'organizationId', v_link.organization_id,
      'organizationName', v_link.organization_name,
      'companyId', v_link.company_id,
      'companyName', v_link.company_name,
      'hazardClass', v_link.hazard_class,
      'employeeCount', v_link.employee_count,
      'contactName', v_link.contact_name,
      'contactEmail', v_link.contact_email,
      'portalStatus', v_link.portal_status,
      'expiresAt', v_link.expires_at
    ),
    'documents', v_documents,
    'visits', v_visits,
    'finance', v_finance,
    'uploads', v_uploads
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Invite / join-request policies (fix "RLS enabled, no policy")
-- ---------------------------------------------------------------------------

drop policy if exists "Org admins can view invites" on public.organization_invites;
create policy "Org admins can view invites"
on public.organization_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_invites.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists "Org admins can manage invites" on public.organization_invites;
create policy "Org admins can manage invites"
on public.organization_invites
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_invites.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_invites.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists "Users can view own join requests" on public.organization_join_requests;
create policy "Users can view own join requests"
on public.organization_join_requests
for select
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_join_requests.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists "Users can create own join requests" on public.organization_join_requests;
create policy "Users can create own join requests"
on public.organization_join_requests
for insert
to authenticated
with check (requester_id = auth.uid());

drop policy if exists "Users can update own join requests" on public.organization_join_requests;
create policy "Users can update own join requests"
on public.organization_join_requests
for update
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_join_requests.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
)
with check (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_join_requests.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

drop policy if exists "Users can delete own join requests" on public.organization_join_requests;
create policy "Users can delete own join requests"
on public.organization_join_requests
for delete
to authenticated
using (
  requester_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = organization_join_requests.organization_id
      and lower(coalesce(p.role, '')) = 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- Bucket metadata hardening that does not break existing public-url flows
-- ---------------------------------------------------------------------------
-- Buckets still using getPublicUrl() intentionally remain public here:
-- avatars, company-logos, reports, inspection-photos, risk-item-photos,
-- risk-assessment-signatures, document-analysis-files.
--
-- Once frontend is migrated to signed URLs, flip them with:
--   update storage.buckets set public = false where id in (...);
--
-- Buckets that are already private remain governed by storage.objects RLS.
