create table if not exists public.assignment_letter_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  institution_title text not null default 'T.C.',
  institution_subtitle text null,
  document_code text not null default 'ISG-BLG-ATM',
  publish_number text not null default 'Yayin 00',
  revision_date date null,
  left_signature_name text not null default 'Isveren / Isveren Vekili',
  left_signature_title text null,
  right_signature_name text null,
  right_signature_title text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_assignment_letter_settings_user_id
  on public.assignment_letter_settings(user_id);

create index if not exists idx_assignment_letter_settings_org_id
  on public.assignment_letter_settings(organization_id);

alter table public.assignment_letter_settings enable row level security;

create policy "Users can view own assignment letter settings"
  on public.assignment_letter_settings
  for select
  using (user_id = auth.uid());

create policy "Users can insert own assignment letter settings"
  on public.assignment_letter_settings
  for insert
  with check (user_id = auth.uid());

create policy "Users can update own assignment letter settings"
  on public.assignment_letter_settings
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete own assignment letter settings"
  on public.assignment_letter_settings
  for delete
  using (user_id = auth.uid());

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
      where tgname = 'trg_assignment_letter_settings_updated_at'
    ) then
      create trigger trg_assignment_letter_settings_updated_at
      before update on public.assignment_letter_settings
      for each row execute function public.update_updated_at_column();
    end if;
  end if;
end $$;
