-- Normalizes Free / Premium / OSGB entitlement matrix.
-- Goal:
-- 1) Free users keep core modules with strict limits.
-- 2) Premium users get all premium/AI/productivity modules except OSGB operations.
-- 3) OSGB users inherit every Premium entitlement and additionally get OSGB operations.

alter table if exists public.subscription_plans
  add column if not exists code text,
  add column if not exists name text,
  add column if not exists description text,
  add column if not exists updated_at timestamptz not null default now();

update public.subscription_plans
set
  code = coalesce(code, plan_code),
  name = coalesce(name, plan_name),
  updated_at = now()
where plan_code in ('free', 'premium', 'osgb')
   or code in ('free', 'premium', 'osgb');

create unique index if not exists subscription_plans_code_unique_idx
  on public.subscription_plans (code)
  where code is not null;

insert into public.subscription_plans (
  plan_code,
  code,
  plan_name,
  name,
  description,
  price,
  currency,
  billing_period,
  is_active,
  max_companies,
  max_employees,
  ai_risk_analysis,
  pdf_export,
  excel_export,
  priority_support,
  updated_at
)
values
  (
    'free',
    'free',
    'Free',
    'Free',
    'Temel İSG kayıtları ve sınırlı kullanım için başlangıç planı.',
    0,
    'TRY',
    'monthly',
    true,
    1,
    50,
    false,
    true,
    false,
    false,
    now()
  ),
  (
    'premium',
    'premium',
    'Premium',
    'Premium',
    'AI destekli analiz, gelişmiş raporlama, çıktı üretimi ve profesyonel İSG araçları.',
    250,
    'TRY',
    'monthly',
    true,
    3,
    null,
    true,
    true,
    true,
    true,
    now()
  ),
  (
    'osgb',
    'osgb',
    'OSGB',
    'OSGB',
    'Premium özelliklerin tamamı ile birlikte çoklu firma, ekip, İSG-KATİP ve OSGB operasyon modülleri.',
    coalesce(
      (
        select sp.price
        from public.subscription_plans sp
        where sp.plan_code = 'osgb'
           or sp.code = 'osgb'
        limit 1
      ),
      (
        select sp.price
        from public.subscription_plans sp
        where sp.plan_code = 'premium'
           or sp.code = 'premium'
        limit 1
      ),
      0
    ),
    'TRY',
    'monthly',
    true,
    null,
    null,
    true,
    true,
    true,
    true,
    now()
  )
on conflict (plan_code) do update
set
  code = excluded.code,
  plan_name = excluded.plan_name,
  name = excluded.name,
  description = excluded.description,
  price = case
    when public.subscription_plans.plan_code = 'premium' then public.subscription_plans.price
    when public.subscription_plans.plan_code = 'osgb' then coalesce(public.subscription_plans.price, excluded.price)
    else excluded.price
  end,
  currency = coalesce(public.subscription_plans.currency, excluded.currency),
  billing_period = coalesce(public.subscription_plans.billing_period, excluded.billing_period),
  is_active = true,
  max_companies = excluded.max_companies,
  max_employees = excluded.max_employees,
  ai_risk_analysis = excluded.ai_risk_analysis,
  pdf_export = excluded.pdf_export,
  excel_export = excluded.excel_export,
  priority_support = excluded.priority_support,
  updated_at = now();

