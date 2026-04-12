create index if not exists idx_inspections_user_created_at
on public.inspections(user_id, created_at desc);

create index if not exists idx_inspections_user_status_created_at
on public.inspections(user_id, status, created_at desc);
