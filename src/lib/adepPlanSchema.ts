import { z } from "zod";

export const HAZARD_CLASSES = ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"] as const;

export type HazardClass = (typeof HAZARD_CLASSES)[number];
export type ADEPStatus = "draft" | "completed";
export type ADEPTeamKey = "sondurme" | "kurtarma" | "koruma" | "ilkyardim";

export const adepPersonSchema = z.object({
  ad_soyad: z.string().default(""),
  tc_no: z.string().default(""),
  telefon: z.string().default(""),
});

export const adepProfessionalSchema = adepPersonSchema.extend({
  belge_no: z.string().default(""),
});

export const adepTeamSchema = z.object({
  ekip_baskani: adepPersonSchema.default({ ad_soyad: "", tc_no: "", telefon: "" }),
  uyeler: z.array(adepPersonSchema).default([]),
});

export const adepMaterialSchema = z.object({
  equipment_name: z.string().default(""),
  quantity: z.string().default(""),
  location: z.string().optional().default(""),
});

export const adepPlanDataSchema = z.object({
  genel_bilgiler: z
    .object({
      plan_basligi: z.string().default("ACİL DURUM PLANI"),
      plan_alt_basligi: z.string().default("ACİL DURUM EYLEM PLANI"),
      hazirlanma_tarihi: z.string().default(""),
      gecerlilik_tarihi: z.string().default(""),
    })
    .default({}),
  firma_bilgileri: z
    .object({
      unvan: z.string().default(""),
      adres: z.string().default(""),
      sgk_sicil_no: z.string().default(""),
      tehlike_sinifi: z.enum(HAZARD_CLASSES).default("Tehlikeli"),
      calisan_sayisi: z.coerce.number().int().min(0).default(0),
    })
    .default({}),
  osgb_bilgileri: z
    .object({
      unvan: z.string().default(""),
      adres: z.string().default(""),
      telefon: z.string().default(""),
      iletisim_bilgisi: z.string().default(""),
    })
    .default({}),
  yetkililer: z
    .object({
      isveren_vekil: adepPersonSchema.default({ ad_soyad: "", tc_no: "", telefon: "" }),
      isg_uzmani: adepProfessionalSchema.default({ ad_soyad: "", tc_no: "", telefon: "", belge_no: "" }),
      isyeri_hekimi: adepProfessionalSchema.default({ ad_soyad: "", tc_no: "", telefon: "", belge_no: "" }),
    })
    .default({}),
  ekipler: z
    .object({
      sondurme: adepTeamSchema.default({ ekip_baskani: { ad_soyad: "", tc_no: "", telefon: "" }, uyeler: [] }),
      kurtarma: adepTeamSchema.default({ ekip_baskani: { ad_soyad: "", tc_no: "", telefon: "" }, uyeler: [] }),
      koruma: adepTeamSchema.default({ ekip_baskani: { ad_soyad: "", tc_no: "", telefon: "" }, uyeler: [] }),
      ilkyardim: adepTeamSchema.default({ ekip_baskani: { ad_soyad: "", tc_no: "", telefon: "" }, uyeler: [] }),
    })
    .default({}),
  malzeme_envanteri: z.array(adepMaterialSchema).default([]),
  toplanma_alani: z.string().default("Acil durum toplanma alanı işyeri planında belirtilen güvenli alandır."),
});

export type ADEPPerson = z.infer<typeof adepPersonSchema>;
export type ADEPProfessional = z.infer<typeof adepProfessionalSchema>;
export type ADEPTeam = z.infer<typeof adepTeamSchema>;
export type ADEPMaterial = z.infer<typeof adepMaterialSchema>;
export type CoreADEPPlanData = z.infer<typeof adepPlanDataSchema>;
export type ADEPRolePerson = ADEPProfessional & { unvan: string; egitim_tarihi: string };