with desired_features(plan_code, feature_key, limit_value, is_enabled, period) as (
  values
    -- FREE: core usage with visible limits.
    ('free', 'companies.count', 1, true, 'lifetime'),
    ('free', 'employees.count', 50, true, 'lifetime'),
    ('free', 'risk_assessments.count', 3, true, 'lifetime'),
    ('free', 'inspections.count_monthly', 5, true, 'monthly'),
    ('free', 'capa.count', 10, true, 'lifetime'),
    ('free', 'bulk_capa.access', null, false, 'lifetime'),
    ('free', 'reports.export_monthly', 3, true, 'monthly'),
    ('free', 'ai.risk_generation_monthly', null, false, 'monthly'),
    ('free', 'ai.bulk_capa_analysis_monthly', null, false, 'monthly'),
    ('free', 'ai.nace_analysis_monthly', null, false, 'monthly'),
    ('free', 'ai.evacuation_plan_monthly', null, false, 'monthly'),
    ('free', 'ai.evacuation_image_monthly', null, false, 'monthly'),
    ('free', 'blueprint_analyzer.access', null, false, 'lifetime'),
    ('free', 'adep.count', 1, true, 'lifetime'),
    ('free', 'annual_plans.count', 1, true, 'lifetime'),
    ('free', 'periodic_controls.count', 10, true, 'lifetime'),
    ('free', 'ppe.count', 50, true, 'lifetime'),
    ('free', 'health_surveillance.count', 50, true, 'lifetime'),
    ('free', 'certificates.monthly', null, false, 'monthly'),
    ('free', 'isg_bot.access', null, false, 'lifetime'),
    ('free', 'form_builder.access', null, false, 'lifetime'),
    ('free', 'board_meetings.count', 2, true, 'lifetime'),
    ('free', 'assignment_letters.count', 10, true, 'lifetime'),
    ('free', 'osgb.access', null, false, 'lifetime'),
    ('free', 'storage.upload_mb_monthly', 100, true, 'monthly'),
    ('free', 'team.members', 1, true, 'lifetime'),

    -- PREMIUM: all individual/professional features. OSGB remains closed.
    ('premium', 'companies.count', 3, true, 'lifetime'),
    ('premium', 'employees.count', null, true, 'lifetime'),
    ('premium', 'risk_assessments.count', null, true, 'lifetime'),
    ('premium', 'inspections.count_monthly', null, true, 'monthly'),
    ('premium', 'capa.count', null, true, 'lifetime'),
    ('premium', 'bulk_capa.access', null, true, 'lifetime'),
    ('premium', 'reports.export_monthly', 100, true, 'monthly'),
    ('premium', 'ai.risk_generation_monthly', 100, true, 'monthly'),
    ('premium', 'ai.bulk_capa_analysis_monthly', 100, true, 'monthly'),
    ('premium', 'ai.nace_analysis_monthly', 100, true, 'monthly'),
    ('premium', 'ai.evacuation_plan_monthly', 50, true, 'monthly'),
    ('premium', 'ai.evacuation_image_monthly', 50, true, 'monthly'),
    ('premium', 'blueprint_analyzer.access', null, true, 'lifetime'),
    ('premium', 'adep.count', null, true, 'lifetime'),
    ('premium', 'annual_plans.count', null, true, 'lifetime'),
    ('premium', 'periodic_controls.count', null, true, 'lifetime'),
    ('premium', 'ppe.count', null, true, 'lifetime'),
    ('premium', 'health_surveillance.count', null, true, 'lifetime'),
    ('premium', 'certificates.monthly', 100, true, 'monthly'),
    ('premium', 'isg_bot.access', null, true, 'lifetime'),
    ('premium', 'form_builder.access', null, true, 'lifetime'),
    ('premium', 'board_meetings.count', null, true, 'lifetime'),
    ('premium', 'assignment_letters.count', null, true, 'lifetime'),
    ('premium', 'osgb.access', null, false, 'lifetime'),
    ('premium', 'storage.upload_mb_monthly', 2048, true, 'monthly'),
    ('premium', 'team.members', 3, true, 'lifetime'),

    -- OSGB: Premium + OSGB operations. Company, employee and team limits are unlimited.
    ('osgb', 'companies.count', null, true, 'lifetime'),
    ('osgb', 'employees.count', null, true, 'lifetime'),
    ('osgb', 'risk_assessments.count', null, true, 'lifetime'),
    ('osgb', 'inspections.count_monthly', null, true, 'monthly'),
    ('osgb', 'capa.count', null, true, 'lifetime'),
    ('osgb', 'bulk_capa.access', null, true, 'lifetime'),
    ('osgb', 'reports.export_monthly', null, true, 'monthly'),
    ('osgb', 'ai.risk_generation_monthly', null, true, 'monthly'),
    ('osgb', 'ai.bulk_capa_analysis_monthly', null, true, 'monthly'),
    ('osgb', 'ai.nace_analysis_monthly', null, true, 'monthly'),
    ('osgb', 'ai.evacuation_plan_monthly', null, true, 'monthly'),
    ('osgb', 'ai.evacuation_image_monthly', null, true, 'monthly'),
    ('osgb', 'blueprint_analyzer.access', null, true, 'lifetime'),
    ('osgb', 'adep.count', null, true, 'lifetime'),
    ('osgb', 'annual_plans.count', null, true, 'lifetime'),
    ('osgb', 'periodic_controls.count', null, true, 'lifetime'),
    ('osgb', 'ppe.count', null, true, 'lifetime'),
    ('osgb', 'health_surveillance.count', null, true, 'lifetime'),
    ('osgb', 'certificates.monthly', null, true, 'monthly'),
    ('osgb', 'isg_bot.access', null, true, 'lifetime'),
    ('osgb', 'form_builder.access', null, true, 'lifetime'),
    ('osgb', 'board_meetings.count', null, true, 'lifetime'),
    ('osgb', 'assignment_letters.count', null, true, 'lifetime'),
    ('osgb', 'osgb.access', null, true, 'lifetime'),
    ('osgb', 'storage.upload_mb_monthly', null, true, 'monthly'),
    ('osgb', 'team.members', null, true, 'lifetime')
)
insert into public.plan_features (plan_code, feature_key, limit_value, is_enabled, period)
select plan_code, feature_key, limit_value, is_enabled, period
from desired_features
on conflict (plan_code, feature_key) do update
set
  limit_value = excluded.limit_value,
  is_enabled = excluded.is_enabled,
  period = excluded.period,
  updated_at = now();

