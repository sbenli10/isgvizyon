import { supabase } from "@/integrations/supabase/client"
import type { ADEPData } from "@/types/adep"

export async function buildADEPPDFData(planId: string): Promise<ADEPData> {

  const { data: plan } = await supabase
    .from("adep_plans")
    .select("*")
    .eq("id", planId)
    .single()

  const { data: teamRows } = await supabase
    .from("adep_teams")
    .select("*")
    .eq("plan_id", planId)

  const { data: contacts } = await supabase
    .from("adep_emergency_contacts")
    .select("*")
    .eq("plan_id", planId)

  // =========================
  // EKİPLERİ DOĞRU MAP ET
  // =========================

  const formattedTeams = {
    sondurme: [],
    kurtarma: [],
    koruma: [],
    ilk_yardim: []
  }

  teamRows?.forEach((team) => {

    // team_name → hangi ekip olduğunu belirliyor
    const key =
      team.team_name === "Söndürme Ekibi" ? "sondurme" :
      team.team_name === "Arama-Kurtarma Ekibi" ? "kurtarma" :
      team.team_name === "Koruma Ekibi" ? "koruma" :
      team.team_name === "İlk Yardım Ekibi" ? "ilk_yardim" :
      null

    if (!key) return

    // members JSON → array olarak cast et
    const members = (team.members || []) as any[]

    members.forEach((m) => {
      formattedTeams[key].push({
        ad_soyad: m.ad_soyad || m.full_name || "",
        gorev: m.gorev || m.role || "",
        telefon: m.telefon || m.phone || "",
        email: m.email || "",
        sertifika: m.sertifika || m.certificate || "",
        egitim_tarihi: m.egitim_tarihi || m.training_date || ""
      })
    })
  })

  // =========================
  // İLETİŞİMLER
  // =========================

  const formattedContacts = contacts?.map((c) => ({
    type: c.institution_name.toLowerCase(),
    name: c.institution_name,
    phone: c.phone_number
  })) || []

  // =========================
  // PLAN DATA GÜVENLİ SPREAD
  // =========================

  const basePlanData = (plan?.plan_data || {}) as any

  return {
    ...basePlanData,
    teams: formattedTeams,
    emergency_contacts: formattedContacts
  } as ADEPData
}