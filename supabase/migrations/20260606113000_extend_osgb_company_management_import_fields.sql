alter table public.isgkatip_companies
  add column if not exists branch_name text,
  add column if not exists assignment_approval_status text,
  add column if not exists is_osgb_managed boolean not null default false,
  add column if not exists management_source text not null default 'extension',
  add column if not exists tax_number text,
  add column if not exists address text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists contact_name text,
  add column if not exists assignment_mode text not null default 'automatic',
  add column if not exists visit_frequency text not null default 'monthly_once',
  add column if not exists notes text,
  add column if not exists managed_at timestamptz;

create index if not exists idx_isgkatip_companies_org_sgk
  on public.isgkatip_companies(org_id, sgk_no);

create index if not exists idx_isgkatip_companies_org_osgb_active
  on public.isgkatip_companies(org_id, is_osgb_managed, is_deleted, company_name);
