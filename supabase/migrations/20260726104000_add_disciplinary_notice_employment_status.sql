alter table public.disciplinary_notice_records
  add column if not exists employment_status text not null default 'Kadrolu Çalışan',
  add column if not exists payroll_employer_title text not null default '',
  add column if not exists payroll_employer_registry_number text not null default '',
  add column if not exists payroll_employer_representative text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'disciplinary_notice_employment_status_check'
      and conrelid = 'public.disciplinary_notice_records'::regclass
  ) then
    alter table public.disciplinary_notice_records
      add constraint disciplinary_notice_employment_status_check
      check (employment_status in ('Kadrolu Çalışan', 'Alt İşveren (Taşeron) Çalışanı', 'Geçici Görevli Çalışan'));
  end if;
end;
$$;
