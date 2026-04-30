create or replace function public.sync_company_to_isgbot()
returns trigger
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $$
declare
  v_org_id uuid;
  v_sgk_no text;
  v_company_name text;
  v_employee_count integer;
  v_hazard_class text;
begin
  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.user_id is null then
    return new;
  end if;

  select p.organization_id
  into v_org_id
  from public.profiles p
  where p.id = new.user_id
  limit 1;

  -- Kullanıcı henüz bir organizasyona bağlı değilse ISG-Bot senkronunu sessizce atla.
  if v_org_id is null then
    return new;
  end if;

  v_sgk_no := coalesce(nullif(new.tax_number, ''), new.id::text);
  v_company_name := coalesce(nullif(new.name, ''), 'Adsız Firma');
  v_employee_count := greatest(coalesce(new.employee_count, 5), 0);

  v_hazard_class := case
    when lower(coalesce(new.industry, '')) like '%inşaat%' then 'Çok Tehlikeli'
    when lower(coalesce(new.industry, '')) like '%construction%' then 'Çok Tehlikeli'
    when lower(coalesce(new.industry, '')) like '%imalat%' then 'Tehlikeli'
    when lower(coalesce(new.industry, '')) like '%üretim%' then 'Tehlikeli'
    when lower(coalesce(new.industry, '')) like '%kimya%' then 'Çok Tehlikeli'
    when lower(coalesce(new.industry, '')) like '%maden%' then 'Çok Tehlikeli'
    else 'Az Tehlikeli'
  end;

  insert into public.isgkatip_companies (
    org_id,
    sgk_no,
    company_name,
    employee_count,
    hazard_class,
    assigned_minutes,
    required_minutes,
    compliance_status,
    risk_score,
    created_at,
    updated_at,
    is_osgb_managed,
    management_source,
    tax_number,
    address,
    phone,
    email,
    notes,
    visit_frequency
  )
  values (
    v_org_id,
    v_sgk_no,
    v_company_name,
    v_employee_count,
    v_hazard_class,
    0,
    v_employee_count * 20,
    'WARNING',
    50,
    coalesce(new.created_at, now()),
    now(),
    false,
    'app',
    new.tax_number,
    new.address,
    new.phone,
    new.email,
    new.notes,
    coalesce(new.visit_frequency, 'monthly_once')
  )
  on conflict (org_id, sgk_no)
  do update set
    company_name = excluded.company_name,
    employee_count = excluded.employee_count,
    hazard_class = excluded.hazard_class,
    required_minutes = excluded.required_minutes,
    tax_number = excluded.tax_number,
    address = excluded.address,
    phone = excluded.phone,
    email = excluded.email,
    notes = excluded.notes,
    visit_frequency = excluded.visit_frequency,
    updated_at = now();

  return new;
end;
$$;
