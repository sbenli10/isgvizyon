import { supabase } from "@/integrations/supabase/client";
import {
  ADEP_TEMPLATE_APPENDICES,
  type ADEPPlanData,
  mergeADEPPlanData,
} from "@/lib/adepPlanSchema";

export interface ADEPDocumentPlan {
  id: string;
  plan_name: string;
  company_name: string;
  sector?: string | null;
  hazard_class: string;
  employee_count: number;
  created_at?: string | null;
  updated_at?: string | null;
  plan_data: ADEPPlanData;
}

export interface ADEPDocumentTeam {
  id: string;
  team_name: string;
  members: string[];
  memberRecords: Array<{
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    full_name?: string | null;
    job_title?: string | null;
    phone?: string | null;
    tc_number?: string | null;
  }>;
  team_leader?: {
    id?: string;
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    phone?: string | null;
    tc_number?: string | null;
  } | null;
}

export interface ADEPDocumentContact {
  id: string;
  institution_name: string;
  phone_number: string;
}

export interface ADEPDocumentScenario {
  id: string;
  hazard_type: string;
  action_steps: string;
}

export interface ADEPDocumentMeasure {
  id: string;
  measure_title?: string | null;
  description?: string | null;
  status?: string | null;
}

export interface ADEPDocumentEquipment {
  id: string;
  equipment_name?: string | null;
  quantity?: number | null;
  location?: string | null;
  status?: string | null;
}

export interface ADEPDocumentDrill {
  id: string;
  drill_type?: string | null;
  drill_date?: string | null;
  notes?: string | null;
}

export interface ADEPDocumentChecklist {
  id: string;
  item_text?: string | null;
  status?: string | null;
}

export interface ADEPDocumentBundle {
  plan: ADEPDocumentPlan;
  teams: ADEPDocumentTeam[];
  contacts: ADEPDocumentContact[];
  scenarios: ADEPDocumentScenario[];
  preventiveMeasures: ADEPDocumentMeasure[];
  equipmentInventory: ADEPDocumentEquipment[];
  drills: ADEPDocumentDrill[];
  checklists: ADEPDocumentChecklist[];
}

export interface ADEPDocumentViewModel {
  cover: {
    title: string;
    subtitle: string;
    companyName: string;
    preparedDate: string;
  };
  companySummaryRows: Array<{ label: string; value: string }>;
  osgbRows: Array<{ label: string; value: string }>;
  personnelRows: Array<{ role: string; name: string; duty: string; phone?: string; meta?: string }>;
  emergencyTeamRows: Array<{ team: string; leader: string; memberCount: string }>;
  contactRows: Array<{ institution: string; phone: string }>;
  scenarioRows: Array<{ title: string; summary: string }>;
  appendixRows: string[];
  legislation: ADEPPlanData["mevzuat"];
  meetingPoint: string;
  notes: string[];
  source: ADEPDocumentBundle;
}

const roleOrder: Array<{
  key: keyof ADEPPlanData["gorevli_bilgileri"];
  label: string;
}> = [
  { key: "isveren_vekil", label: "İşveren / İşveren Vekili" },
  { key: "isg_uzmani", label: "İş Güvenliği Uzmanı" },
  { key: "isyeri_hekimi", label: "İşyeri Hekimi" },
  { key: "calisan_temsilcisi", label: "Çalışan Temsilcisi" },
  { key: "destek_elemani", label: "Destek Elemanı / Koordinatör" },
  { key: "bilgi_sahibi_kisi", label: "Bilgi Sahibi Kişi" },
];

const safeText = (value?: string | null, fallback = "-") => {
  const normalized = value?.trim();
  return normalized ? normalized : fallback;
};

export const formatDateOrDash = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("tr-TR");
};

const summarizeActionSteps = (actionSteps: string) => {
  const lines = actionSteps
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+[).\s-]*/, "").trim())
    .filter(Boolean);

  if (!lines.length) return "Müdahale adımları henüz tanımlanmadı.";
  return lines.slice(0, 3).join(" • ");
};

const getTeamLeaderName = (team: ADEPDocumentTeam) => {
  const leader = team.team_leader;
  const fullName = [leader?.first_name, leader?.last_name].filter(Boolean).join(" ").trim();
  return fullName || "Atanmadı";
};

const mapRoleMeta = (certificateNo?: string, trainingDate?: string) => {
  const chunks = [certificateNo ? `Belge No: ${certificateNo}` : "", trainingDate ? `Eğitim: ${formatDateOrDash(trainingDate)}` : ""]
    .filter(Boolean);
  return chunks.join(" • ");
};

