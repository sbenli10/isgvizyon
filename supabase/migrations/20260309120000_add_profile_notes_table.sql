-- Notebook feature for Profile page
create table if not exists public.profile_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  category text not null default 'Genel',
  content text not null,
  due_date date null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_notes_category_check check (
    category in ('Genel','İş','Toplantı','Acil','Görev','Hatırlat','Bilgi','Kişisel')
  )
);

create index if not exists idx_profile_notes_user_id on public.profile_notes(user_id);
create index if not exists idx_profile_notes_org_id on public.profile_notes(organization_id);
create index if not exists idx_profile_notes_company_id on public.profile_notes(company_id);
create index if not exists idx_profile_notes_due_date on public.profile_notes(due_date);
create index if not exists idx_profile_notes_completed on public.profile_notes(is_completed);
create index if not exists idx_profile_notes_created_at on public.profile_notes(created_at desc);

alter table public.profile_notes enable row level security;

create policy "Users can view own profile notes"
  on public.profile_notes
  for select
  using (user_id = auth.uid());

create policy "Users can insert own profile notes"
  on public.profile_notes
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own profile notes"
  on public.profile_notes
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own profile notes"
  on public.profile_notes
  for delete
  using (user_id = auth.uid());

-- Optional: keep updated_at current if helper trigger function exists
-- If your project already has update_updated_at_column(), this block safely attaches it.
do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'update_updated_at_column'
  ) then
    if not exists (
      select 1
      from pg_trigger
      where tgname = 'trg_profile_notes_updated_at'
    ) then
      create trigger trg_profile_notes_updated_at
      before update on public.profile_notes
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;
