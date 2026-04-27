create table if not exists public.document_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  company_name text,
  title text not null,
  document_type text not null
    check (document_type in ('legislation', 'internal_procedure', 'technical_instruction', 'official_letter', 'contractual_obligation')),
  source_file_name text not null,
  source_file_url text,
  source_file_path text,
  mime_type text,
  file_size_bytes bigint,
  raw_text text,
  summary text not null default '',
  key_obligations_json jsonb not null default '[]'::jsonb,
  critical_points_json jsonb not null default '[]'::jsonb,
  action_items_json jsonb not null default '[]'::jsonb,
  risk_notes_json jsonb not null default '[]'::jsonb,
  archived_to_library boolean not null default false,
  last_exported_at timestamptz,
  status text not null default 'completed'
    check (status in ('draft', 'processing', 'completed', 'archived', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_analysis_actions (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.document_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  action_type text not null
    check (action_type in ('capa', 'inspection', 'archive', 'report')),
  target_id text,
  target_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_analyses_user_created
  on public.document_analyses(user_id, created_at desc);

create index if not exists idx_document_analyses_company_created
  on public.document_analyses(company_id, created_at desc);

create index if not exists idx_document_analysis_actions_analysis_created
  on public.document_analysis_actions(analysis_id, created_at desc);

alter table public.document_analyses enable row level security;
alter table public.document_analysis_actions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_analyses'
      and policyname = 'Document analyses own select'
  ) then
    create policy "Document analyses own select"
      on public.document_analyses
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_analyses'
      and policyname = 'Document analyses own insert'
  ) then
    create policy "Document analyses own insert"
      on public.document_analyses
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_analyses'
      and policyname = 'Document analyses own update'
  ) then
    create policy "Document analyses own update"
      on public.document_analyses
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_analyses'
      and policyname = 'Document analyses own delete'
  ) then
    create policy "Document analyses own delete"
      on public.document_analyses
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_analysis_actions'
      and policyname = 'Document analysis actions own select'
  ) then
    create policy "Document analysis actions own select"
      on public.document_analysis_actions
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'document_analysis_actions'
      and policyname = 'Document analysis actions own insert'
  ) then
    create policy "Document analysis actions own insert"
      on public.document_analysis_actions
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end
$$;

insert into storage.buckets (id, name, public)
select 'document-analysis-files', 'document-analysis-files', true
where not exists (
  select 1 from storage.buckets where id = 'document-analysis-files'
);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Document analysis files own read'
  ) then
    create policy "Document analysis files own read"
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'document-analysis-files');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Document analysis files own upload'
  ) then
    create policy "Document analysis files own upload"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'document-analysis-files'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Document analysis files own update'
  ) then
    create policy "Document analysis files own update"
      on storage.objects
      for update
      to authenticated
      using (
        bucket_id = 'document-analysis-files'
        and split_part(name, '/', 1) = auth.uid()::text
      )
      with check (
        bucket_id = 'document-analysis-files'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Document analysis files own delete'
  ) then
    create policy "Document analysis files own delete"
      on storage.objects
      for delete
      to authenticated
      using (
        bucket_id = 'document-analysis-files'
        and split_part(name, '/', 1) = auth.uid()::text
      );
  end if;
end
$$;