type RawPlanRow = Omit<ADEPDocumentPlan, "plan_data"> & {
  plan_data: unknown;
};

type RawTeamRow = {
  id: string;
  team_name: string;
  members: string[] | null;
  team_leader?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    phone?: string | null;
    tc_number?: string | null;
  } | null;
};

type RawEmployeeRow = {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
  job_title?: string | null;
  phone?: string | null;
  tc_number?: string | null;
};

export const fetchADEPDocumentBundle = async (planId: string): Promise<ADEPDocumentBundle> => {
  const [
    planRes,
    teamsRes,
    contactsRes,
    scenariosRes,
    preventiveRes,
    equipmentRes,
    drillsRes,
    checklistsRes,
  ] = await Promise.all([
    supabase.from("adep_plans").select("*").eq("id", planId).single(),
    supabase
      .from("adep_teams")
      .select(
        "id, team_name, members, team_leader:employees!team_leader_id(first_name, last_name, job_title, phone)",
      )
      .eq("plan_id", planId)
      .order("created_at"),
    supabase
      .from("adep_emergency_contacts")
      .select("id, institution_name, phone_number")
      .eq("plan_id", planId)
      .order("institution_name"),
    supabase
      .from("adep_scenarios")
      .select("id, hazard_type, action_steps")
      .eq("plan_id", planId)
      .order("hazard_type"),
    supabase
      .from("adep_preventive_measures")
      .select("id, measure_title, description, status")
      .eq("plan_id", planId)
      .order("created_at"),
    supabase
      .from("adep_equipment_inventory")
      .select("id, equipment_name, quantity, location, status")
      .eq("plan_id", planId)
      .order("created_at"),
    supabase
      .from("adep_drills")
      .select("id, drill_type, drill_date, notes")
      .eq("plan_id", planId)
      .order("drill_date"),
    supabase
      .from("adep_checklists")
      .select("id, item_text, status")
      .eq("plan_id", planId)
      .order("created_at"),
  ]);

  if (planRes.error || !planRes.data) {
    throw planRes.error || new Error("ADEP planı bulunamadı.");
  }

  const rawPlan = planRes.data as unknown as RawPlanRow;
  const rawTeams = (teamsRes.data as unknown as RawTeamRow[]) || [];
  const memberIds = Array.from(
    new Set(
      rawTeams.flatMap((team) =>
        Array.isArray(team.members)
          ? team.members.filter((memberId): memberId is string => typeof memberId === "string" && Boolean(memberId))
          : [],
      ),
    ),
  );

  let employeesById = new Map<string, RawEmployeeRow>();

  if (memberIds.length) {
    const { data: employeeRows, error: employeesError } = await supabase
      .from("employees")
      .select("id, first_name, last_name, full_name, job_title, phone, tc_number")
      .in("id", memberIds);

    if (employeesError) {
      throw employeesError;
    }

    employeesById = new Map(
      ((employeeRows as unknown as RawEmployeeRow[]) || []).map((employee) => [employee.id, employee]),
    );
  }

  return {
    plan: {
      ...rawPlan,
      plan_data: mergeADEPPlanData(rawPlan.plan_data),
    },
    teams: rawTeams.map((team) => ({
      ...team,
      members: Array.isArray(team.members) ? team.members : [],
      memberRecords: (Array.isArray(team.members) ? team.members : [])
        .map((memberId) => employeesById.get(memberId))
        .filter((employee): employee is RawEmployeeRow => Boolean(employee)),
    })),
    contacts: (contactsRes.data as unknown as ADEPDocumentContact[]) || [],
    scenarios: (scenariosRes.data as unknown as ADEPDocumentScenario[]) || [],
    preventiveMeasures: (preventiveRes.data as unknown as ADEPDocumentMeasure[]) || [],
    equipmentInventory: (equipmentRes.data as unknown as ADEPDocumentEquipment[]) || [],
    drills: (drillsRes.data as unknown as ADEPDocumentDrill[]) || [],
    checklists: (checklistsRes.data as unknown as ADEPDocumentChecklist[]) || [],
  };
};

