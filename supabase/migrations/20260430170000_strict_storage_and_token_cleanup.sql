-- STRICT CUTOVER MIGRATION
-- ---------------------------------------------------------------------------
-- Run this only after the frontend has been migrated away from getPublicUrl()
-- for the buckets below and after the OSGB portal admin UI no longer depends
-- on reading plaintext access_token values from public.osgb_client_portal_links.
--
-- Required app-side cutovers before running:
-- 1) Use signed URLs / createSignedUrl() for:
--    - document-analysis-files
--    - risk-assessment-signatures
--    - inspection-photos
--    - risk-item-photos
--    - reports
-- 2) Stop selecting plaintext access_token from osgb_client_portal_links.
-- 3) Stop depending on plaintext refresh_token in public.user_sessions.
--
-- Opt-in safety switch:
--   set local app.settings.allow_strict_storage_cutover = 'true';
-- Then run this migration.

do $$
begin
  if coalesce(current_setting('app.settings.allow_strict_storage_cutover', true), 'false') <> 'true' then
    raise exception
      'Strict storage/token cleanup is blocked. First deploy the signed URL and token-read refactor, then set app.settings.allow_strict_storage_cutover=true for this session.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage buckets: switch from public delivery to private delivery
-- ---------------------------------------------------------------------------

update storage.buckets
set public = false
where id in (
  'document-analysis-files',
  'risk-assessment-signatures',
  'inspection-photos',
  'risk-item-photos',
  'reports'
);

-- ---------------------------------------------------------------------------
-- Storage policies: tighten read access to owner/org scope
-- ---------------------------------------------------------------------------

-- Document analysis bucket: previous read policy allowed any authenticated user
-- to select any object in the bucket. Tighten to per-user folder ownership.
drop policy if exists "Document analysis files own read" on storage.objects;
create policy "Document analysis files own read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'document-analysis-files'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Risk assessment signatures: remove world-readable policy and require owner folder.
drop policy if exists "Risk assessment signatures are publicly readable" on storage.objects;
drop policy if exists "Risk assessment signatures own read" on storage.objects;
create policy "Risk assessment signatures own read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'risk-assessment-signatures'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Inspection/risk-item/reports already had scoped authenticated policies; once
-- the bucket is private those policies remain effective for signed URL access.

-- ---------------------------------------------------------------------------
-- Token cleanup: remove plaintext dependence after hash-based hardening
-- ---------------------------------------------------------------------------

-- OSGB client portal links
-- We keep the column for compatibility, but plaintext values are removed.
update public.osgb_client_portal_links
set access_token = null
where access_token is not null
  and access_token_hash is not null;

alter table public.osgb_client_portal_links
  alter column access_token drop not null;

drop index if exists idx_osgb_client_portal_links_token;

comment on column public.osgb_client_portal_links.access_token is
  'Deprecated plaintext token column. Strict cleanup nulls values after access_token_hash is populated.';

-- User sessions
update public.user_sessions
set refresh_token = null
where refresh_token is not null
  and refresh_token_hash is not null;

comment on column public.user_sessions.refresh_token is
  'Deprecated plaintext refresh token column. Strict cleanup nulls values after refresh_token_hash is populated.';

-- ---------------------------------------------------------------------------
-- Optional final lock-down on direct table reads of portal links
-- ---------------------------------------------------------------------------
-- Keep organization-member select policy for metadata, but plaintext token data is
-- now null, so direct reads can no longer leak live tokens.

-- ---------------------------------------------------------------------------
-- Post-cutover reminders
-- ---------------------------------------------------------------------------
-- 1) Rebuild generated TS types after this migration.
-- 2) Run end-to-end checks for:
--    - DocumentAnalysis file preview/download
--    - RiskAssessment signature preview/export
--    - Inspection photo preview
--    - Risk item photo preview
--    - Reports download/open
--    - OSGB client portal link creation/view flows

