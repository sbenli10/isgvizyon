export type HazardClass = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
export type ADEPStatus = "draft" | "completed";

export interface ADEPPreparer {
  client_id?: string;
  unvan: string;
  ad_soyad: string;
}

export interface ADEPWorkplaceInfo {
  adres: string;
  telefon: string;
  tehlike_sinifi: string;
  sgk_sicil_no: string;
  is_kolu: string;
}

export interface ADEPDocumentInfo {
  plan_basligi: string;
  plan_alt_basligi: string;
  ay_yil: string;
  dokuman_tarihi: string;
  yenilenme_periyodu: string;
}

export interface ADEPOrganizationInfo {
  unvan: string;
  adres: string;
  telefon: string;
  web: string;
  email: string;
}

export interface ADEPRolePerson {
  ad_soyad: string;
  unvan: string;
  telefon: string;
  tc_no: string;
  belge_no: string;
  egitim_tarihi: string;
}

export interface ADEPResponsiblePeople {
  isveren_vekil: ADEPRolePerson;
  isg_uzmani: ADEPRolePerson;
  isyeri_hekimi: ADEPRolePerson;
  calisan_temsilcisi: ADEPRolePerson;
  destek_elemani: ADEPRolePerson;
  bilgi_sahibi_kisi: ADEPRolePerson;
}

export interface ADEPAttachmentsInfo {
  kroki_notu: string;
  tahliye_plani_notu: string;
  organizasyon_semasi_notu: string;
  ek_notlar: string;
  secili_kroki: {
    id: string;
    project_name: string;
    thumbnail_data_url: string;
    created_at: string;
  } | null;
}

export interface ADEPPlanData {
  mevzuat: {
    amac: string;
    kapsam: string;
    dayanak: string;
    tanimlar: string;
  };
  genel_bilgiler: {
    hazirlayanlar: ADEPPreparer[];
    hazirlanma_tarihi: string;
    gecerlilik_tarihi: string;
    revizyon_no: string;
    revizyon_tarihi: string;
  };
  isyeri_bilgileri: ADEPWorkplaceInfo;
  osgb_bilgileri: ADEPOrganizationInfo;
  gorevli_bilgileri: ADEPResponsiblePeople;
  dokuman_bilgileri: ADEPDocumentInfo;
  toplanma_yeri: {
    aciklama: string;
    harita_url: string;
  };
  ekler: ADEPAttachmentsInfo;
  export_preferences?: {
    cover_style:
      | "classic"
      | "gold"
      | "blueprint"
      | "minimal"
      | "nature"
      | "official-red"
      | "shadow";
  };
}

export interface ADEPPlanRow {
  id?: string;
  user_id: string;
  company_id?: string | null;
  plan_name: string;
  company_name: string;
  sector?: string | null;
  hazard_class: HazardClass;
  employee_count: number;
  status: ADEPStatus;
  completion_percentage: number;
  plan_data: ADEPPlanData;
  next_review_date?: string | null;
  pdf_url?: string | null;
}

const EMPTY_ROLE_PERSON: ADEPRolePerson = {
  ad_soyad: "",
  unvan: "",
  telefon: "",
  tc_no: "",
  belge_no: "",
  egitim_tarihi: "",
};

export const ADEP_TEMPLATE_APPENDICES = [
  "Ek-1: Acil Durum Organizasyon Yapısı",
  "Ek-2: Acil Durum Telefon Numaraları",
  "Ek-3: İş Kazası Müdahale Planı",
  "Ek-4: Besin Zehirlenmesi Müdahale Planı",
  "Ek-5: Gaz Zehirlenmesi Müdahale Planı",
  "Ek-6: Yanık Müdahale Planı",
  "Ek-7: Elektrik Çarpması Müdahale Planı",
  "Ek-8: Tahliye Planı",
  "Ek-9: Kroki",
] as const;

