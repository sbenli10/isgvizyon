alter table public.isgkatip_companies
  add column if not exists osgb_document_profile jsonb not null default '{}'::jsonb,
  add column if not exists osgb_document_profile_updated_at timestamptz;

create index if not exists idx_isgkatip_companies_osgb_document_profile
  on public.isgkatip_companies using gin (osgb_document_profile)
  where coalesce(is_deleted, false) = false
    and coalesce(is_osgb_managed, false) = true;
