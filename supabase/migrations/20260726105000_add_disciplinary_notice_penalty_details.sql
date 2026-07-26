alter table public.disciplinary_notice_records
  add column if not exists wage_deduction_amount text not null default '',
  add column if not exists wage_deduction_day_count text not null default '',
  add column if not exists defense_period_business_days text not null default '';
