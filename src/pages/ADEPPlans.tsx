
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Edit,
  Eye,
  FileText,
  LayoutTemplate,
  Layers3,
  MapPin,
  Phone,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const loadAdepWordGenerator = () => import("@/lib/adepOfficialDocx");

interface ADEPPlan {
  id: string;
  plan_name: string;
  company_name: string;
  sector?: string | null;
  hazard_class: string;
  employee_count: number;
  status: string;
  pdf_url: string | null;
  next_review_date: string | null;
  created_at: string;
  updated_at: string;
    plan_data?: {
    genel_bilgiler?: {
      hazirlayanlar?: Array<{
        unvan?: string;
        ad_soyad?: string;
      }>;
      hazirlanma_tarihi?: string;
      gecerlilik_tarihi?: string;
      revizyon_no?: string;
      revizyon_tarihi?: string;
    };
      isyeri_bilgileri?: {
        adres?: string;
        telefon?: string;
        tehlike_sinifi?: string;
        sgk_sicil_no?: string;
        is_kolu?: string;
      };
      osgb_bilgileri?: {
        unvan?: string;
        adres?: string;
        telefon?: string;
        web?: string;
        email?: string;
      };
      gorevli_bilgileri?: {
        isveren_vekil?: { ad_soyad?: string; unvan?: string; telefon?: string; tc_no?: string; belge_no?: string; egitim_tarihi?: string };
        isg_uzmani?: { ad_soyad?: string; unvan?: string; telefon?: string; tc_no?: string; belge_no?: string; egitim_tarihi?: string };
        isyeri_hekimi?: { ad_soyad?: string; unvan?: string; telefon?: string; tc_no?: string; belge_no?: string; egitim_tarihi?: string };
        calisan_temsilcisi?: { ad_soyad?: string; unvan?: string; telefon?: string; tc_no?: string; belge_no?: string; egitim_tarihi?: string };
        destek_elemani?: { ad_soyad?: string; unvan?: string; telefon?: string; tc_no?: string; belge_no?: string; egitim_tarihi?: string };
        bilgi_sahibi_kisi?: { ad_soyad?: string; unvan?: string; telefon?: string; tc_no?: string; belge_no?: string; egitim_tarihi?: string };
      };
      dokuman_bilgileri?: {
        plan_basligi?: string;
        plan_alt_basligi?: string;
        ay_yil?: string;
        dokuman_tarihi?: string;
        yenilenme_periyodu?: string;
      };
      ekler?: {
        kroki_notu?: string;
        tahliye_plani_notu?: string;
        organizasyon_semasi_notu?: string;
        ek_notlar?: string;
      };
      toplanma_yeri?: {
        aciklama?: string;
        harita_url?: string;
    };
    export_preferences?: {
      cover_style?: string;
    };
  } | null;
}

type PreviewTeam = {
  id: string;
  team_name: string;
  members: string[] | null;
  team_leader?: {
    first_name?: string | null;
    last_name?: string | null;
    job_title?: string | null;
    phone?: string | null;
  } | null;
};

type PreviewContact = {
  id: string;
  institution_name: string;
  phone_number: string;
};

type PreviewScenario = {
  id: string;
  hazard_type: string;
  action_steps: string;
};

type CoverMeta = {
  label: string;
  className: string;
  icon: typeof LayoutTemplate;
};

const eyebrowClass = "text-[11px] uppercase tracking-[0.18em] text-slate-400";
const cardTitleClass =
  "text-[1.08rem] font-semibold tracking-[-0.02em] text-white";
const ADEP_HERO_SKELETON_KEYS = ["hero-stat-1", "hero-stat-2", "hero-stat-3"] as const;
const ADEP_CARD_SKELETON_KEYS = [
  "plan-skeleton-1",
  "plan-skeleton-2",
  "plan-skeleton-3",
  "plan-skeleton-4",
  "plan-skeleton-5",
  "plan-skeleton-6",
] as const;

const PREVIEW_APPENDICES = [
  "Ek-1: Acil Durum Organizasyon Yapısı",
  "Ek-2: Acil Durum Telefon Numaraları",
  "Ek-3: İş Kazası Müdahale Planı",
  "Ek-4: Besin Zehirlenmesi Müdahale Planı",
  "Ek-5: Gaz Zehirlenmesi Müdahale Planı",
  "Ek-6: Yanık Müdahale Planı",
  "Ek-7: Elektrik Çarpması Müdahale Planı",
  "Ek-8: İşyeri Tahliye Planı",
  "Ek-9: İşyeri Krokisi",
] as const;

