create or replace function public.get_platform_admin_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_module_counts jsonb := '{}'::jsonb;
  v_table_name text;
  v_label text;
  v_pair text[];
  v_count bigint;
  v_today_count bigint;
  v_module_tables text[][] := array[
    array['companies', 'Firmalar'],
    array['employees', 'Çalışanlar'],
    array['bulk_capa_sessions', 'DÖF Oturumları'],
    array['bulk_capa_entries', 'DÖF Kayıtları'],
    array['inspections', 'Denetimler'],
    array['risk_assessments', 'Risk Değerlendirmeleri'],
    array['reports', 'Raporlar'],
    array['board_meetings', 'Kurul Toplantıları'],
    array['training_attendance_records', 'Eğitim Katılım Formları'],
    array['suggestion_ledger_records', 'Tespit ve Öneri Defteri'],
    array['orientation_training_records', 'İşbaşı Eğitim Tutanakları'],
    array['emergency_drill_reports', 'Tatbikat Tutanakları'],
    array['disciplinary_notice_records', 'Ceza ve Tebliğ Tutanakları'],
    array['work_permit_records', 'İş İzin Formları'],
    array['incident_investigation_reports', 'İş Kazası Raporları'],
    array['ek2_medical_exam_records', 'Muayene Formları'],
    array['ppe_zimmet_records', 'KKD Zimmetleri'],
    array['isg_job_posts', 'İş İlanları']
  ];
begin
  if not public.is_platform_admin() then
    raise exception 'Platform yönetim yetkisi gerekli.';
  end if;

  foreach v_pair slice 1 in array v_module_tables
  loop
    v_table_name := v_pair[1];
    v_label := v_pair[2];

    if to_regclass('public.' || v_table_name) is null then
      v_module_counts := v_module_counts || jsonb_build_object(
        v_table_name,
        jsonb_build_object('label', v_label, 'total', 0, 'today', 0)
      );
    else
      execute format('select count(*) from public.%I', v_table_name) into v_count;

      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_table_name
          and column_name = 'created_at'
      ) then
        execute format('select count(*) from public.%I where created_at >= current_date', v_table_name) into v_today_count;
      else
        v_today_count := 0;
      end if;

      v_module_counts := v_module_counts || jsonb_build_object(
        v_table_name,
        jsonb_build_object('label', v_label, 'total', coalesce(v_count, 0), 'today', coalesce(v_today_count, 0))
      );
    end if;
  end loop;

  select jsonb_build_object(
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'today_signups', (select count(*) from public.profiles where created_at >= current_date),
      'today_logins', (select count(*) from public.profiles where last_login_at >= current_date),
      'active', (select count(*) from public.profiles where coalesce(is_active, true) = true),
      'platform_admins', (select count(*) from public.profiles where coalesce(is_platform_admin, false) = true)
    ),
    'jobs', jsonb_build_object(
      'pending_posts', (select count(*) from public.isg_job_posts where status = 'pending'),
      'approved_posts', (select count(*) from public.isg_job_posts where status = 'approved'),
      'pending_comments', (select count(*) from public.isg_job_comments where status = 'pending')
    ),
    'modules', v_module_counts,
    'daily_signups', coalesce((
      select jsonb_agg(row_to_json(x) order by x.day)
      from (
        select
          to_char(day::date, 'DD.MM') as label,
          day::date as day,
          count(p.id)::int as value
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') day
        left join public.profiles p on p.created_at::date = day::date
        group by day
      ) x
    ), '[]'::jsonb),
    'daily_logins', coalesce((
      select jsonb_agg(row_to_json(x) order by x.day)
      from (
        select
          to_char(day::date, 'DD.MM') as label,
          day::date as day,
          count(p.id)::int as value
        from generate_series(current_date - interval '13 days', current_date, interval '1 day') day
        left join public.profiles p on p.last_login_at::date = day::date
        group by day
      ) x
    ), '[]'::jsonb),
    'latest_users', coalesce((
      select jsonb_agg(row_to_json(u))
      from (
        select
          id,
          email,
          full_name,
          role,
          subscription_plan,
          subscription_status,
          is_active,
          is_platform_admin,
          created_at,
          last_login_at
        from public.profiles
        order by created_at desc nulls last
        limit 80
      ) u
    ), '[]'::jsonb),
    'alerts', jsonb_build_array(
      jsonb_build_object('label', 'Onay bekleyen ilan', 'value', (select count(*) from public.isg_job_posts where status = 'pending')),
      jsonb_build_object('label', 'Onay bekleyen yorum', 'value', (select count(*) from public.isg_job_comments where status = 'pending')),
      jsonb_build_object('label', 'Bugün giriş yapan kullanıcı', 'value', (select count(*) from public.profiles where last_login_at >= current_date))
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_platform_admin_overview() from public;
revoke all on function public.get_platform_admin_overview() from anon;
grant execute on function public.get_platform_admin_overview() to authenticated;
