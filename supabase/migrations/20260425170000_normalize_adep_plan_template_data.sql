update public.adep_plans
set plan_data = jsonb_strip_nulls(
  coalesce(plan_data, '{}'::jsonb) ||
  jsonb_build_object(
    'mevzuat',
    ('{
      "amac":"",
      "kapsam":"",
      "dayanak":"",
      "tanimlar":""
    }'::jsonb || coalesce(plan_data->'mevzuat', '{}'::jsonb)),
    'genel_bilgiler',
    (
      '{
        "hazirlanma_tarihi":"",
        "gecerlilik_tarihi":"",
        "revizyon_no":"Rev. 0",
        "revizyon_tarihi":""
      }'::jsonb ||
      coalesce(plan_data->'genel_bilgiler', '{}'::jsonb) ||
      jsonb_build_object(
        'hazirlayanlar',
        case
          when jsonb_typeof(plan_data->'genel_bilgiler'->'hazirlayanlar') = 'array'
            and jsonb_array_length(plan_data->'genel_bilgiler'->'hazirlayanlar') > 0
          then plan_data->'genel_bilgiler'->'hazirlayanlar'
          else '[{"client_id":"default-preparer","unvan":"","ad_soyad":""}]'::jsonb
        end
      )
    ),
    'isyeri_bilgileri',
    ('{
      "adres":"",
      "telefon":"",
      "tehlike_sinifi":"Tehlikeli",
      "sgk_sicil_no":"",
      "is_kolu":""
    }'::jsonb || coalesce(plan_data->'isyeri_bilgileri', '{}'::jsonb)),
    'osgb_bilgileri',
    ('{
      "unvan":"",
      "adres":"",
      "telefon":"",
      "web":"",
      "email":""
    }'::jsonb || coalesce(plan_data->'osgb_bilgileri', '{}'::jsonb)),
    'gorevli_bilgileri',
    (
      '{
        "isveren_vekil":{"ad_soyad":"","unvan":"İşveren / İşveren Vekili","telefon":"","tc_no":"","belge_no":"","egitim_tarihi":""},
        "isg_uzmani":{"ad_soyad":"","unvan":"İş Güvenliği Uzmanı","telefon":"","tc_no":"","belge_no":"","egitim_tarihi":""},
        "isyeri_hekimi":{"ad_soyad":"","unvan":"İşyeri Hekimi","telefon":"","tc_no":"","belge_no":"","egitim_tarihi":""},
        "calisan_temsilcisi":{"ad_soyad":"","unvan":"Çalışan Temsilcisi","telefon":"","tc_no":"","belge_no":"","egitim_tarihi":""},
        "destek_elemani":{"ad_soyad":"","unvan":"Destek Elemanı / Koordinatör","telefon":"","tc_no":"","belge_no":"","egitim_tarihi":""},
        "bilgi_sahibi_kisi":{"ad_soyad":"","unvan":"Bilgi Sahibi Kişi","telefon":"","tc_no":"","belge_no":"","egitim_tarihi":""}
      }'::jsonb || coalesce(plan_data->'gorevli_bilgileri', '{}'::jsonb)
    ),
    'dokuman_bilgileri',
    ('{
      "plan_basligi":"ACİL DURUM PLANI",
      "plan_alt_basligi":"ACİL DURUM EYLEM PLANI",
      "ay_yil":"",
      "dokuman_tarihi":"",
      "yenilenme_periyodu":"Yılda en az bir kez gözden geçirilir."
    }'::jsonb || coalesce(plan_data->'dokuman_bilgileri', '{}'::jsonb)),
    'toplanma_yeri',
    ('{
      "aciklama":"",
      "harita_url":""
    }'::jsonb || coalesce(plan_data->'toplanma_yeri', '{}'::jsonb)),
    'ekler',
    ('{
      "kroki_notu":"",
      "tahliye_plani_notu":"",
      "organizasyon_semasi_notu":"",
      "ek_notlar":""
    }'::jsonb || coalesce(plan_data->'ekler', '{}'::jsonb)),
    'export_preferences',
    ('{
      "cover_style":"shadow"
    }'::jsonb || coalesce(plan_data->'export_preferences', '{}'::jsonb))
  )
)
where coalesce(is_deleted, false) = false;
