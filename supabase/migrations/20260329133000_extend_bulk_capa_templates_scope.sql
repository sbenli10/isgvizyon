alter table if exists public.bulk_capa_templates
  add column if not exists company_name text,
  add column if not exists template_scope text not null default 'general';

alter table if exists public.bulk_capa_templates
  drop constraint if exists bulk_capa_templates_scope_check;

alter table if exists public.bulk_capa_templates
  add constraint bulk_capa_templates_scope_check
  check (template_scope in ('general', 'item'));

create index if not exists bulk_capa_templates_org_scope_idx
  on public.bulk_capa_templates (org_id, template_scope, created_at desc);

create index if not exists bulk_capa_sessions_org_company_idx
  on public.bulk_capa_sessions (org_id, company_name, updated_at desc);
