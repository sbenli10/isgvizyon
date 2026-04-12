alter table public.osgb_personnel
  add column if not exists certificate_expiry_date date,
  add column if not exists expertise_areas text[] not null default '{}';

create index if not exists idx_osgb_personnel_certificate_expiry
  on public.osgb_personnel(certificate_expiry_date);
