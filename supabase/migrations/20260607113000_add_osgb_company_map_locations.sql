alter table public.isgkatip_companies
  add column if not exists osgb_visit_address text,
  add column if not exists osgb_location_lat numeric(10,7),
  add column if not exists osgb_location_lng numeric(10,7),
  add column if not exists osgb_location_source text,
  add column if not exists osgb_location_updated_at timestamptz;

create index if not exists idx_isgkatip_companies_osgb_location
  on public.isgkatip_companies(org_id, osgb_location_lat, osgb_location_lng)
  where osgb_location_lat is not null
    and osgb_location_lng is not null
    and coalesce(is_deleted, false) = false
    and coalesce(is_osgb_managed, false) = true;

create index if not exists idx_isgkatip_companies_osgb_address
  on public.isgkatip_companies(org_id)
  where osgb_visit_address is not null
    and btrim(osgb_visit_address) <> ''
    and coalesce(is_deleted, false) = false
    and coalesce(is_osgb_managed, false) = true;
