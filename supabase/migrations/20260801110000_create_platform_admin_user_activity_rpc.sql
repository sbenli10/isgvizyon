create or replace function public.get_platform_admin_user_activity(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_items jsonb := '[]'::jsonb;
  v_table_items jsonb;
  v_pair text[];
  v_table_name text;
  v_label text;
  v_actor_column text;
  v_activity_tables text[][] := array[
    array['bulk_capa_sessions', 'DÖF Oturumları', 'created_by'],
    array['bulk_capa_entries', 'DÖF Kayıtları', 'created_by'],
    array['companies', 'Firmalar', 'user_id'],
    array['employees', 'Çalışanlar', 'created_by'],
    array['inspections', 'Denetimler', 'created_by'],
    array['risk_assessments', 'Risk Değerlendirmeleri', 'created_by'],
    array['reports', 'Raporlar', 'created_by'],
    array['board_meetings', 'Kurul Toplantıları', 'created_by'],
    array['training_attendance_records', 'Eğitim Katılım Formları', 'created_by'],
    array['suggestion_ledger_records', 'Tespit ve Öneri Defteri', 'created_by'],
    array['orientation_training_records', 'İşbaşı Eğitim Tutanakları', 'created_by'],
    array['emergency_drill_reports', 'Tatbikat Tutanakları', 'created_by'],
    array['disciplinary_notice_records', 'Ceza ve Tebliğ Tutanakları', 'created_by'],
    array['work_permit_records', 'İş İzin Formları', 'created_by'],
    array['incident_investigation_reports', 'İş Kazası Raporları', 'created_by'],
    array['ek2_medical_exam_records', 'Muayene Formları', 'created_by'],
    array['ppe_zimmet_records', 'KKD Zimmetleri', 'created_by'],
    array['isg_job_posts', 'İş İlanları', 'created_by'],
    array['isg_job_comments', 'İlan Yorumları', 'created_by']
  ];
begin
  if not public.is_platform_admin() then
    raise exception 'Platform yönetim yetkisi gerekli.';
  end if;

  select jsonb_build_array(
    jsonb_build_object(
      'id', p.id::text || '-signup',
      'module', 'Üyelik',
      'action', 'Üyelik oluşturuldu',
      'detail', coalesce(p.full_name, p.email, 'İsimsiz kullanıcı'),
      'created_at', p.created_at
    ),
    jsonb_build_object(
      'id', p.id::text || '-last-login',
      'module', 'Giriş',
      'action', 'Son giriş kaydı',
      'detail', coalesce(p.email, 'E-posta bilgisi yok'),
      'created_at', p.last_login_at
    )
  )
  into v_items
  from public.profiles p
  where p.id = p_user_id;

  if v_items is null then
    v_items := '[]'::jsonb;
  end if;

  foreach v_pair slice 1 in array v_activity_tables
  loop
    v_table_name := v_pair[1];
    v_label := v_pair[2];
    v_actor_column := v_pair[3];

    if to_regclass('public.' || v_table_name) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_table_name
          and column_name = v_actor_column
      )
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = v_table_name
          and column_name = 'created_at'
      )
    then
      execute format(
        $query$
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', coalesce(to_jsonb(t)->>'id', md5(t::text)),
                'module', %L,
                'action', 'Kayıt oluşturdu',
                'detail', coalesce(
                  nullif(to_jsonb(t)->>'title', ''),
                  nullif(to_jsonb(t)->>'name', ''),
                  nullif(to_jsonb(t)->>'company_name', ''),
                  nullif(to_jsonb(t)->>'full_name', ''),
                  nullif(to_jsonb(t)->>'status', ''),
                  nullif(to_jsonb(t)->>'content', ''),
                  'Kayıt detayı'
                ),
                'created_at', t.created_at
              )
              order by t.created_at desc nulls last
            ),
            '[]'::jsonb
          )
          from public.%I t
          where t.%I = $1
        $query$,
        v_label,
        v_table_name,
        v_actor_column
      )
      into v_table_items
      using p_user_id;

      v_items := v_items || coalesce(v_table_items, '[]'::jsonb);
    end if;
  end loop;

  return jsonb_build_object(
    'user_id', p_user_id,
    'activities',
    coalesce((
      select jsonb_agg(activity.item)
      from (
        select item
        from jsonb_array_elements(v_items) item
        where item->>'created_at' is not null
        order by (item->>'created_at')::timestamptz desc nulls last
        limit 80
      ) activity
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_platform_admin_user_activity(uuid) from public;
revoke all on function public.get_platform_admin_user_activity(uuid) from anon;
grant execute on function public.get_platform_admin_user_activity(uuid) to authenticated;
