-- Keep the company manager edit form aligned with the persisted company record.
alter table public.companies
  add column if not exists city text,
  add column if not exists industry_sector text;

