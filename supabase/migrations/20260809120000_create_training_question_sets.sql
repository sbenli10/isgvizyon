create table if not exists public.training_question_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  organization_id uuid null references public.organizations(id) on delete set null,
  company_id uuid null references public.companies(id) on delete set null,
  sector text not null default 'Genel',
  difficulty text not null default 'Karışık',
  title text not null default 'İSG Eğitim Sınavı',
  exam_type text not null default 'Sonra',
  exam_date date null,
  employee_name text not null default '',
  employee_national_id text not null default '',
  questions jsonb not null default '[]'::jsonb,
  participants jsonb not null default '[]'::jsonb,
  source text not null default 'manual',
  status text not null default 'Taslak',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_question_sets_difficulty_check check (difficulty in ('Kolay', 'Orta', 'Zor', 'Karışık')),
  constraint training_question_sets_exam_type_check check (exam_type in ('Önce', 'Sonra')),
  constraint training_question_sets_status_check check (status in ('Taslak', 'Kaydedildi', 'PDF hazır'))
);

create index if not exists idx_training_question_sets_user
  on public.training_question_sets(user_id, updated_at desc);

create index if not exists idx_training_question_sets_org
  on public.training_question_sets(organization_id, updated_at desc);

create index if not exists idx_training_question_sets_company
  on public.training_question_sets(company_id, updated_at desc);

create or replace function public.set_training_question_sets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_training_question_sets_updated_at on public.training_question_sets;
create trigger set_training_question_sets_updated_at
before update on public.training_question_sets
for each row execute function public.set_training_question_sets_updated_at();

alter table public.training_question_sets enable row level security;

drop policy if exists "Training question sets are scoped to user or active workspace" on public.training_question_sets;
create policy "Training question sets are scoped to user or active workspace"
on public.training_question_sets
for all
to authenticated
using (
  user_id = auth.uid()
  or (
    organization_id is not null
    and public.is_organization_member(organization_id)
  )
)
with check (
  user_id = auth.uid()
  and (
    organization_id is null
    or public.is_organization_member(organization_id)
  )
);