export const buildADEPDocumentViewModel = (
  bundle: ADEPDocumentBundle,
): ADEPDocumentViewModel => {
  const { plan, teams, contacts, scenarios, preventiveMeasures, equipmentInventory, drills, checklists } = bundle;
  const general = plan.plan_data.genel_bilgiler;
  const workplace = plan.plan_data.isyeri_bilgileri;
  const osgb = plan.plan_data.osgb_bilgileri;
  const documentInfo = plan.plan_data.dokuman_bilgileri;
  const responsible = plan.plan_data.gorevli_bilgileri;
  const appendixNotes = plan.plan_data.ekler;

  const preparerRows = (general.hazirlayanlar || [])
    .filter((item) => item.unvan || item.ad_soyad)
    .map((item) => ({
      role: item.unvan || "Hazırlayan",
      name: safeText(item.ad_soyad),
      duty: "Plan hazırlama ve gözden geçirme",
    }));

  const roleRows = roleOrder.map((entry) => {
    const value = responsible[entry.key];
    return {
      role: entry.label,
      name: safeText(value.ad_soyad),
      duty: safeText(value.unvan, entry.label),
      phone: safeText(value.telefon),
      meta: mapRoleMeta(value.belge_no, value.egitim_tarihi) || safeText(value.tc_no, ""),
    };
  });

  const teamRows = teams.map((team) => ({
    role: team.team_name,
    name: getTeamLeaderName(team),
    duty: safeText(team.team_leader?.job_title, "Ekip lideri"),
    phone: safeText(team.team_leader?.phone),
  }));

  const notes = [
    appendixNotes.organizasyon_semasi_notu,
    appendixNotes.tahliye_plani_notu,
    appendixNotes.kroki_notu,
    appendixNotes.ek_notlar,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return {
    cover: {
      title: safeText(documentInfo.plan_basligi, "ACİL DURUM PLANI"),
      subtitle: safeText(documentInfo.plan_alt_basligi, "ACİL DURUM EYLEM PLANI"),
      companyName: plan.company_name,
      preparedDate: formatDateOrDash(general.hazirlanma_tarihi || documentInfo.dokuman_tarihi || plan.created_at),
    },
    companySummaryRows: [
      { label: "İşyeri Ünvanı", value: safeText(plan.company_name) },
      { label: "Adres", value: safeText(workplace.adres) },
      { label: "SGK Sicil No", value: safeText(workplace.sgk_sicil_no) },
      { label: "Tehlike Sınıfı", value: safeText(workplace.tehlike_sinifi || plan.hazard_class) },
      { label: "Çalışan Sayısı", value: `${plan.employee_count || 0} kişi` },
      { label: "Hazırlama Tarihi", value: formatDateOrDash(general.hazirlanma_tarihi || plan.created_at) },
      { label: "Geçerlilik Tarihi", value: formatDateOrDash(general.gecerlilik_tarihi) },
      { label: "Ay / Yıl", value: safeText(documentInfo.ay_yil) },
      { label: "İşkolu", value: safeText(workplace.is_kolu || plan.sector) },
      { label: "Revizyon", value: safeText(general.revizyon_no) },
    ],
    osgbRows: [
      { label: "OSGB Ünvanı", value: safeText(osgb.unvan) },
      { label: "Adres", value: safeText(osgb.adres) },
      { label: "Telefon", value: safeText(osgb.telefon) },
      { label: "Web", value: safeText(osgb.web) },
      { label: "E-posta", value: safeText(osgb.email) },
    ],
    personnelRows: [...preparerRows, ...roleRows, ...teamRows],
    emergencyTeamRows: teams.map((team) => ({
      team: team.team_name,
      leader: getTeamLeaderName(team),
      memberCount: `${Array.isArray(team.members) ? team.members.length : 0} kişi`,
    })),
    contactRows: contacts.map((contact) => ({
      institution: contact.institution_name,
      phone: contact.phone_number,
    })),
    scenarioRows: scenarios.map((scenario) => ({
      title: scenario.hazard_type,
      summary: summarizeActionSteps(scenario.action_steps),
    })),
    appendixRows: [...ADEP_TEMPLATE_APPENDICES],
    legislation: plan.plan_data.mevzuat,
    meetingPoint: safeText(plan.plan_data.toplanma_yeri.aciklama, "Toplanma alanı belirtilmedi."),
    notes: [
      ...notes,
      preventiveMeasures.length
        ? `${preventiveMeasures.length} adet önleyici tedbir maddesi tanımlandı.`
        : "",
      equipmentInventory.length
        ? `${equipmentInventory.length} adet ekipman kaydı planla ilişkilendirildi.`
        : "",
      drills.length ? `${drills.length} adet tatbikat planı mevcut.` : "",
      checklists.length ? `${checklists.length} adet kontrol listesi maddesi mevcut.` : "",
    ].filter(Boolean),
    source: bundle,
  };
};
