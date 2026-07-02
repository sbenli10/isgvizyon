alter table public.saved_risk_items
  add column if not exists folder_name text;

create index if not exists idx_saved_risk_items_user_folder_active
  on public.saved_risk_items(user_id, folder_name, is_active, created_at desc)
  where folder_name is not null;
