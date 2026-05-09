/*
  Monetization matrix normalization

  Target model:
  - Free: all individual features are available with limited quotas, except ISGBot and OSGB module.
  - Premium: all individual features are unlimited, OSGB module remains locked.
  - OSGB: all individual and OSGB features are unlimited.
*/

with feature_matrix(feature_key, feature_group, feature_label, free_enabled, free_limit, free_period) as (
  values
    ('companies.count', 'Temel limitler', 'Firma limiti', true, 1, 'lifetime'),
    ('employees.count', 'Temel limitler', 'Çalışan limiti', true, 50, 'lifetime'),
    ('team.members', 'Ekip yönetimi', 'Ekip üyesi limiti', true, 1, 'lifetime'),
    ('storage.upload_mb_monthly', 'Depolama', 'Aylık dosya yükleme kotası (MB)', true, 500, 'monthly'),

    ('risk_assessments.count', 'İSG operasyonları', 'Risk değerlendirme kayıtları', true, 10, 'lifetime'),
    ('inspections.count_monthly', 'İSG operasyonları', 'Aylık saha denetimi', true, 20, 'monthly'),
    ('capa.count', 'İSG operasyonları', 'DÖF / CAPA kayıtları', true, 50, 'lifetime'),
    ('adep.count', 'İSG operasyonları', 'ADEP planları', true, 3, 'lifetime'),
    ('annual_plans.count', 'İSG operasyonları', 'Yıllık planlar', true, 3, 'lifetime'),
    ('board_meetings.count', 'İSG operasyonları', 'Kurul toplantısı kayıtları', true, 6, 'lifetime'),
    ('periodic_controls.count', 'İSG operasyonları', 'Periyodik kontrol kayıtları', true, 50, 'lifetime'),
    ('ppe.count', 'İSG operasyonları', 'KKD zimmet ve takip kayıtları', true, 250, 'lifetime'),
    ('health_surveillance.count', 'İSG operasyonları', 'Sağlık gözetimi kayıtları', true, 250, 'lifetime'),

    ('assignment_letters.count', 'Raporlama ve çıktı', 'Atama yazısı ve hazır formlar', true, 30, 'lifetime'),
    ('reports.export_monthly', 'Raporlama ve çıktı', 'Aylık rapor çıktısı', true, 15, 'monthly'),
    ('certificates.monthly', 'Raporlama ve çıktı', 'Sertifika / katılım belgesi üretimi', true, 10, 'monthly'),

    ('ai.risk_generation_monthly', 'Bireysel AI araçları', 'AI destekli risk üretimi', true, 15, 'monthly'),
    ('ai.bulk_capa_analysis_monthly', 'Bireysel AI araçları', 'AI toplu CAPA analizi', true, 10, 'monthly'),
    ('ai.nace_analysis_monthly', 'Bireysel AI araçları', 'AI NACE tehlike analizi', true, 15, 'monthly'),
    ('ai.evacuation_plan_monthly', 'Bireysel AI araçları', 'AI tahliye planı üretimi', true, 8, 'monthly'),
    ('ai.evacuation_image_monthly', 'Bireysel AI araçları', 'AI tahliye görseli üretimi', true, 8, 'monthly'),
    ('bulk_capa.access', 'Bireysel AI araçları', 'Toplu CAPA ve görsel uygunsuzluk analizi', true, 10, 'monthly'),
    ('blueprint_analyzer.access', 'Bireysel AI araçları', 'AI kroki / blueprint analizi', true, 10, 'monthly'),
    ('form_builder.access', 'Premium üretim araçları', 'Özel form oluşturucu', true, 10, 'monthly'),

    ('isg_bot.access', 'Kilitli modüller', 'ISGBot ve AI danışman asistanı', false, null, 'lifetime'),
    ('osgb.access', 'OSGB modülü', 'OSGB modülü ve çoklu firma operasyonları', false, null, 'lifetime')
),
expanded as (
  select
    plan_code,
    feature_key,
    case
      when plan_code = 'free' then free_enabled
      when plan_code = 'premium' then feature_key <> 'osgb.access'
      when plan_code = 'osgb' then true
      else false
    end as is_enabled,
    case
      when plan_code = 'free' then free_limit
      else null
    end as limit_value,
    case
      when plan_code = 'free' then free_period
      when plan_code in ('premium', 'osgb') and feature_key like '%.monthly' then 'monthly'
      else 'lifetime'
    end as period
  from feature_matrix
  cross join (values ('free'), ('premium'), ('osgb')) as plans(plan_code)
)
insert into public.plan_features (
  plan_code,
  feature_key,
  is_enabled,
  limit_value,
  period,
  updated_at
)
select
  plan_code,
  feature_key,
  is_enabled,
  limit_value,
  period,
  now()
from expanded
on conflict (plan_code, feature_key)
do update
set
  is_enabled = excluded.is_enabled,
  limit_value = excluded.limit_value,
  period = excluded.period,
  updated_at = now();

-- Keep plan table-level limits aligned with the same model for legacy reads.
update public.subscription_plans
set
  max_companies = case
    when coalesce(plan_code, code) = 'free' then 1
    when coalesce(plan_code, code) = 'premium' then null
    when coalesce(plan_code, code) = 'osgb' then null
    else max_companies
  end,
  max_employees = case
    when coalesce(plan_code, code) = 'free' then 250
    when coalesce(plan_code, code) = 'premium' then null
    when coalesce(plan_code, code) = 'osgb' then null
    else max_employees
  end,
  ai_risk_analysis = case
    when coalesce(plan_code, code) in ('free', 'premium', 'osgb') then true
    else ai_risk_analysis
  end,
  pdf_export = case
    when coalesce(plan_code, code) in ('free', 'premium', 'osgb') then true
    else pdf_export
  end,
  excel_export = case
    when coalesce(plan_code, code) = 'free' then false
    when coalesce(plan_code, code) in ('premium', 'osgb') then true
    else excel_export
  end,
  priority_support = case
    when coalesce(plan_code, code) = 'osgb' then true
    when coalesce(plan_code, code) = 'premium' then true
    when coalesce(plan_code, code) = 'free' then false
    else priority_support
  end,
  updated_at = now()
where coalesce(plan_code, code) in ('free', 'premium', 'osgb');

-- Quick verification query:
-- select plan_code, feature_key, is_enabled, limit_value, period
-- from public.plan_features
-- where plan_code in ('free', 'premium', 'osgb')
-- order by feature_key, plan_code;
