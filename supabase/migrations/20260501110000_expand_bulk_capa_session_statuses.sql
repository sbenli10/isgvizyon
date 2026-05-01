alter table if exists public.bulk_capa_sessions
  drop constraint if exists bulk_capa_sessions_status_check;

alter table if exists public.bulk_capa_sessions
  add constraint bulk_capa_sessions_status_check
  check (
    status in (
      'draft',
      'active',
      'archived',
      'sent',
      'processing',
      'completed',
      'failed'
    )
  );
