alter table public.osgb_company_employees
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists position text,
  add column if not exists birth_date date,
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists training_date date,
  add column if not exists periodic_exam_date date,
  add column if not exists upper_body_size text,
  add column if not exists shoe_size text,
  add column if not exists training_topic text,
  add column if not exists occupation text,
  add column if not exists notes text;

update public.osgb_company_employees
set
  first_name = coalesce(first_name, nullif(split_part(full_name, ' ', 1), '')),
  last_name = coalesce(
    last_name,
    nullif(trim(regexp_replace(full_name, '^\S+\s*', '')), '')
  ),
  position = coalesce(position, job_title)
where first_name is null
   or last_name is null
   or position is null;

create unique index if not exists idx_osgb_company_employees_active_company_tc
  on public.osgb_company_employees(company_id, tc_number)
  where is_active = true and tc_number is not null;

create index if not exists idx_osgb_company_employees_active_company_name
  on public.osgb_company_employees(company_id, is_active, full_name);