const getHazardTone = (hazardClass: string) => {
  if (hazardClass === "Çok Tehlikeli") {
    return {
      label: "Çok Tehlikeli",
      badge: "border-red-400/25 bg-red-400/10 text-red-100",
      bar: 92,
    };
  }

  if (hazardClass === "Tehlikeli") {
    return {
      label: "Tehlikeli",
      badge: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      bar: 72,
    };
  }

  return {
    label: "Az Tehlikeli",
    badge: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    bar: 44,
  };
};

const getStatusConfig = (status: string) => {
  if (status === "completed") {
    return {
      label: "Tamamlandı",
      className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      icon: CheckCircle2,
    };
  }

  if (status === "review") {
    return {
      label: "Gözden Geçirme",
      className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      icon: Clock3,
    };
  }

  if (status === "active") {
    return {
      label: "Aktif",
      className: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
      icon: Shield,
    };
  }

  return {
    label: "Taslak",
    className: "border-white/15 bg-white/10 text-slate-200",
    icon: FileText,
  };
};

const getCoverStyleMeta = (coverStyle?: string): CoverMeta => {
  switch (coverStyle) {
    case "classic":
      return {
        label: "Klasik Kapak",
        className: "border-slate-300/25 bg-slate-300/10 text-slate-100",
        icon: LayoutTemplate,
      };
    case "gold":
      return {
        label: "Altın Kapak",
        className: "border-amber-400/25 bg-amber-400/10 text-amber-100",
        icon: BadgeCheck,
      };
    case "blueprint":
      return {
        label: "Mavi Zarif",
        className: "border-blue-400/25 bg-blue-400/10 text-blue-100",
        icon: Layers3,
      };
    case "minimal":
      return {
        label: "Minimalist",
        className: "border-slate-400/25 bg-slate-400/10 text-slate-100",
        icon: FileText,
      };
    case "nature":
      return {
        label: "Yeşil Doğa",
        className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
        icon: Sparkles,
      };
    case "official-red":
      return {
        label: "Kırmızı Resmi",
        className: "border-red-400/25 bg-red-400/10 text-red-100",
        icon: Shield,
      };
    default:
      return {
        label: "Gölgeli",
        className: "border-orange-400/25 bg-orange-400/10 text-orange-100",
        icon: LayoutTemplate,
      };
  }
};

const formatDateOrDash = (value?: string | null, pattern: string = "dd.MM.yyyy") => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, pattern, { locale: tr });
};

const getTeamLeadName = (team: PreviewTeam) => {
  const firstName = team.team_leader?.first_name?.trim() || "";
  const lastName = team.team_leader?.last_name?.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Atanmadı";
};

const getTeamDutyLabel = (teamName: string) => {
  if (teamName.toLocaleLowerCase("tr-TR").includes("yangın")) {
    return "Söndürme ve ilk müdahale";
  }
  if (teamName.toLocaleLowerCase("tr-TR").includes("ilk yardım")) {
    return "İlk yardım ve sağlık yönlendirmesi";
  }
  if (teamName.toLocaleLowerCase("tr-TR").includes("arama")) {
    return "Arama, kurtarma ve tahliye desteği";
  }
  if (teamName.toLocaleLowerCase("tr-TR").includes("güvenlik")) {
    return "Güvenlik çevresi ve yönlendirme";
  }
  return "Acil durum görev ekibi";
};