create or replace view public.v_plan_feature_access_matrix as
with feature_catalog(feature_key, feature_label, feature_group) as (
  values
    ('companies.count', 'Firma limiti', 'Temel limitler'),
    ('employees.count', 'Çalışan limiti', 'Temel limitler'),
    ('risk_assessments.count', 'Risk değerlendirme kayıtları', 'İSG operasyonları'),
    ('inspections.count_monthly', 'Aylık saha denetimi', 'İSG operasyonları'),
    ('capa.count', 'DÖF / CAPA kayıtları', 'İSG operasyonları'),
    ('bulk_capa.access', 'Toplu CAPA ve görsel uygunsuzluk analizi', 'Premium AI araçları'),
    ('reports.export_monthly', 'Aylık rapor çıktısı', 'Raporlama ve çıktı'),
    ('ai.risk_generation_monthly', 'AI destekli risk üretimi', 'Premium AI araçları'),
    ('ai.bulk_capa_analysis_monthly', 'AI toplu CAPA analizi', 'Premium AI araçları'),
    ('ai.nace_analysis_monthly', 'AI NACE tehlike analizi', 'Premium AI araçları'),
    ('ai.evacuation_plan_monthly', 'AI tahliye planı üretimi', 'Premium AI araçları'),
    ('ai.evacuation_image_monthly', 'AI tahliye görseli üretimi', 'Premium AI araçları'),
    ('blueprint_analyzer.access', 'AI kroki / blueprint analizi', 'Premium AI araçları'),
    ('adep.count', 'ADEP planları', 'İSG operasyonları'),
    ('annual_plans.count', 'Yıllık planlar', 'İSG operasyonları'),
    ('periodic_controls.count', 'Periyodik kontrol kayıtları', 'İSG operasyonları'),
    ('ppe.count', 'KKD zimmet ve takip kayıtları', 'İSG operasyonları'),
    ('health_surveillance.count', 'Sağlık gözetimi kayıtları', 'İSG operasyonları'),
    ('certificates.monthly', 'Sertifika / katılım belgesi üretimi', 'Raporlama ve çıktı'),
    ('isg_bot.access', 'ISGBot ve AI danışman asistanı', 'Premium AI araçları'),
    ('form_builder.access', 'Özel form oluşturucu', 'Premium üretim araçları'),
    ('board_meetings.count', 'Kurul toplantısı kayıtları', 'İSG operasyonları'),
    ('assignment_letters.count', 'Atama yazısı ve hazır formlar', 'Raporlama ve çıktı'),
    ('osgb.access', 'OSGB modülü ve çoklu firma operasyonları', 'OSGB modülü'),
    ('storage.upload_mb_monthly', 'Aylık dosya yükleme kotası (MB)', 'Depolama'),
    ('team.members', 'Ekip üyesi limiti', 'Ekip yönetimi')
)
select
  pf.plan_code,
  coalesce(sp.name, sp.plan_name, initcap(pf.plan_code)) as plan_name,
  pf.feature_key,
  coalesce(fc.feature_label, pf.feature_key) as feature_label,
  coalesce(fc.feature_group, 'Diğer') as feature_group,
  pf.is_enabled,
  pf.limit_value,
  pf.period,
  case
    when pf.is_enabled = false then 'Kapalı'
    when pf.limit_value is null then 'Sınırsız / açık'
    when pf.period = 'monthly' then pf.limit_value::text || ' / ay'
    when pf.period = 'lifetime' then pf.limit_value::text || ' toplam'
    else pf.limit_value::text
  end as access_summary,
  case
    when pf.plan_code = 'free' then 1
    when pf.plan_code = 'premium' then 2
    when pf.plan_code = 'osgb' then 3
    else 99
  end as plan_sort
from public.plan_features pf
left join public.subscription_plans sp
  on sp.plan_code = pf.plan_code
  or sp.code = pf.plan_code
left join feature_catalog fc
  on fc.feature_key = pf.feature_key
where pf.plan_code in ('free', 'premium', 'osgb');

grant select on public.v_plan_feature_access_matrix to authenticated;

-- Verification queries:
-- select plan_name, feature_group, feature_label, access_summary
-- from public.v_plan_feature_access_matrix
-- order by plan_sort, feature_group, feature_label;
--
-- select plan_code, count(*) filter (where is_enabled) as enabled_features, count(*) filter (where not is_enabled) as disabled_features
-- from public.v_plan_feature_access_matrix
-- group by plan_code, plan_sort
-- order by plan_sort;
--
-- select *
-- from public.v_plan_feature_access_matrix
-- where feature_key in ('osgb.access', 'isg_bot.access', 'bulk_capa.access', 'blueprint_analyzer.access')
-- order by plan_sort, feature_key;