export const DEFAULT_ADEP_PLAN_DATA: ADEPPlanData = {
  mevzuat: {
    amac:
      "Bu Acil Durum Eylem Planı (ADEP), işyerinde meydana gelebilecek acil durumlara karşı hazırlıklı olmak, can kaybını ve yaralanmaları önlemek, olası zararları en aza indirmek amacıyla hazırlanmıştır.",
    kapsam:
      "Bu plan işyerinde bulunan tüm çalışanları, ziyaretçileri ve taşeron personeli kapsar. İşyerindeki tüm bina/eklentiler, çalışma alanları ve ortak alanlar bu plan kapsamındadır.",
    dayanak:
      "6331 sayılı İş Sağlığı ve Güvenliği Kanunu ve Acil Durumlar Hakkında Yönetmelik başta olmak üzere ilgili mevzuat hükümlerine dayanılarak hazırlanmıştır.",
    tanimlar:
      "Acil Durum: Yangın, patlama, kimyasal yayılım, doğal afet vb. durumlar.\nTahliye: Kişilerin güvenli alana kontrollü çıkarılması.\nToplanma Alanı: Tahliye sonrası yoklama yapılan güvenli bölge.\nEkip Lideri: Müdahale ekiplerinin koordinasyonundan sorumlu kişi.",
  },
  genel_bilgiler: {
    hazirlayanlar: [{ client_id: "default-preparer", unvan: "", ad_soyad: "" }],
    hazirlanma_tarihi: "",
    gecerlilik_tarihi: "",
    revizyon_no: "Rev. 0",
    revizyon_tarihi: "",
  },
  isyeri_bilgileri: {
    adres: "",
    telefon: "",
    tehlike_sinifi: "Tehlikeli",
    sgk_sicil_no: "",
    is_kolu: "",
  },
  osgb_bilgileri: {
    unvan: "",
    adres: "",
    telefon: "",
    web: "",
    email: "",
  },
  gorevli_bilgileri: {
    isveren_vekil: { ...EMPTY_ROLE_PERSON, unvan: "İşveren / İşveren Vekili" },
    isg_uzmani: { ...EMPTY_ROLE_PERSON, unvan: "İş Güvenliği Uzmanı" },
    isyeri_hekimi: { ...EMPTY_ROLE_PERSON, unvan: "İşyeri Hekimi" },
    calisan_temsilcisi: { ...EMPTY_ROLE_PERSON, unvan: "Çalışan Temsilcisi" },
    destek_elemani: { ...EMPTY_ROLE_PERSON, unvan: "Destek Elemanı / Koordinatör" },
    bilgi_sahibi_kisi: { ...EMPTY_ROLE_PERSON, unvan: "Bilgi Sahibi Kişi" },
  },
  dokuman_bilgileri: {
    plan_basligi: "ACİL DURUM PLANI",
    plan_alt_basligi: "ACİL DURUM EYLEM PLANI",
    ay_yil: "",
    dokuman_tarihi: "",
    yenilenme_periyodu: "Yılda en az bir kez gözden geçirilir.",
  },
  toplanma_yeri: {
    aciklama: "",
    harita_url: "",
  },
  ekler: {
    kroki_notu: "",
    tahliye_plani_notu: "",
    organizasyon_semasi_notu: "",
    ek_notlar: "",
    secili_kroki: null,
  },
  export_preferences: {
    cover_style: "shadow",
  },
};

export const mergeADEPPlanData = (incoming: unknown): ADEPPlanData => {
  const data = (incoming || {}) as Partial<ADEPPlanData>;
  const incomingHazirlayanlar =
    Array.isArray(data.genel_bilgiler?.hazirlayanlar) &&
    data.genel_bilgiler?.hazirlayanlar.length
      ? data.genel_bilgiler.hazirlayanlar
      : DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.hazirlayanlar;

  return {
    mevzuat: {
      ...DEFAULT_ADEP_PLAN_DATA.mevzuat,
      ...(data.mevzuat || {}),
    },
    genel_bilgiler: {
      ...DEFAULT_ADEP_PLAN_DATA.genel_bilgiler,
      ...(data.genel_bilgiler || {}),
      hazirlayanlar: incomingHazirlayanlar,
    },
    isyeri_bilgileri: {
      ...DEFAULT_ADEP_PLAN_DATA.isyeri_bilgileri,
      ...(data.isyeri_bilgileri || {}),
    },
    osgb_bilgileri: {
      ...DEFAULT_ADEP_PLAN_DATA.osgb_bilgileri,
      ...(data.osgb_bilgileri || {}),
    },
    gorevli_bilgileri: {
      isveren_vekil: {
        ...DEFAULT_ADEP_PLAN_DATA.gorevli_bilgileri.isveren_vekil,
        ...(data.gorevli_bilgileri?.isveren_vekil || {}),
      },
      isg_uzmani: {
        ...DEFAULT_ADEP_PLAN_DATA.gorevli_bilgileri.isg_uzmani,
        ...(data.gorevli_bilgileri?.isg_uzmani || {}),
      },
      isyeri_hekimi: {
        ...DEFAULT_ADEP_PLAN_DATA.gorevli_bilgileri.isyeri_hekimi,
        ...(data.gorevli_bilgileri?.isyeri_hekimi || {}),
      },
      calisan_temsilcisi: {
        ...DEFAULT_ADEP_PLAN_DATA.gorevli_bilgileri.calisan_temsilcisi,
        ...(data.gorevli_bilgileri?.calisan_temsilcisi || {}),
      },
      destek_elemani: {
        ...DEFAULT_ADEP_PLAN_DATA.gorevli_bilgileri.destek_elemani,
        ...(data.gorevli_bilgileri?.destek_elemani || {}),
      },
      bilgi_sahibi_kisi: {
        ...DEFAULT_ADEP_PLAN_DATA.gorevli_bilgileri.bilgi_sahibi_kisi,
        ...(data.gorevli_bilgileri?.bilgi_sahibi_kisi || {}),
      },
    },
    dokuman_bilgileri: {
      ...DEFAULT_ADEP_PLAN_DATA.dokuman_bilgileri,
      ...(data.dokuman_bilgileri || {}),
    },
    toplanma_yeri: {
      ...DEFAULT_ADEP_PLAN_DATA.toplanma_yeri,
      ...(data.toplanma_yeri || {}),
    },
    ekler: {
      ...DEFAULT_ADEP_PLAN_DATA.ekler,
      ...(data.ekler || {}),
    },
    export_preferences: {
      ...DEFAULT_ADEP_PLAN_DATA.export_preferences!,
      ...(data.export_preferences || {}),
    },
  };
};
