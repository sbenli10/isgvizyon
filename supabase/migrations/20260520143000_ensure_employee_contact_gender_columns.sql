-- Ensure company employee edit fields can be saved even on older databases.
alter table public.employees
  add column if not exists phone text,
  add column if not exists gender text;

