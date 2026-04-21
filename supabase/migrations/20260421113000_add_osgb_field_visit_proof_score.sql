alter table public.osgb_field_visits
  add column if not exists proof_score integer not null default 0;