export type ADEPPlanData = CoreADEPPlanData & {
  mevzuat: {
    amac: string;
    kapsam: string;
    dayanak: string;
    tanimlar: string;
  };
  isyeri_bilgileri: {
    adres: string;
    telefon: string;
    tehlike_sinifi: string;
    sgk_sicil_no: string;
    is_kolu: string;
  };
  gorevli_bilgileri: {
    isveren_vekil: ADEPRolePerson;
    isg_uzmani: ADEPRolePerson;
    isyeri_hekimi: ADEPRolePerson;
    calisan_temsilcisi: ADEPRolePerson;
    destek_elemani: ADEPRolePerson;
    bilgi_sahibi_kisi: ADEPRolePerson;
  };
  dokuman_bilgileri: {
    plan_basligi: string;
    plan_alt_basligi: string;
    ay_yil: string;
    dokuman_tarihi: string;
    yenilenme_periyodu: string;
  };
  toplanma_yeri: {
    aciklama: string;
    harita_url: string;
  };
  ekler: {
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
  };
  genel_bilgiler: CoreADEPPlanData["genel_bilgiler"] & {
    hazirlayanlar: Array<{ client_id?: string; unvan: string; ad_soyad: string }>;
    revizyon_no: string;
    revizyon_tarihi: string;
  };
  osgb_bilgileri: CoreADEPPlanData["osgb_bilgileri"] & {
    web: string;
    email: string;
  };
  export_preferences?: {
    cover_style: "classic" | "gold" | "blueprint" | "minimal" | "nature" | "official-red" | "shadow";
  };
};

