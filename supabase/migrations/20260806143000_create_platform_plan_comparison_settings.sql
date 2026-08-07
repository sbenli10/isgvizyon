create table if not exists public.platform_plan_comparison_rows (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  feature_label text not null,
  free_value text not null default 'Yok',
  premium_value text not null default 'Yok',
  osgb_value text not null default 'Yok',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.platform_runtime_settings (
  setting_key text primary key,
  setting_value jsonb not null default '{}'::jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_plan_comparison_rows enable row level security;
alter table public.platform_runtime_settings enable row level security;

drop policy if exists "Anyone can read active platform plan comparison rows" on public.platform_plan_comparison_rows;
create policy "Anyone can read active platform plan comparison rows"
on public.platform_plan_comparison_rows
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Platform admins can manage platform plan comparison rows" on public.platform_plan_comparison_rows;
create policy "Platform admins can manage platform plan comparison rows"
on public.platform_plan_comparison_rows
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

drop policy if exists "Anyone can read public runtime settings" on public.platform_runtime_settings;
create policy "Anyone can read public runtime settings"
on public.platform_runtime_settings
for select
to anon, authenticated
using (setting_key in ('osgb_demo'));

drop policy if exists "Platform admins can manage runtime settings" on public.platform_runtime_settings;
create policy "Platform admins can manage runtime settings"
on public.platform_runtime_settings
for all
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create or replace function public.touch_platform_plan_comparison_rows_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_platform_plan_comparison_rows_updated_at on public.platform_plan_comparison_rows;
create trigger trg_platform_plan_comparison_rows_updated_at
before update on public.platform_plan_comparison_rows
for each row execute function public.touch_platform_plan_comparison_rows_updated_at();

create or replace function public.touch_platform_runtime_settings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_platform_runtime_settings_updated_at on public.platform_runtime_settings;
create trigger trg_platform_runtime_settings_updated_at
before update on public.platform_runtime_settings
for each row execute function public.touch_platform_runtime_settings_updated_at();

insert into public.platform_runtime_settings (setting_key, setting_value, description)
values (
  'osgb_demo',
  jsonb_build_object(
    'duration_days', 30,
    'title', 'OSGB Demo Üyelik',
    'description', 'Demo süresince OSGB modülü ve platform özellikleri kullanılabilir.'
  ),
  'OSGB demo üyeliği süre ve metin ayarları.'
)
on conflict (setting_key) do nothing;

with rows(feature_key, feature_label, free_value, premium_value, osgb_value, sort_order) as (
  values
    ('companies.count', 'Firma limiti', '1 firma', '3 firma', 'Sınırsız', 10),
    ('employees.count', 'Çalışan limiti', '50 çalışan', 'Sınırsız', 'Sınırsız', 20),
    ('team.members', 'Ekip üyesi limiti', '1 kişi', '3 kişi', 'Sınırsız', 30),
    ('storage.upload_mb_monthly', 'Aylık dosya yükleme kotası', '100 MB / ay', '2048 MB / ay', 'Sınırsız', 40),
    ('risk_assessments.count', 'Risk değerlendirme kayıtları', '3 toplam', 'Sınırsız', 'Sınırsız', 50),
    ('inspections.count_monthly', 'Aylık saha denetimi', '5 / ay', 'Sınırsız', 'Sınırsız', 60),
    ('capa.count', 'DÖF / CAPA kayıtları', '10 toplam', 'Sınırsız', 'Sınırsız', 70),
    ('adep.count', 'ADEP planları', '1 toplam', 'Sınırsız', 'Sınırsız', 80),
    ('annual_plans.count', 'Yıllık planlar', '1 toplam', 'Sınırsız', 'Sınırsız', 90),
    ('board_meetings.count', 'Kurul toplantısı kayıtları', '2 toplam', 'Sınırsız', 'Sınırsız', 100),
    ('periodic_controls.count', 'Periyodik kontrol kayıtları', '10 toplam', 'Sınırsız', 'Sınırsız', 110),
    ('ppe.count', 'KKD zimmet ve takip kayıtları', '50 toplam', 'Sınırsız', 'Sınırsız', 120),
    ('health_surveillance.count', 'Sağlık gözetimi kayıtları', '50 toplam', 'Sınırsız', 'Sınırsız', 130),
    ('assignment_letters.count', 'Atama yazısı ve hazır formlar', '10 toplam', 'Sınırsız', 'Sınırsız', 140),
    ('reports.export_monthly', 'Aylık rapor çıktısı', '3 / ay', '100 / ay', 'Sınırsız', 150),
    ('certificates.monthly', 'Sertifika / katılım belgesi üretimi', 'Yok', '100 / ay', 'Sınırsız', 160),
    ('ai.risk_generation_monthly', 'AI destekli risk üretimi', 'Yok', '100 / ay', 'Sınırsız', 170),
    ('ai.bulk_capa_analysis_monthly', 'AI toplu CAPA analizi', 'Yok', '100 / ay', 'Sınırsız', 180),
    ('ai.nace_analysis_monthly', 'AI NACE tehlike analizi', 'Yok', '100 / ay', 'Sınırsız', 190),
    ('ai.evacuation_plan_monthly', 'AI tahliye planı üretimi', 'Yok', '50 / ay', 'Sınırsız', 200),
    ('ai.evacuation_image_monthly', 'AI tahliye görseli üretimi', 'Yok', '50 / ay', 'Sınırsız', 210),
    ('bulk_capa.access', 'Toplu CAPA ve görsel uygunsuzluk analizi', 'Yok', 'Var', 'Var', 220),
    ('blueprint_analyzer.access', 'AI kroki / blueprint analizi', 'Yok', 'Var', 'Var', 230),
    ('isg_bot.access', 'ISGBot ve AI danışman asistanı', 'Yok', 'Var', 'Var', 240),
    ('form_builder.access', 'Özel form oluşturucu', 'Yok', 'Var', 'Var', 250),
    ('osgb.access', 'OSGB modülü ve çoklu firma operasyonları', 'Yok', 'Yok', 'Var', 260),
    ('osgb.dashboard', 'OSGB dashboard, kapasite, finans ve görev takibi', 'Yok', 'Yok', 'Var', 270),
    ('osgb.isgkatip_portal', 'İSG-KATİP merkezi ve müşteri portalı', 'Yok', 'Yok', 'Var', 280)
)
insert into public.platform_plan_comparison_rows (
  feature_key,
  feature_label,
  free_value,
  premium_value,
  osgb_value,
  sort_order
)
select feature_key, feature_label, free_value, premium_value, osgb_value, sort_order
from rows
on conflict (feature_key) do nothing;

create or replace function public.get_platform_admin_plan_configuration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'demo', coalesce(
      (select setting_value from public.platform_runtime_settings where setting_key = 'osgb_demo'),
      jsonb_build_object('duration_days', 30)
    ),
    'comparisonRows', coalesce(
      (
        select jsonb_agg(to_jsonb(row_item) order by row_item.sort_order)
        from (
          select
            id,
            feature_key,
            feature_label,
            free_value,
            premium_value,
            osgb_value,
            sort_order,
            is_active,
            updated_at
          from public.platform_plan_comparison_rows
        ) row_item
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.update_platform_admin_demo_settings(
  p_duration_days integer,
  p_title text default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := coalesce(p_duration_days, 30);
  v_value jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if v_days < 1 or v_days > 365 then
    raise exception 'Demo süresi 1 ile 365 gün arasında olmalıdır.';
  end if;

  v_value := jsonb_build_object(
    'duration_days', v_days,
    'title', coalesce(nullif(trim(p_title), ''), 'OSGB Demo Üyelik'),
    'description', coalesce(nullif(trim(p_description), ''), 'Demo süresince OSGB modülü ve platform özellikleri kullanılabilir.')
  );

  insert into public.platform_runtime_settings (setting_key, setting_value, description, updated_by)
  values ('osgb_demo', v_value, 'OSGB demo üyeliği süre ve metin ayarları.', auth.uid())
  on conflict (setting_key) do update
  set
    setting_value = excluded.setting_value,
    description = excluded.description,
    updated_at = now(),
    updated_by = auth.uid();

  return v_value;
end;
$$;

create or replace function public.upsert_platform_admin_plan_comparison_rows(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Rows payload must be an array.';
  end if;

  with payload as (
    select
      coalesce(nullif(trim(item->>'feature_key'), ''), 'custom.' || gen_random_uuid()::text) as feature_key,
      coalesce(nullif(trim(item->>'feature_label'), ''), 'Yeni özellik') as feature_label,
      coalesce(nullif(trim(item->>'free_value'), ''), 'Yok') as free_value,
      coalesce(nullif(trim(item->>'premium_value'), ''), 'Yok') as premium_value,
      coalesce(nullif(trim(item->>'osgb_value'), ''), 'Yok') as osgb_value,
      coalesce((item->>'sort_order')::integer, row_number() over () * 10) as sort_order,
      coalesce((item->>'is_active')::boolean, true) as is_active
    from jsonb_array_elements(p_rows) as item
  )
  insert into public.platform_plan_comparison_rows (
    feature_key,
    feature_label,
    free_value,
    premium_value,
    osgb_value,
    sort_order,
    is_active,
    updated_by
  )
  select
    feature_key,
    feature_label,
    free_value,
    premium_value,
    osgb_value,
    sort_order,
    is_active,
    auth.uid()
  from payload
  on conflict (feature_key) do update
  set
    feature_label = excluded.feature_label,
    free_value = excluded.free_value,
    premium_value = excluded.premium_value,
    osgb_value = excluded.osgb_value,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now(),
    updated_by = auth.uid();

  select coalesce(
    jsonb_agg(to_jsonb(row_item) order by row_item.sort_order),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      id,
      feature_key,
      feature_label,
      free_value,
      premium_value,
      osgb_value,
      sort_order,
      is_active,
      updated_at
    from public.platform_plan_comparison_rows
  ) row_item;

  return v_result;
end;
$$;

create or replace function public.start_osgb_demo_subscription(
  p_user_id uuid,
  p_organization_id uuid default null
)
returns public.user_demo_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_demo public.user_demo_subscriptions%rowtype;
  v_actor uuid := auth.uid();
  v_role text := auth.role();
  v_profile public.profiles%rowtype;
  v_effective_org_id uuid;
  v_has_active_paid_subscription boolean := false;
  v_demo_days integer := 30;
begin
  if v_actor is null and coalesce(v_role, '') <> 'service_role' then
    raise exception 'Not authenticated';
  end if;

  if coalesce(v_role, '') <> 'service_role' and v_actor <> p_user_id then
    raise exception 'Kendi adınız dışında demo üyelik başlatamazsınız.';
  end if;

  if p_user_id is null then
    raise exception 'Kullanıcı bilgisi zorunludur.';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = p_user_id;

  v_effective_org_id := coalesce(p_organization_id, v_profile.organization_id);

  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and lower(coalesce(p.subscription_plan, 'free')) in ('premium', 'osgb')
      and lower(coalesce(p.subscription_status, 'free')) in ('active', 'premium')
  )
  or exists (
    select 1
    from public.organization_subscriptions os
    where os.org_id = v_effective_org_id
      and lower(coalesce(os.plan_code, 'free')) in ('premium', 'osgb')
      and lower(coalesce(os.status, '')) = 'active'
      and (os.ends_at is null or os.ends_at > now())
  )
  into v_has_active_paid_subscription;

  if v_has_active_paid_subscription then
    raise exception 'Aktif üyeliği olan kullanıcı demo başlatamaz.';
  end if;

  select coalesce((setting_value->>'duration_days')::integer, 30)
  into v_demo_days
  from public.platform_runtime_settings
  where setting_key = 'osgb_demo';

  v_demo_days := greatest(1, least(365, coalesce(v_demo_days, 30)));

  select *
  into v_demo
  from public.user_demo_subscriptions
  where user_id = p_user_id
    and demo_type = 'osgb_full_demo'
  for update;

  if found then
    return v_demo;
  end if;

  insert into public.user_demo_subscriptions (
    user_id,
    organization_id,
    demo_type,
    status,
    started_at,
    ends_at,
    activated_by
  ) values (
    p_user_id,
    v_effective_org_id,
    'osgb_full_demo',
    'active',
    now(),
    now() + make_interval(days => v_demo_days),
    coalesce(v_actor, p_user_id)
  )
  returning * into v_demo;

  return v_demo;
end;
$$;

revoke all on function public.get_platform_admin_plan_configuration() from public;
revoke all on function public.get_platform_admin_plan_configuration() from anon;
grant execute on function public.get_platform_admin_plan_configuration() to authenticated;

revoke all on function public.update_platform_admin_demo_settings(integer, text, text) from public;
revoke all on function public.update_platform_admin_demo_settings(integer, text, text) from anon;
grant execute on function public.update_platform_admin_demo_settings(integer, text, text) to authenticated;

revoke all on function public.upsert_platform_admin_plan_comparison_rows(jsonb) from public;
revoke all on function public.upsert_platform_admin_plan_comparison_rows(jsonb) from anon;
grant execute on function public.upsert_platform_admin_plan_comparison_rows(jsonb) to authenticated;

grant execute on function public.start_osgb_demo_subscription(uuid, uuid) to authenticated;
grant execute on function public.start_osgb_demo_subscription(uuid, uuid) to service_role;
