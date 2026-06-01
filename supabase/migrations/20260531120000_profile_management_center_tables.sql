create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid null,
  title text not null,
  starts_at date,
  ends_at date,
  valid_until date,
  duration text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_participants (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings(id) on delete cascade,
  employee_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid not null,
  document_type text not null,
  document_name text not null,
  report_date date,
  valid_until date,
  notes text,
  file_url text,
  status text not null default 'valid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid,
  title text not null,
  follow_up_type text,
  due_date date,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_risk_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid null,
  sector_key text,
  category text,
  activity text,
  hazard_source text,
  risk_description text not null,
  current_measures text,
  probability int,
  severity int,
  risk_score int,
  risk_level text,
  additional_measures text,
  responsible text,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.company_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid null,
  company_id uuid,
  visit_date date not null default current_date,
  visit_time time,
  visit_type text,
  notes text,
  next_visit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trainings enable row level security;
alter table public.training_participants enable row level security;
alter table public.company_documents enable row level security;
alter table public.company_follow_ups enable row level security;
alter table public.saved_risk_items enable row level security;
alter table public.company_visits enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trainings' and policyname = 'Users manage own trainings') then
    create policy "Users manage own trainings" on public.trainings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'training_participants' and policyname = 'Users manage participants through own trainings') then
    create policy "Users manage participants through own trainings" on public.training_participants for all
      using (exists (select 1 from public.trainings t where t.id = training_id and t.user_id = auth.uid()))
      with check (exists (select 1 from public.trainings t where t.id = training_id and t.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_documents' and policyname = 'Users manage own company documents') then
    create policy "Users manage own company documents" on public.company_documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_follow_ups' and policyname = 'Users manage own company follow ups') then
    create policy "Users manage own company follow ups" on public.company_follow_ups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'saved_risk_items' and policyname = 'Users manage own saved risks') then
    create policy "Users manage own saved risks" on public.saved_risk_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'company_visits' and policyname = 'Users manage own company visits') then
    create policy "Users manage own company visits" on public.company_visits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