export interface ADEPPlanRow {
  id?: string;
  user_id: string;
  company_id?: string | null;
  org_id?: string | null;
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

export const ADEP_TEMPLATE_APPENDICES = [
  "Ek-1: Acil Durum Organizasyon Yapısı",
  "Ek-2: Acil Durum Telefon Numaraları",
  "Ek-3: Acil Durum Malzeme Envanteri",
  "Ek-4: İmza ve Onay Sayfası",
] as const;

const emptyPerson: ADEPPerson = { ad_soyad: "", tc_no: "", telefon: "" };
const emptyProfessional: ADEPProfessional = { ...emptyPerson, belge_no: "" };

const withRole = (person: ADEPProfessional, unvan: string): ADEPRolePerson => ({
  ...person,
  unvan,
  egitim_tarihi: "",
});

const coreDefaults: CoreADEPPlanData = adepPlanDataSchema.parse({});

export const DEFAULT_ADEP_PLAN_DATA: ADEPPlanData = {
  ...coreDefaults,
  genel_bilgiler: {
    ...coreDefaults.genel_bilgiler,
    hazirlayanlar: [{ client_id: "default-preparer", unvan: "İş Güvenliği Uzmanı", ad_soyad: "" }],
    revizyon_no: "Rev. 0",
    revizyon_tarihi: "",
  },
  osgb_bilgileri: {
    ...coreDefaults.osgb_bilgileri,
    web: "",
    email: "",
  },
  mevzuat: {
    amac: "",
    kapsam: "",
    dayanak: "",
    tanimlar: "",
  },
  isyeri_bilgileri: {
    adres: "",
    telefon: "",
    tehlike_sinifi: coreDefaults.firma_bilgileri.tehlike_sinifi,
    sgk_sicil_no: "",
    is_kolu: "",
  },
  gorevli_bilgileri: {
    isveren_vekil: withRole(emptyProfessional, "İşveren / İşveren Vekili"),
    isg_uzmani: withRole(emptyProfessional, "İş Güvenliği Uzmanı"),
    isyeri_hekimi: withRole(emptyProfessional, "İşyeri Hekimi"),
    calisan_temsilcisi: withRole(emptyProfessional, "Çalışan Temsilcisi"),
    destek_elemani: withRole(emptyProfessional, "Destek Elemanı"),
    bilgi_sahibi_kisi: withRole(emptyProfessional, "Bilgi Sahibi Kişi"),
  },
  dokuman_bilgileri: {
    plan_basligi: coreDefaults.genel_bilgiler.plan_basligi,
    plan_alt_basligi: coreDefaults.genel_bilgiler.plan_alt_basligi,
    ay_yil: "",
    dokuman_tarihi: coreDefaults.genel_bilgiler.hazirlanma_tarihi,
    yenilenme_periyodu: "Yılda en az bir kez gözden geçirilir.",
  },
  toplanma_yeri: {
    aciklama: coreDefaults.toplanma_alani,
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

const toHazardClass = (value: unknown): HazardClass => {
  if (value === "Az Tehlikeli" || value === "Tehlikeli" || value === "Çok Tehlikeli") {
    return value;
  }
  return "Tehlikeli";
};

const normalizePerson = (value: unknown): ADEPPerson => ({
  ...emptyPerson,
  ...((value || {}) as Partial<ADEPPerson>),
});

const normalizeProfessional = (value: unknown): ADEPProfessional => ({
  ...emptyProfessional,
  ...normalizePerson(value),
  ...((value || {}) as Partial<ADEPProfessional>),
});

const normalizeTeam = (value: unknown): ADEPTeam => {
  const source = (value || {}) as Partial<ADEPTeam>;
  return {
    ekip_baskani: normalizePerson(source.ekip_baskani),
    uyeler: Array.isArray(source.uyeler) ? source.uyeler.map(normalizePerson) : [],
  };
};

export const toCoreADEPPlanData = (data: ADEPPlanData | CoreADEPPlanData): CoreADEPPlanData => ({
  genel_bilgiler: {
    plan_basligi: data.genel_bilgiler.plan_basligi,
    plan_alt_basligi: data.genel_bilgiler.plan_alt_basligi,
    hazirlanma_tarihi: data.genel_bilgiler.hazirlanma_tarihi,
    gecerlilik_tarihi: data.genel_bilgiler.gecerlilik_tarihi,
  },
  firma_bilgileri: data.firma_bilgileri,
  osgb_bilgileri: {
    unvan: data.osgb_bilgileri.unvan,
    adres: data.osgb_bilgileri.adres,
    telefon: data.osgb_bilgileri.telefon,
    iletisim_bilgisi: data.osgb_bilgileri.iletisim_bilgisi,
  },
  yetkililer: data.yetkililer,
  ekipler: data.ekipler,
  malzeme_envanteri: data.malzeme_envanteri,
  toplanma_alani: data.toplanma_alani,
});

export const mergeADEPPlanData = (incoming: unknown): ADEPPlanData => {
  const raw = (incoming || {}) as Partial<ADEPPlanData>;
  const legacyWorkplace = (raw.isyeri_bilgileri || {}) as Partial<ADEPPlanData["isyeri_bilgileri"]>;
  const legacyDocument = (raw.dokuman_bilgileri || {}) as Partial<ADEPPlanData["dokuman_bilgileri"]>;
  const legacyResponsible = (raw.gorevli_bilgileri || {}) as Partial<ADEPPlanData["gorevli_bilgileri"]>;
  const legacyMeeting = (raw.toplanma_yeri || {}) as Partial<ADEPPlanData["toplanma_yeri"]>;
  const rawGeneral = (raw.genel_bilgiler || {}) as Partial<ADEPPlanData["genel_bilgiler"]>;
  const rawFirm = (raw.firma_bilgileri || {}) as Partial<ADEPPlanData["firma_bilgileri"]>;
  const rawOsgb = (raw.osgb_bilgileri || {}) as Partial<ADEPPlanData["osgb_bilgileri"]>;

  const core: CoreADEPPlanData = {
    genel_bilgiler: {
      plan_basligi: rawGeneral.plan_basligi || legacyDocument.plan_basligi || DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.plan_basligi,
      plan_alt_basligi:
        rawGeneral.plan_alt_basligi || legacyDocument.plan_alt_basligi || DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.plan_alt_basligi,
      hazirlanma_tarihi:
        rawGeneral.hazirlanma_tarihi || legacyDocument.dokuman_tarihi || DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.hazirlanma_tarihi,
      gecerlilik_tarihi: rawGeneral.gecerlilik_tarihi || DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.gecerlilik_tarihi,
    },
    firma_bilgileri: {
      unvan: rawFirm.unvan || "",
      adres: rawFirm.adres || legacyWorkplace.adres || "",
      sgk_sicil_no: rawFirm.sgk_sicil_no || legacyWorkplace.sgk_sicil_no || "",
      tehlike_sinifi: toHazardClass(rawFirm.tehlike_sinifi || legacyWorkplace.tehlike_sinifi),
      calisan_sayisi: Number(rawFirm.calisan_sayisi || 0),
    },
    osgb_bilgileri: {
      unvan: rawOsgb.unvan || "",
      adres: rawOsgb.adres || "",
      telefon: rawOsgb.telefon || "",
      iletisim_bilgisi: rawOsgb.iletisim_bilgisi || [rawOsgb.web, rawOsgb.email].filter(Boolean).join(" | ") || "",
    },
    yetkililer: {
      isveren_vekil: normalizePerson(raw.yetkililer?.isveren_vekil || legacyResponsible.isveren_vekil),
      isg_uzmani: normalizeProfessional(raw.yetkililer?.isg_uzmani || legacyResponsible.isg_uzmani),
      isyeri_hekimi: normalizeProfessional(raw.yetkililer?.isyeri_hekimi || legacyResponsible.isyeri_hekimi),
    },
    ekipler: {
      sondurme: normalizeTeam(raw.ekipler?.sondurme),
      kurtarma: normalizeTeam(raw.ekipler?.kurtarma),
      koruma: normalizeTeam(raw.ekipler?.koruma),
      ilkyardim: normalizeTeam(raw.ekipler?.ilkyardim),
    },
    malzeme_envanteri: Array.isArray(raw.malzeme_envanteri)
      ? raw.malzeme_envanteri.map((item) => adepMaterialSchema.parse(item))
      : [],
    toplanma_alani: raw.toplanma_alani || legacyMeeting.aciklama || DEFAULT_ADEP_PLAN_DATA.toplanma_alani,
  };

  return {
    ...DEFAULT_ADEP_PLAN_DATA,
    ...core,
    genel_bilgiler: {
      ...core.genel_bilgiler,
      hazirlayanlar: rawGeneral.hazirlayanlar || DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.hazirlayanlar,
      revizyon_no: rawGeneral.revizyon_no || DEFAULT_ADEP_PLAN_DATA.genel_bilgiler.revizyon_no,
      revizyon_tarihi: rawGeneral.revizyon_tarihi || "",
    },
    firma_bilgileri: core.firma_bilgileri,
    osgb_bilgileri: {
      ...core.osgb_bilgileri,
      web: rawOsgb.web || "",
      email: rawOsgb.email || "",
    },
    yetkililer: core.yetkililer,
    ekipler: core.ekipler,
    malzeme_envanteri: core.malzeme_envanteri,
    toplanma_alani: core.toplanma_alani,
    isyeri_bilgileri: {
      adres: core.firma_bilgileri.adres,
      telefon: "",
      tehlike_sinifi: core.firma_bilgileri.tehlike_sinifi,
      sgk_sicil_no: core.firma_bilgileri.sgk_sicil_no,
      is_kolu: legacyWorkplace.is_kolu || "",
    },
    gorevli_bilgileri: {
      isveren_vekil: withRole({ ...emptyProfessional, ...core.yetkililer.isveren_vekil }, "İşveren / İşveren Vekili"),
      isg_uzmani: withRole(core.yetkililer.isg_uzmani, "İş Güvenliği Uzmanı"),
      isyeri_hekimi: withRole(core.yetkililer.isyeri_hekimi, "İşyeri Hekimi"),
      calisan_temsilcisi: withRole(emptyProfessional, "Çalışan Temsilcisi"),
      destek_elemani: withRole(emptyProfessional, "Destek Elemanı"),
      bilgi_sahibi_kisi: withRole(emptyProfessional, "Bilgi Sahibi Kişi"),
    },
    dokuman_bilgileri: {
      plan_basligi: core.genel_bilgiler.plan_basligi,
      plan_alt_basligi: core.genel_bilgiler.plan_alt_basligi,
      ay_yil: legacyDocument.ay_yil || "",
      dokuman_tarihi: core.genel_bilgiler.hazirlanma_tarihi,
      yenilenme_periyodu: legacyDocument.yenilenme_periyodu || DEFAULT_ADEP_PLAN_DATA.dokuman_bilgileri.yenilenme_periyodu,
    },
    toplanma_yeri: {
      aciklama: core.toplanma_alani,
      harita_url: legacyMeeting.harita_url || "",
    },
    ekler: {
      ...DEFAULT_ADEP_PLAN_DATA.ekler,
      ...(raw.ekler || {}),
    },
    export_preferences: raw.export_preferences || DEFAULT_ADEP_PLAN_DATA.export_preferences,
  };
};