export default function ADEPPlans() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plans, setPlans] = useState<ADEPPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPlan, setPreviewPlan] = useState<ADEPPlan | null>(null);
  const [companyLogos, setCompanyLogos] = useState<Record<string, string>>({});
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState("");
  const [previewTeams, setPreviewTeams] = useState<PreviewTeam[]>([]);
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);
  const [previewScenarios, setPreviewScenarios] = useState<PreviewScenario[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    void fetchPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchBrandingAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, plans]);

  useEffect(() => {
    if (!previewPlan?.id) {
      setPreviewTeams([]);
      setPreviewContacts([]);
      setPreviewScenarios([]);
      setPreviewLoading(false);
      return;
    }

    void fetchPreviewDetails(previewPlan.id);
  }, [previewPlan?.id]);

  const fetchPlans = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("adep_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPlans((data as ADEPPlan[]) || []);
    } catch (error: any) {
      console.error("Plan fetch error:", error);
      toast.error("Planlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (id: string) => {
    if (!confirm("Bu planı silmek istediğinizden emin misiniz?")) return;

    try {
      const { error } = await supabase
        .from("adep_plans")
        .update({ is_deleted: true })
        .eq("id", id);

      if (error) throw error;

      toast.success("Plan silindi");
      void fetchPlans();
    } catch (error: any) {
      toast.error("Plan silinemedi: " + error.message);
    }
  };

  const resolveMaybeSignedUrl = async (bucket: string, value?: string | null) => {
    if (!value) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    const { data } = await supabase.storage.from(bucket).createSignedUrl(value, 3600);
    return data?.signedUrl || value;
  };

  const fetchBrandingAssets = async () => {
    if (!user) return;

    try {
      const [profileResult, companiesResult] = await Promise.all([
        supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle(),
        supabase
          .from("companies")
          .select("name, logo_url")
          .eq("user_id", user.id)
          .not("logo_url", "is", null),
      ]);

      const logoMap: Record<string, string> = {};

      const companies = companiesResult.data || [];
      for (const company of companies) {
        const resolved = await resolveMaybeSignedUrl("company-logos", company.logo_url);
        if (resolved) {
          logoMap[company.name.toLocaleLowerCase("tr-TR")] = resolved;
        }
      }

      setCompanyLogos(logoMap);

      const organizationId = profileResult.data?.organization_id;
      if (organizationId) {
        const organizationResult = await supabase
          .from("organizations")
          .select("logo_url")
          .eq("id", organizationId)
          .maybeSingle();

        const resolvedOrgLogo = await resolveMaybeSignedUrl(
          "company-logos",
          organizationResult.data?.logo_url
        );
        setOrganizationLogoUrl(resolvedOrgLogo);
      }
    } catch (error) {
      console.warn("ADEP branding assets could not be loaded:", error);
    }
  };

  const fetchPreviewDetails = async (planId: string) => {
    setPreviewLoading(true);

    try {
      const [teamsResult, contactsResult, scenariosResult] = await Promise.all([
        supabase
          .from("adep_teams")
          .select(
            "id, team_name, members, team_leader:employees!team_leader_id(first_name, last_name, job_title, phone)"
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
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (contactsResult.error) throw contactsResult.error;
      if (scenariosResult.error) throw scenariosResult.error;

      setPreviewTeams((teamsResult.data as PreviewTeam[] | null) || []);
      setPreviewContacts((contactsResult.data as PreviewContact[] | null) || []);
      setPreviewScenarios((scenariosResult.data as PreviewScenario[] | null) || []);
    } catch (error) {
      console.error("ADEP preview details fetch error:", error);
      toast.error("ADEP önizleme detayları yüklenemedi");
      setPreviewTeams([]);
      setPreviewContacts([]);
      setPreviewScenarios([]);
    } finally {
      setPreviewLoading(false);
    }
  };

  const dashboardSummary = useMemo(() => {
    const total = plans.length;
    const completed = plans.filter((plan) => plan.status === "completed").length;
    const withPdf = plans.filter((plan) => !!plan.pdf_url).length;
    const critical = plans.filter(
      (plan) => plan.hazard_class === "Çok Tehlikeli"
    ).length;
    const upcomingReview = plans.filter((plan) => {
      if (!plan.next_review_date) return false;
      return new Date(plan.next_review_date).getTime() > Date.now();
    }).length;

    const dominantHazard = plans.reduce<Record<string, number>>((acc, plan) => {
      acc[plan.hazard_class] = (acc[plan.hazard_class] || 0) + 1;
      return acc;
    }, {});

    const topHazard =
      Object.entries(dominantHazard).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      "Veri bekleniyor";

    return { total, completed, withPdf, critical, upcomingReview, topHazard };
  }, [plans]);

  const previewPreparedByRows = useMemo(() => {
    const preparers = previewPlan?.plan_data?.genel_bilgiler?.hazirlayanlar || [];
    const roleRows = Object.entries(previewPlan?.plan_data?.gorevli_bilgileri || {})
      .filter(([, value]) =>
        [value?.ad_soyad, value?.unvan, value?.telefon, value?.belge_no]
          .some((item) => item?.trim()),
      )
      .map(
      ([roleKey, value]) => {
        const roleMap: Record<string, string> = {
          isveren_vekil: "İşveren / İşveren Vekili",
          isg_uzmani: "İş Güvenliği Uzmanı",
          isyeri_hekimi: "İşyeri Hekimi",
          calisan_temsilcisi: "Çalışan Temsilcisi",
          destek_elemani: "Destek Elemanı / Koordinatör",
          bilgi_sahibi_kisi: "Bilgi Sahibi Kişi",
        };

        return {
          role: roleMap[roleKey] || "Görevli",
          name: value?.ad_soyad?.trim() || "-",
          duty:
            [value?.unvan?.trim(), value?.telefon?.trim(), value?.belge_no?.trim()]
              .filter(Boolean)
              .join(" • ") || "Görev bilgisi bekleniyor",
        };
      },
    );

    return preparers
      .filter((item) => item?.unvan?.trim() || item?.ad_soyad?.trim())
      .map((item) => ({
        role: item.unvan?.trim() || "Hazırlayan",
        name: item.ad_soyad?.trim() || "-",
        duty: "Plan hazırlama ve gözden geçirme",
      }))
      .concat(roleRows);
  }, [previewPlan]);

  const previewTeamRows = useMemo(() => {
    return previewTeams.map((team) => ({
      role: team.team_name,
      name: getTeamLeadName(team),
      duty: `${getTeamDutyLabel(team.team_name)} • ${team.members?.length || 0} üye`,
    }));
  }, [previewTeams]);

  const previewPlanSections = useMemo(() => {
    return previewScenarios.slice(0, 4).map((scenario) => ({
      title: scenario.hazard_type,
      summary:
        scenario.action_steps
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join(" ")
          .slice(0, 220) || "Senaryo adımları plan içinde tanımlı.",
    }));
  }, [previewScenarios]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-8 shadow-[0_24px_60px_rgba(2,6,23,0.35)]">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.8fr]">
            <div className="space-y-4">
              <div className="h-10 w-72 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-5 w-96 animate-pulse rounded-xl bg-white/5" />
              <div className="grid gap-3 sm:grid-cols-3">
                {ADEP_HERO_SKELETON_KEYS.map((key) => (
                  <div
                    key={key}
                    className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]"
                  />
                ))}
              </div>
            </div>
            <div className="h-48 animate-pulse rounded-[24px] border border-white/10 bg-white/[0.03]" />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {ADEP_CARD_SKELETON_KEYS.map((key) => (
            <div
              key={key}
              className="h-80 animate-pulse rounded-[24px] border border-white/10 bg-slate-950/65"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="theme-page-readable space-y-8 pb-10">
        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] md:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_35%,transparent_70%,rgba(255,255,255,0.04))]" />
          <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.82fr] xl:items-end">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_30px_rgba(15,23,42,0.35)] backdrop-blur">
                  <AlertTriangle className="h-7 w-7 text-emerald-200" />
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                      ADEP Plan Merkezi
                    </Badge>
                    <Badge className="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10">
                      Kurumsal plan listesi
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                    Acil Durum Eylem Planları
                  </h1>
                  <p className="mt-2 text-sm text-slate-300">
                    Hazırlanan planları yönetin, PDF hazır durumlarını görün ve gözden geçirme baskısını tek panelden takip edin.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Toplam Plan</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{dashboardSummary.total}</div>
                  <div className="mt-1 text-xs text-slate-400">Aktif kurumsal plan envanteri</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">PDF Hazır</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{dashboardSummary.withPdf}</div>
                  <div className="mt-1 text-xs text-slate-400">Paylaşıma hazır çıktı adedi</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Kritik Risk</div>
                  <div className="mt-2 text-2xl font-semibold text-white">{dashboardSummary.critical}</div>
                  <div className="mt-1 text-xs text-slate-400">Çok tehlikeli sınıftaki planlar</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => navigate("/adep-plans/new")}
                  className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                >
                  <Plus className="h-4 w-4" />
                  Yeni ADEP Oluştur
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate("/adep-wizard")}
                >
                  <Sparkles className="h-4 w-4" />
                  Sihirbazı Aç
                </Button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur">
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Operasyon Özeti</div>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-400">Tamamlanan plan oranı</div>
                      <div className="mt-1 text-lg font-semibold text-white">
                        %{dashboardSummary.total ? Math.round((dashboardSummary.completed / dashboardSummary.total) * 100) : 0}
                      </div>
                    </div>
                    <CheckCircle2 className="h-6 w-6 text-emerald-300" />
                  </div>
                  <Progress
                    value={
                      dashboardSummary.total
                        ? (dashboardSummary.completed / dashboardSummary.total) * 100
                        : 0
                    }
                    className="mt-4 h-2.5 bg-white/10"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/8 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">Yoğun risk tonu</div>
                    <div className="mt-2 text-lg font-semibold text-white">{dashboardSummary.topHazard}</div>
                  </div>
                  <div className="rounded-2xl border border-amber-400/15 bg-amber-400/8 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200">Yaklaşan gözden geçirme</div>
                    <div className="mt-2 text-lg font-semibold text-white">{dashboardSummary.upcomingReview}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                  Kullanıcı burada hazırlanan tüm ADEP planlarını aynı dilde görür, PDF hazır durumunu ayırt eder ve hızlıca düzenleme veya inceleme akışına geçer.
                </div>
              </div>
            </div>
          </div>
        </div>
        {plans.length === 0 ? (
          <Card className="rounded-[26px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_24px_65px_rgba(2,6,23,0.32)]">
            <CardContent className="py-16">
              <div className="mx-auto max-w-xl text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <FileText className="h-10 w-10 text-slate-400" />
                </div>
                <h2 className="mt-6 text-2xl font-semibold text-white">Henüz ADEP oluşturulmadı</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  İlk planı sihirbazla kurup bu ekranda kurumsal liste görünümüne taşıyabiliriz.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => navigate("/adep-wizard")}
                    className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                  >
                    <Plus className="h-4 w-4" />
                    İlk Planı Oluştur
                  </Button>
                  <Button
                    variant="outline"
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => navigate("/adep-plans/new")}
                  >
                    <ArrowRight className="h-4 w-4" />
                    Hızlı Plan Formu
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
            {plans.map((plan) => {
              const hazard = getHazardTone(plan.hazard_class);
              const status = getStatusConfig(plan.status);
              const coverStyle = getCoverStyleMeta(
                plan.plan_data?.export_preferences?.cover_style
              );
              const StatusIcon = status.icon;
              const CoverIcon = coverStyle.icon;
              const logoSource =
                companyLogos[plan.company_name.toLocaleLowerCase("tr-TR")] ||
                organizationLogoUrl ||
                "";
              const reviewText = plan.next_review_date
                ? format(new Date(plan.next_review_date), "dd MMM yyyy", { locale: tr })
                : "Planlama bekleniyor";

              return (
                <Card
                  key={plan.id}
                  className="overflow-hidden rounded-[26px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_22px_55px_rgba(2,6,23,0.28)] transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/25 hover:shadow-[0_30px_80px_rgba(2,6,23,0.4)]"
                >
                  <CardHeader className="border-b border-white/10 bg-white/[0.03]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={`${status.className} border`}>
                            <StatusIcon className="mr-1 h-3.5 w-3.5" />
                            {status.label}
                          </Badge>
                          <Badge className={`${hazard.badge} border`}>{hazard.label}</Badge>
                          <Badge className={`${coverStyle.className} border`}>
                            <CoverIcon className="mr-1 h-3.5 w-3.5" />
                            {coverStyle.label}
                          </Badge>
                        </div>
                        <CardTitle className={cardTitleClass}>{plan.plan_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-sm text-slate-400">
                          <Building2 className="h-4 w-4 text-cyan-300" />
                          {plan.company_name}
                        </CardDescription>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
                        <div className={eyebrowClass}>Risk skoru</div>
                        <div className="mt-1 text-lg font-semibold text-white">{hazard.bar}/100</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-5 p-6">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className={eyebrowClass}>Çalışan</div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                          <Users className="h-4 w-4 text-cyan-300" />
                          {plan.employee_count} kişi
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <div className={eyebrowClass}>Son güncelleme</div>
                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                          <Clock3 className="h-4 w-4 text-violet-300" />
                          {format(new Date(plan.updated_at), "dd MMM yyyy", { locale: tr })}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className={eyebrowClass}>Gözden geçirme baskısı</div>
                        <Badge className="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10">
                          {plan.next_review_date ? "Planlı" : "Bekliyor"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <CalendarClock className="h-4 w-4 text-amber-300" />
                        {reviewText}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/6 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-200">
                        Sonraki önerilen aksiyon
                      </div>
                      <div className="mt-2 text-sm leading-6 text-slate-200">
                        {plan.pdf_url
                          ? "Plan PDF çıktısı hazır. Şimdi inceleme veya paylaşım akışına geçmek en doğru adım."
                          : "Planı açıp son kontrolleri tamamlayın, ardından PDF çıktısını üretin."}
                      </div>
                    </div>

                    {plan.pdf_url && (
                      <div className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className={eyebrowClass}>Belge kartı</div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              PDF hazır mini önizleme
                            </div>
                          </div>
                          <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                            Hazır
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPreviewPlan(plan)}
                          className="group relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/80 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-950"
                        >
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.16),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.12),_transparent_28%)] opacity-90" />
                          <div className="relative space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-200">
                                  ADEP PDF Kapağı
                                </div>
                                <div className="mt-2 text-base font-semibold text-white">
                                  {plan.plan_name}
                                </div>
                                <div className="mt-1 text-xs text-slate-400">
                                  {plan.company_name}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-right">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                                  Stil
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white">
                                  <CoverIcon className="h-4 w-4 text-cyan-200" />
                                  {coverStyle.label}
                                </div>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Durum</div>
                                <div className="mt-1 text-sm font-medium text-white">{status.label}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Tehlike</div>
                                <div className="mt-1 text-sm font-medium text-white">{hazard.label}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Gözden Geçirme</div>
                                <div className="mt-1 text-sm font-medium text-white">{reviewText}</div>
                              </div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Sektör</div>
                                <div className="mt-1 text-sm font-medium text-white">
                                  {plan.sector || "Belirtilmedi"}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Tehlike Sınıfı</div>
                                <div className="mt-1 text-sm font-medium text-white">{hazard.label}</div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-slate-400">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                Rev. 0
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                                Hazırlanma: {format(new Date(plan.created_at), "dd.MM.yyyy", { locale: tr })}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span>Gerçek belge hissiyle hızlı kontrol</span>
                              <span className="inline-flex items-center gap-1 text-cyan-200 transition group-hover:translate-x-0.5">
                                Önizlemeyi aç
                                <ArrowRight className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {plan.pdf_url && (
                        <Button
                          variant="outline"
                          className="gap-2 border-cyan-400/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/15 hover:text-cyan-50"
                          onClick={() => setPreviewPlan(plan)}
                        >
                          <Eye className="h-4 w-4" />
                          Mini Önizleme
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={() => navigate(`/adep-plans/${plan.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                        Görüntüle
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        onClick={() => navigate(`/adep-plans/${plan.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                        Düzenle
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                        disabled={!plan.pdf_url}
                        onClick={() => plan.pdf_url && window.open(plan.pdf_url, "_blank")}
                      >
                        <Download className="h-4 w-4" />
                        PDF Aç
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-red-400/20 bg-red-400/8 text-red-100 hover:bg-red-400/14 hover:text-red-50 sm:col-span-2"
                        onClick={() => void deletePlan(plan.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Sil
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!previewPlan} onOpenChange={(open) => !open && setPreviewPlan(null)}>
        <DialogContent className="max-w-4xl border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))] p-0 text-white shadow-[0_30px_90px_rgba(2,6,23,0.55)]">
          {previewPlan && (
            <>
              {(() => {
                const previewLogo =
                  companyLogos[previewPlan.company_name.toLocaleLowerCase("tr-TR")] ||
                  organizationLogoUrl ||
                  "";
                const workplaceInfo = previewPlan.plan_data?.isyeri_bilgileri;
                const generalInfo = previewPlan.plan_data?.genel_bilgiler;
                const osgbInfo = previewPlan.plan_data?.osgb_bilgileri;
                const documentInfo = previewPlan.plan_data?.dokuman_bilgileri;
                const meetingPoint = previewPlan.plan_data?.toplanma_yeri;
                const documentRows = [
                  { label: "İşyeri Ünvanı", value: previewPlan.company_name },
                  { label: "Adresi", value: workplaceInfo?.adres || "-" },
                  { label: "SGK Sicil No", value: workplaceInfo?.sgk_sicil_no || "-" },
                  { label: "İşkolu", value: workplaceInfo?.is_kolu || previewPlan.sector || "-" },
                  {
                    label: "Tehlike Sınıfı",
                    value: workplaceInfo?.tehlike_sinifi || previewPlan.hazard_class,
                  },
                  {
                    label: "Çalışan Sayısı",
                    value: `${previewPlan.employee_count || 0} kişi`,
                  },
                  {
                    label: "Hazırlama Tarihi",
                    value: formatDateOrDash(generalInfo?.hazirlanma_tarihi || previewPlan.created_at),
                  },
                  {
                    label: "Geçerlilik Tarihi",
                    value: formatDateOrDash(generalInfo?.gecerlilik_tarihi),
                  },
                  {
                    label: "Revizyon",
                    value: generalInfo?.revizyon_no || "Rev. 0",
                  },
                  {
                    label: "Ay / Yıl",
                    value: documentInfo?.ay_yil || "-",
                  },
                ];
                const personnelRows = [...previewPreparedByRows, ...previewTeamRows];
                return (
                  <>
              <DialogHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
                <DialogTitle className="text-xl font-semibold tracking-[-0.02em] text-white">
                  Belge Önizleme
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {previewPlan.plan_name} için Word ve PDF çıktısıyla uyumlu belge önizlemesi.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-0 lg:grid-cols-[0.84fr_1.16fr]">
                <div className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
                  <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(165deg,rgba(11,28,53,0.96),rgba(15,23,42,0.96)_55%,rgba(2,6,23,0.98))] p-6 shadow-[0_24px_65px_rgba(2,6,23,0.35)]">
                    <div className="flex items-center justify-between gap-3">
                      <Badge className="border-cyan-400/25 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                        Word Yapısı
                      </Badge>
                      <Badge className={`${getCoverStyleMeta(previewPlan.plan_data?.export_preferences?.cover_style).className} border`}>
                        {getCoverStyleMeta(previewPlan.plan_data?.export_preferences?.cover_style).label}
                      </Badge>
                    </div>

                    <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/95 p-2 shadow-[0_10px_24px_rgba(2,6,23,0.22)]">
                          {previewLogo ? (
                            <img
                              src={previewLogo}
                              alt="Şirket logosu"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <Building2 className="h-7 w-7 text-slate-500" />
                          )}
                        </div>
                        <div className="space-y-2 text-right">
                          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                            {generalInfo?.revizyon_no || "Rev. 0"}
                          </div>
                          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">
                            {formatDateOrDash(generalInfo?.hazirlanma_tarihi || previewPlan.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-10 text-center">
                        <div className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
                          Acil Durum Planı
                        </div>
                        <h3 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white">
                          {previewPlan.company_name}
                        </h3>
                        <p className="mt-4 text-sm uppercase tracking-[0.25em] text-slate-300">
                          Acil Durum Eylem Planı
                        </p>
                      </div>

                      <div className="mt-10 space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Plan Adı</div>
                          <div className="mt-1 text-sm font-medium text-white">{previewPlan.plan_name}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Tehlike Sınıfı</div>
                          <div className="mt-1 text-sm font-medium text-white">
                            {workplaceInfo?.tehlike_sinifi || previewPlan.hazard_class}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-slate-950/45 px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Toplanma Yeri</div>
                          <div className="mt-1 text-sm font-medium leading-6 text-white">
                            {meetingPoint?.aciklama || "Toplanma alanı henüz tanımlanmadı"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className={eyebrowClass}>Belge akışı</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          Word doküman yapısına uyarlanmış önizleme
                        </div>
                      </div>
                      <Badge className="border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                        {previewLoading ? "Yükleniyor" : "Hazır"}
                      </Badge>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 text-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.16)]">
                      <div className="space-y-6">
                        <section className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                            Kapak ve İşletme Bilgileri
                          </div>
                          <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
                            {documentRows.map((row) => (
                              <div key={row.label} className="bg-white px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                  {row.label}
                                </div>
                                <div className="mt-1 text-sm font-medium leading-6 text-slate-900">
                                  {row.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                            OSGB Bilgileri
                          </div>
                          <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
                            {[
                              { label: "OSGB Ünvanı", value: osgbInfo?.unvan || "-" },
                              { label: "Adres", value: osgbInfo?.adres || "-" },
                              { label: "Telefon", value: osgbInfo?.telefon || "-" },
                              { label: "Web", value: osgbInfo?.web || "-" },
                              { label: "E-posta", value: osgbInfo?.email || "-" },
                            ].map((row) => (
                              <div key={row.label} className="bg-white px-4 py-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                  {row.label}
                                </div>
                                <div className="mt-1 text-sm font-medium leading-6 text-slate-900">
                                  {row.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                            İşyeri ve Görevli Bilgileri
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                    Görev / Ünvan
                                  </th>
                                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                    Adı Soyadı
                                  </th>
                                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                                    Sorumluluk
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 bg-white">
                                {personnelRows.length > 0 ? (
                                  personnelRows.map((row) => (
                                    <tr key={`${row.role}-${row.name}`}>
                                      <td className="px-4 py-3 font-medium text-slate-900">{row.role}</td>
                                      <td className="px-4 py-3 text-slate-700">{row.name}</td>
                                      <td className="px-4 py-3 text-slate-700">{row.duty}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-4 py-4 text-slate-500" colSpan={3}>
                                      Hazırlayan veya ekip bilgisi eklenmemiş.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </section>

                        <section className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
                          <div className="rounded-2xl border border-slate-200">
                            <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                              Acil Durum Telefon Numaraları
                            </div>
                            <div className="space-y-2 p-4">
                              {previewContacts.length > 0 ? (
                                previewContacts.slice(0, 8).map((contact) => (
                                  <div
                                    key={contact.id}
                                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2"
                                  >
                                    <div className="flex items-start gap-3">
                                      <Phone className="mt-0.5 h-4 w-4 text-slate-500" />
                                      <span className="text-sm font-medium text-slate-800">
                                        {contact.institution_name}
                                      </span>
                                    </div>
                                    <span className="text-sm text-slate-600">{contact.phone_number}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                  Henüz acil durum iletişim rehberi tanımlanmamış.
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200">
                            <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                              Müdahale ve Tahliye Özeti
                            </div>
                            <div className="space-y-3 p-4">
                              {previewPlanSections.length > 0 ? (
                                previewPlanSections.map((section) => (
                                  <div key={section.title} className="rounded-xl border border-slate-200 p-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                                      {section.title}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                      {section.summary}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
                                  Senaryo verisi bulunamadı. Senaryolar eklendiğinde bu alan Word şablonundaki müdahale planı gibi dolar.
                                </div>
                              )}
                            </div>
                          </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200">
                          <div className="border-b border-slate-200 bg-slate-900 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white">
                            4.2. Ekler
                          </div>
                          <div className="grid gap-px bg-slate-200 md:grid-cols-2">
                            {PREVIEW_APPENDICES.map((item) => (
                              <div key={item} className="flex items-center gap-3 bg-white px-4 py-3">
                                <MapPin className="h-4 w-4 text-slate-400" />
                                <span className="text-sm text-slate-700">{item}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      onClick={async () => {
                        try {
                          const { downloadADEPWordDocument } = await loadAdepWordGenerator();
                          await downloadADEPWordDocument(previewPlan.id);
                        } catch (error: any) {
                          console.error(error);
                          toast.error(error?.message || "Word belgesi oluşturulamadı");
                        }
                      }}
                    >
                      <Download className="h-4 w-4" />
                      Word İndir
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                      onClick={() => previewPlan.pdf_url && window.open(previewPlan.pdf_url, "_blank")}
                      disabled={!previewPlan.pdf_url}
                    >
                      <Download className="h-4 w-4" />
                      PDF Aç
                    </Button>
                    <Button
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                      onClick={() => navigate(`/adep-plans/${previewPlan.id}`)}
                    >
                      <ArrowRight className="h-4 w-4" />
                      Plan Detayına Git
                    </Button>
                  </div>
                </div>
              </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
