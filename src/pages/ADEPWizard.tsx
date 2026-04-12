// src/pages/ADEPWizard.tsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import {
  Building2,
  BookOpen,
  Users,
  AlertTriangle,
  Phone,
  FileText,
  ChevronLeft,
  ChevronRight,
  Save,
  Download,
  Share2,
  Loader2,
  CheckCircle2,
  Shield,
  Package,
  Activity,
  ClipboardCheck,
  Network,
  Scale,
  MapPin,
  Sparkles,
  Eye,
  Clock3,
  Target,
  ShieldAlert,
  MailCheck,
  FileCheck2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

// ✅ Existing DB-first tabs
import ADEPGeneralInfo from "@/components/adep/ADEPGeneralInfo";
import ADEPLegislationTab from "@/components/adep/ADEPLegislationTab";
import ADEPTeamsTab from "@/components/adep/ADEPTeamsTab";
import ADEPScenariosTab from "@/components/adep/ADEPScenariosTab";
import ADEPContactsTab from "@/components/adep/ADEPContactsTab";

import ADEPPreventiveMeasuresTab from "@/components/adep/ADEPPreventiveMeasuresTab";
import ADEPEquipmentTab from "@/components/adep/ADEPEquipmentTab";
import ADEPDrillsTab from "@/components/adep/ADEPDrillsTab";
import ADEPChecklistsTab from "@/components/adep/ADEPChecklistsTab";
import ADEPRACITab from "@/components/adep/ADEPRACITab";
import ADEPLegalReferencesTab from "@/components/adep/ADEPLegalReferencesTab";
import ADEPRiskSourcesTab from "@/components/adep/ADEPRiskSourcesTab";
import { SendReportModal } from "@/components/SendReportModal";


// ✅ PDF Generator
import { generateADEPPDF } from "@/components/adep/ADEPPDFGenerator";

// ------------------------------------
// Types
// ------------------------------------
type HazardClass = "Az Tehlikeli" | "Tehlikeli" | "Çok Tehlikeli";
type ADEPStatus = "draft" | "completed";

type ADEPPlanData = {
  mevzuat: {
    amac: string;
    kapsam: string;
    dayanak: string;
    tanimlar: string;
  };
  genel_bilgiler: {
    hazirlayanlar: Array<{ unvan: string; ad_soyad: string }>;
    hazirlanma_tarihi: string;
    gecerlilik_tarihi: string;
    revizyon_no: string;
    revizyon_tarihi: string;
  };
  isyeri_bilgileri: {
    adres: string;
    telefon: string;
    tehlike_sinifi: string;
    sgk_sicil_no: string;
  };
  toplanma_yeri: {
    aciklama: string;
    harita_url: string;
  };
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
};

type ADEPPlanRow = {
  id?: string;
  user_id: string;
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
};

const DEFAULT_PLAN_DATA: ADEPPlanData = {
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
    hazirlayanlar: [{ unvan: "", ad_soyad: "" }],
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
  },
  toplanma_yeri: {
    aciklama: "",
    harita_url: "",
  },
  export_preferences: {
    cover_style: "shadow",
  },
};

const ADEP_COVER_STYLES = [
  {
    value: "classic",
    title: "Klasik",
    description: "Sade ve resmi çerçeve düzeni",
    accent: "border-slate-400",
  },
  {
    value: "gold",
    title: "Altın",
    description: "Kurumsal ve prestijli altın çerçeve",
    accent: "border-amber-400",
  },
  {
    value: "blueprint",
    title: "Mavi Zarif",
    description: "Kurumsal mavi çizgiler ve net başlık hiyerarşisi",
    accent: "border-blue-400",
  },
  {
    value: "minimal",
    title: "Minimalist",
    description: "Düşük mürekkep ve temiz baskı görünümü",
    accent: "border-slate-300",
  },
  {
    value: "nature",
    title: "Yeşil Doğa",
    description: "Çevre ve saha operasyonlarına uyumlu görünüm",
    accent: "border-emerald-400",
  },
  {
    value: "official-red",
    title: "Kırmızı Resmi",
    description: "Mevzuat ve acil durum vurgusu yüksek kapak",
    accent: "border-red-400",
  },
  {
    value: "shadow",
    title: "Gölgeli",
    description: "3D gölge etkili güçlü kapak görünümü",
    accent: "border-orange-400",
  },
] as const;

// ✅ UPDATED: 13 Steps (6 basic + 7 AI modules)
const STEPS = [
  // === Core ADEP ===
  { id: 1, label: "İşyeri", icon: Building2, category: "core" },
  { id: 2, label: "Mevzuat", icon: BookOpen, category: "core" },
  { id: 3, label: "Ekipler", icon: Users, category: "core" },
  { id: 4, label: "Senaryolar", icon: AlertTriangle, category: "core" },
  { id: 5, label: "İletişim", icon: Phone, category: "core" },

  // === AI Modules ===
  { id: 6, label: "Önleyici Tedbir", icon: Shield, category: "ai" },
  { id: 7, label: "Ekipman", icon: Package, category: "ai" },
  { id: 8, label: "Tatbikatlar", icon: Activity, category: "ai" },
  { id: 9, label: "Checklist", icon: ClipboardCheck, category: "ai" },
  { id: 10, label: "RACI", icon: Network, category: "ai" },
  { id: 11, label: "Mevzuat Ref.", icon: Scale, category: "ai" },
  { id: 12, label: "Risk Kaynakları", icon: MapPin, category: "ai" },

  // === Final ===
  { id: 13, label: "PDF", icon: FileText, category: "final" },
] as const;

export default function ADEPWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [progressLoading, setProgressLoading] = useState<boolean>(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [currentReportUrl, setCurrentReportUrl] = useState("");
  const [currentReportFilename, setCurrentReportFilename] = useState("");

  const [planId, setPlanId] = useState<string | null>(null);
  const [planRow, setPlanRow] = useState<ADEPPlanRow | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [moduleCounts, setModuleCounts] = useState<Record<string, number>>({});
  const [moduleCountsLoading, setModuleCountsLoading] = useState<boolean>(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>("");
  const [organizationLogoUrl, setOrganizationLogoUrl] = useState<string>("");

  const canUseWizard = !!user;

  // ------------------------------------
  // Helpers
  // ------------------------------------
  const ensureAuth = () => {
    if (!user) {
      toast.error("Oturum bulunamadı. Lütfen giriş yapın.");
      navigate("/auth");
      return false;
    }
    return true;
  };

  const safeMergePlanData = (incoming: any): ADEPPlanData => {
    const d = incoming || {};
    return {
      mevzuat: { ...DEFAULT_PLAN_DATA.mevzuat, ...(d.mevzuat || {}) },
      genel_bilgiler: {
        ...DEFAULT_PLAN_DATA.genel_bilgiler,
        ...(d.genel_bilgiler || {}),
        hazirlayanlar:
          Array.isArray(d?.genel_bilgiler?.hazirlayanlar) &&
          d.genel_bilgiler.hazirlayanlar.length > 0
            ? d.genel_bilgiler.hazirlayanlar
            : DEFAULT_PLAN_DATA.genel_bilgiler.hazirlayanlar,
      },
      isyeri_bilgileri: {
        ...DEFAULT_PLAN_DATA.isyeri_bilgileri,
        ...(d.isyeri_bilgileri || {}),
      },
      toplanma_yeri: {
        ...DEFAULT_PLAN_DATA.toplanma_yeri,
        ...(d.toplanma_yeri || {}),
      },
      export_preferences: {
        ...DEFAULT_PLAN_DATA.export_preferences!,
        ...(d.export_preferences || {}),
      },
    };
  };

  // ------------------------------------
  // Load existing plan
  // ------------------------------------
  useEffect(() => {
    if (!ensureAuth()) return;

    const id = searchParams.get("id");
    if (id) {
      void loadPlan(id);
    } else {
      const draft: ADEPPlanRow = {
        user_id: user!.id,
        plan_name: "",
        company_name: "",
        sector: null,
        hazard_class: "Tehlikeli",
        employee_count: 0,
        status: "draft",
        completion_percentage: 0,
        plan_data: DEFAULT_PLAN_DATA,
        next_review_date: null,
        pdf_url: null,
      };
      setPlanRow(draft);
      setPlanId(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      setOrganizationLogoUrl("");
      return;
    }

    let active = true;

    const loadOrganizationLogo = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id || !active) {
        if (active) setOrganizationLogoUrl("");
        return;
      }

      const { data: organization } = await supabase
        .from("organizations")
        .select("logo_url")
        .eq("id", profile.organization_id)
        .single();

      if (!active) return;

      const logo = organization?.logo_url;
      if (!logo) {
        setOrganizationLogoUrl("");
        return;
      }

      if (logo.startsWith("http") || logo.startsWith("data:")) {
        setOrganizationLogoUrl(logo);
        return;
      }

      const signed = await supabase.storage
        .from("company-logos")
        .createSignedUrl(logo, 3600);

      setOrganizationLogoUrl(signed.data?.signedUrl || "");
    };

    void loadOrganizationLogo();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const loadPlan = async (id: string) => {
    if (!ensureAuth()) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("adep_plans")
        .select("*")
        .eq("id", id)
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      if (!data) throw new Error("Plan bulunamadı");

      const merged: ADEPPlanRow = {
        ...(data as any),
        plan_data: safeMergePlanData((data as any).plan_data),
      };

      setPlanRow(merged);
      setPlanId((data as any).id);
      toast.success("Plan yüklendi");
    } catch (e: any) {
      console.error(e);
      toast.error("Plan yüklenemedi", {
        description: e.message || "Bilinmeyen hata",
      });
      navigate("/adep-plans");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------
  // Save plan
  // ------------------------------------
  const savePlan = async (opts?: {
    markCompleted?: boolean;
    silent?: boolean;
  }) => {
    if (!ensureAuth()) return null;
    if (!planRow) return null;

    const silent = !!opts?.silent;
    const markCompleted = !!opts?.markCompleted;

    if (!planRow.plan_name?.trim() || !planRow.company_name?.trim()) {
      if (!silent) toast.error("Plan adı ve firma adı zorunludur.");
      return null;
    }

    setSaving(true);
    if (!silent)
      toast.info(markCompleted ? "ADEP tamamlanıyor..." : "Kaydediliyor...");

    try {
      const payload: any = {
        user_id: user!.id,
        plan_name: planRow.plan_name,
        company_name: planRow.company_name,
        sector: planRow.sector ?? null,
        hazard_class: planRow.hazard_class,
        employee_count: planRow.employee_count,
        status: markCompleted ? "completed" : "draft",
        completion_percentage: planRow.completion_percentage ?? 0,
        plan_data: planRow.plan_data as any,
        next_review_date: planRow.next_review_date ?? null,
      };

      let saved: any;

      if (planId) {
        const { data, error } = await supabase
          .from("adep_plans")
          .update(payload)
          .eq("id", planId)
          .select()
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from("adep_plans")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        saved = data;

        setPlanId(saved.id);
        setSearchParams({ id: saved.id }, { replace: true });
      }

      const merged: ADEPPlanRow = {
        ...(saved as any),
        plan_data: safeMergePlanData(saved.plan_data),
      };
      setPlanRow(merged);

      if (!silent) toast.success("Kaydedildi");
      return saved as ADEPPlanRow;
    } catch (e: any) {
      console.error(e);
      if (!silent)
        toast.error("Kaydetme hatası", {
          description: e.message || "Bilinmeyen hata",
        });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // ------------------------------------
  // Progress calculation
  // ------------------------------------
  const refreshProgress = async (id: string, row: ADEPPlanRow) => {
    setProgressLoading(true);
    try {
      const baseMetaScore = (() => {
        let p = 0;
        if (row.plan_name?.trim()) p += 5;
        if (row.company_name?.trim()) p += 5;
        if (row.employee_count > 0) p += 3;
        if (row.hazard_class) p += 2;

        const pd = row.plan_data;
        if (pd?.isyeri_bilgileri?.adres?.trim()) p += 5;
        if (pd?.genel_bilgiler?.hazirlayanlar?.[0]?.ad_soyad?.trim()) p += 3;
        if (pd?.toplanma_yeri?.aciklama?.trim()) p += 2;

        const mevzuatFilled =
          !!pd?.mevzuat?.amac?.trim() &&
          !!pd?.mevzuat?.kapsam?.trim() &&
          !!pd?.mevzuat?.dayanak?.trim() &&
          !!pd?.mevzuat?.tanimlar?.trim();
        if (mevzuatFilled) p += 5;

        return Math.min(p, 30);
      })();

      // DB counts
      const [
        teamsRes,
        contactsRes,
        scenariosRes,
        preventiveRes,
        equipmentRes,
        drillsRes,
        checklistsRes,
        raciRes,
        legalRes,
        riskRes,
      ] = await Promise.all([
        supabase
          .from("adep_teams")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_emergency_contacts")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_scenarios")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_preventive_measures")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_equipment_inventory")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_drills")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_checklists")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_raci_matrix")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_legal_references")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
        supabase
          .from("adep_risk_sources")
          .select("id", { count: "exact", head: true })
          .eq("plan_id", id),
      ]);

      let p = baseMetaScore;

      // Core modules (40%)
      if ((teamsRes.count || 0) > 0) p += 10;
      if ((scenariosRes.count || 0) > 0) p += 15;
      if ((contactsRes.count || 0) > 0) p += 15;

      // AI modules (30%)
      if ((preventiveRes.count || 0) > 0) p += 5;
      if ((equipmentRes.count || 0) > 0) p += 5;
      if ((drillsRes.count || 0) > 0) p += 5;
      if ((checklistsRes.count || 0) > 0) p += 5;
      if ((raciRes.count || 0) > 0) p += 5;
      if ((legalRes.count || 0) > 0) p += 3;
      if ((riskRes.count || 0) > 0) p += 2;

      p = Math.max(0, Math.min(100, p));
      setProgress(p);

      if (row.id || id) {
        const targetId = (row.id as string) || id;
        await supabase
          .from("adep_plans")
          .update({ completion_percentage: p })
          .eq("id", targetId);
      }
    } catch (e) {
      console.error("refreshProgress error:", e);
    } finally {
      setProgressLoading(false);
    }
  };

  useEffect(() => {
    if (!planId || !planRow) {
      setProgress(0);
      return;
    }
    void refreshProgress(planId, planRow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, currentStep]);

  // ------------------------------------
  // Navigation
  // ------------------------------------
  const goToStep = async (next: number) => {
    if (next < 1 || next > 13) return;
    if (!ensureAuth()) return;
    if (!planRow) return;

    if (next > currentStep) {
      const needsInitialSave = !planId;
      const missingCritical =
        !planRow.plan_name?.trim() || !planRow.company_name?.trim();

      if (needsInitialSave && missingCritical) {
        toast.error(
          "Devam etmek için Plan Adı ve Firma bilgilerini girip kaydedin."
        );
        return;
      }

      if (needsInitialSave) {
        const saved = await savePlan({ silent: false });
        if (!saved?.id) return;
      } else {
        await savePlan({ silent: true });
      }
    }

    setCurrentStep(next);
  };

  const stepMeta = useMemo(() => {
    const item = STEPS.find((s) => s.id === currentStep);
    return item ?? STEPS[0];
  }, [currentStep]);

  const companyRiskSummary = useMemo(() => {
    const hazardScore =
      planRow?.hazard_class === "Çok Tehlikeli"
        ? 92
        : planRow?.hazard_class === "Tehlikeli"
        ? 74
        : 48;
    const employeeImpact =
      (planRow?.employee_count || 0) >= 250
        ? 10
        : (planRow?.employee_count || 0) >= 100
        ? 6
        : (planRow?.employee_count || 0) >= 50
        ? 4
        : 0;
    const score = Math.min(100, hazardScore + employeeImpact);
    const level =
      score >= 85 ? "Yüksek Risk" : score >= 65 ? "Kontrollü Risk" : "Düşük Risk";
    const recommendation =
      score >= 85
        ? "Senaryolar, ekipler ve iletişim adımları aynı turda tamamlanmalı."
        : score >= 65
        ? "Temel modüller tamamlandıktan sonra AI modülleriyle planı güçlendirin."
        : "Plan iskeleti sakin ilerleyebilir; final adımında PDF ve paylaşım akışı öne çıkar."
    return { score, level, recommendation };
  }, [planRow?.employee_count, planRow?.hazard_class]);

  const exportPreferences =
    planRow?.plan_data.export_preferences ||
    DEFAULT_PLAN_DATA.export_preferences!;

  useEffect(() => {
    if (!planId) {
      setModuleCounts({});
      setModuleCountsLoading(false);
      return;
    }

    let active = true;

    const loadCounts = async () => {
      setModuleCountsLoading(true);
      try {
        const tables = [
          { key: "teams", table: "adep_teams" },
          { key: "scenarios", table: "adep_scenarios" },
          { key: "contacts", table: "adep_emergency_contacts" },
          { key: "preventive", table: "adep_preventive_measures" },
          { key: "equipment", table: "adep_equipment_inventory" },
          { key: "drills", table: "adep_drills" },
          { key: "checklists", table: "adep_checklists" },
          { key: "raci", table: "adep_raci_matrix" },
          { key: "legal", table: "adep_legal_references" },
          { key: "riskSources", table: "adep_risk_sources" },
        ] as const;

        const results = await Promise.all(
          tables.map(async ({ key, table }) => {
            const { count } = await supabase
              .from(table)
              .select("*", { count: "exact", head: true })
              .eq("plan_id", planId);
            return [key, count || 0] as const;
          })
        );

        if (!active) return;
        setModuleCounts(Object.fromEntries(results));
      } finally {
        if (active) setModuleCountsLoading(false);
      }
    };

    void loadCounts();

    return () => {
      active = false;
    };
  }, [planId]);

  useEffect(() => {
    if (!user?.id || !planRow?.company_name?.trim()) {
      setCompanyLogoUrl("");
      return;
    }

    let active = true;

    const loadCompanyLogo = async () => {
      const { data } = await supabase
        .from("companies")
        .select("logo_url")
        .eq("user_id", user.id)
        .ilike("name", planRow.company_name.trim())
        .maybeSingle();

      if (!active) return;

      const logo = data?.logo_url;
      if (!logo) {
        setCompanyLogoUrl(organizationLogoUrl || "");
        return;
      }

      if (logo.startsWith("http") || logo.startsWith("data:")) {
        setCompanyLogoUrl(logo);
        return;
      }

      const signed = await supabase.storage
        .from("company-logos")
        .createSignedUrl(logo, 3600);

      setCompanyLogoUrl(signed.data?.signedUrl || organizationLogoUrl || "");
    };

    void loadCompanyLogo();

    return () => {
      active = false;
    };
  }, [organizationLogoUrl, planRow?.company_name, user?.id]);

  const stepInsight = useMemo(() => {
    const base = {
      title: stepMeta.label,
      eyebrow: "Adım rehberi",
      accent:
        stepMeta.category === "core"
          ? "from-cyan-500/20 to-blue-500/10 border-cyan-400/15"
          : stepMeta.category === "ai"
          ? "from-fuchsia-500/20 to-violet-500/10 border-fuchsia-400/15"
          : "from-emerald-500/20 to-teal-500/10 border-emerald-400/15",
    };

    switch (currentStep) {
      case 1:
        return {
          ...base,
          icon: Building2,
          summary: "Planın resmi üst kimliği burada kurulur. Sonraki tüm modüller bu bilgilerle anlam kazanır.",
          bullets: [
            "Plan adı ve firma bilgisi net olmalı.",
            "Tehlike sınıfı ve çalışan sayısı risk tonunu belirler.",
            "Adres ve SGK bilgisi PDF kapağında kurumsal görünür.",
          ],
          metricLabel: "Temel kurulum",
          metricValue: planRow?.company_name?.trim() ? "Hazır" : "Eksik",
          stats: [
            {
              label: "Plan adı",
              value: planRow?.plan_name?.trim() ? "Girildi" : "Bekliyor",
            },
            {
              label: "Firma",
              value: planRow?.company_name?.trim() ? "Hazır" : "Eksik",
            },
            {
              label: "Çalışan",
              value: `${planRow?.employee_count || 0}`,
            },
            {
              label: "Adres",
              value: planRow?.plan_data?.isyeri_bilgileri?.adres?.trim()
                ? "Hazır"
                : "Eksik",
            },
          ],
        };
      case 2:
        return {
          ...base,
          icon: Scale,
          summary: "Mevzuat dili burada netleşir. Bu bölüm planın resmi ve denetime uygun tonunu belirler.",
          bullets: [
            "Amaç, kapsam ve dayanak metni kısa ama net olmalı.",
            "Tanımlar bölümü ekipler için ortak dil oluşturur.",
            "Revizyon bilgileri güncellik hissi verir.",
          ],
          metricLabel: "Resmi yeterlilik",
          metricValue:
            planRow?.plan_data?.mevzuat?.amac?.trim() &&
            planRow?.plan_data?.mevzuat?.kapsam?.trim()
              ? "Hazır"
              : "Gözden geçir",
          stats: [
            {
              label: "Amaç",
              value: planRow?.plan_data?.mevzuat?.amac?.trim() ? "Var" : "Eksik",
            },
            {
              label: "Kapsam",
              value: planRow?.plan_data?.mevzuat?.kapsam?.trim() ? "Var" : "Eksik",
            },
            {
              label: "Revizyon",
              value:
                planRow?.plan_data?.genel_bilgiler?.revizyon_no || "Rev. 0",
            },
          ],
        };
      case 3:
        return {
          ...base,
          icon: Users,
          summary: "Ekipler ne kadar net tanımlanırsa acil durumda müdahale o kadar hızlı olur.",
          bullets: [
            "Ekip liderlerini görünür ve gerçek kişilerden seçin.",
            "Üye dağılımı vardiya mantığına uygun olmalı.",
            "Eksik ekip varsa final aşamada risk artar.",
          ],
          metricLabel: "Ekip seviyesi",
          metricValue: planId ? "Koordinasyon" : "Önce kaydet",
          stats: [
            {
              label: "Plan ID",
              value: planId ? "Hazır" : "Bekliyor",
            },
            {
              label: "Risk",
              value: companyRiskSummary.level,
            },
            {
              label: "Takip",
              value: planId ? "Aktif" : "Pasif",
            },
            {
              label: "Kayıt",
              value: `${moduleCounts.teams || 0} ekip`,
            },
          ],
        };
      case 4:
        return {
          ...base,
          icon: AlertTriangle,
          summary: "Senaryolar planın en kritik operasyon katmanıdır. En olası olaylar açık dille tanımlanmalı.",
          bullets: [
            "Yangın, deprem ve tahliye adımları net olsun.",
            "İlk 3 dakikada ne yapılacağı açık yazılsın.",
            "Toplanma alanı ve ekip sorumluluğu bağlansın.",
          ],
          metricLabel: "Müdahale netliği",
          metricValue: "Yüksek öncelik",
          stats: [
            {
              label: "Risk tonu",
              value: planRow?.hazard_class || "Tanımsız",
            },
            {
              label: "Toplanma",
              value: planRow?.plan_data?.toplanma_yeri?.aciklama?.trim()
                ? "Tanımlı"
                : "Eksik",
            },
            {
              label: "Hazırlık",
              value: progress >= 35 ? "İlerliyor" : "Başlangıç",
            },
            {
              label: "Kayıt",
              value: `${moduleCounts.scenarios || 0} senaryo`,
            },
          ],
        };
      case 5:
        return {
          ...base,
          icon: Phone,
          summary: "İletişim rehberi, planın kriz anındaki hızını belirler. Eksik numara en büyük operasyon açığıdır.",
          bullets: [
            "Dahili ve harici numaraları çift kontrol edin.",
            "Kurum dışı acil numaraları güncel tutun.",
            "Ekip lideri erişimi öne çıkarılsın.",
          ],
          metricLabel: "İletişim hazırlığı",
          metricValue: "Hız odaklı",
          stats: [
            {
              label: "Telefon",
              value: planRow?.plan_data?.isyeri_bilgileri?.telefon?.trim()
                ? "Hazır"
                : "Eksik",
            },
            {
              label: "Erişim",
              value: planId ? "Kayıtlı" : "Taslak",
            },
            {
              label: "Senaryo",
              value: progress >= 45 ? "Destekli" : "Bekliyor",
            },
            {
              label: "Kayıt",
              value: `${moduleCounts.contacts || 0} rehber`,
            },
          ],
        };
      case 13:
        return {
          ...base,
          icon: FileCheck2,
          summary: "Final adımı artık gerçek belge hazırlığıdır. Kullanıcı bu aşamada kurumsal PDF'yi kontrol eder ve paylaşır.",
          bullets: [
            "Kapak stili seçimi belge algısını doğrudan etkiler.",
            "Firma adı ve üst bilgiler PDF'de görünür.",
            "Paylaşım öncesi plan doluluk oranı son kez gözden geçirilir.",
          ],
          metricLabel: "Çıktı hazırlığı",
          metricValue: `%${progress}`,
          stats: [
            {
              label: "Kapak",
              value:
                ADEP_COVER_STYLES.find(
                  (style) => style.value === exportPreferences.cover_style
                )?.title || "Gölgeli",
            },
            {
              label: "PDF",
              value: planId ? "Üretilebilir" : "Kaydet gerekli",
            },
            {
              label: "Paylaşım",
              value: currentReportUrl ? "Hazır" : "Bekliyor",
            },
            {
              label: "AI kayıtları",
              value: `${(moduleCounts.preventive || 0) + (moduleCounts.equipment || 0) + (moduleCounts.drills || 0) + (moduleCounts.checklists || 0) + (moduleCounts.raci || 0) + (moduleCounts.legal || 0) + (moduleCounts.riskSources || 0)}`,
            },
          ],
        };
      default:
        return {
          ...base,
          icon: Sparkles,
          summary: "Bu adım planı operasyonel açıdan güçlendirir. AI modülleri final çıktının kalitesini belirgin şekilde yükseltir.",
          bullets: [
            "Önerileri gerçek saha düzenine göre doğrulayın.",
            "Kayıtlar ileride denetim çıktısına dönüşür.",
            "Eksik alanlar final PDF görünümünü doğrudan etkiler.",
          ],
          metricLabel: "AI katkısı",
          metricValue: "Aktif",
          stats: [
            {
              label: "AI modülü",
              value: `#${currentStep - 5}`,
            },
            {
              label: "Firma riski",
              value: companyRiskSummary.level,
            },
            {
              label: "İlerleme",
              value: progress >= 60 ? "Güçlü" : "Gelişiyor",
            },
            {
              label: "Kayıt",
              value:
                currentStep === 6
                  ? `${moduleCounts.preventive || 0} tedbir`
                  : currentStep === 7
                  ? `${moduleCounts.equipment || 0} ekipman`
                  : currentStep === 8
                  ? `${moduleCounts.drills || 0} tatbikat`
                  : currentStep === 9
                  ? `${moduleCounts.checklists || 0} checklist`
                  : currentStep === 10
                  ? `${moduleCounts.raci || 0} görev`
                  : currentStep === 11
                  ? `${moduleCounts.legal || 0} referans`
                  : `${moduleCounts.riskSources || 0} kaynak`,
            },
          ],
        };
    }
  }, [
    companyRiskSummary.level,
    currentReportUrl,
    currentStep,
    exportPreferences.cover_style,
    moduleCounts.checklists,
    moduleCounts.contacts,
    moduleCounts.drills,
    moduleCounts.equipment,
    moduleCounts.legal,
    moduleCounts.preventive,
    moduleCounts.raci,
    moduleCounts.riskSources,
    moduleCounts.scenarios,
    moduleCounts.teams,
    planId,
    planRow?.company_name,
    planRow?.employee_count,
    planRow?.hazard_class,
    planRow?.plan_data?.genel_bilgiler?.revizyon_no,
    planRow?.plan_data?.isyeri_bilgileri?.adres,
    planRow?.plan_data?.isyeri_bilgileri?.telefon,
    planRow?.plan_data?.mevzuat?.amac,
    planRow?.plan_data?.mevzuat?.kapsam,
    planRow?.plan_data?.toplanma_yeri?.aciklama,
    planRow?.plan_name,
    progress,
    stepMeta,
  ]);

  const pdfPreviewBlocks = useMemo(
    () => [
      {
        label: "Kapak",
        value: planRow?.company_name || "Firma adı",
        icon: Building2,
      },
      {
        label: "Revizyon",
        value: planRow?.plan_data?.genel_bilgiler?.revizyon_no || "Rev. 0",
        icon: Clock3,
      },
      {
        label: "Risk tonu",
        value: planRow?.hazard_class || "Tehlike sınıfı",
        icon: ShieldAlert,
      },
      {
        label: "Paylaşım",
        value: currentReportUrl ? "Rapor hazır" : "Hazırlanacak",
        icon: MailCheck,
      },
    ],
    [
      currentReportUrl,
      planRow?.company_name,
      planRow?.hazard_class,
      planRow?.plan_data?.genel_bilgiler?.revizyon_no,
    ]
  );

  const coverPreviewClass = useMemo(() => {
    const style = exportPreferences.cover_style || "shadow";
    switch (style) {
      case "classic":
        return "border-slate-300 bg-[linear-gradient(180deg,#ffffff,#f5f5f5)]";
      case "gold":
        return "border-amber-300 bg-[linear-gradient(180deg,#fff7db,#fff1b8)]";
      case "blueprint":
        return "border-blue-300 bg-[linear-gradient(180deg,#eff6ff,#dbeafe)]";
      case "minimal":
        return "border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fafafa)]";
      case "nature":
        return "border-emerald-300 bg-[linear-gradient(180deg,#ecfdf5,#d1fae5)]";
      case "official-red":
        return "border-red-300 bg-[linear-gradient(180deg,#fef2f2,#fee2e2)]";
      default:
        return "border-orange-300 bg-[linear-gradient(180deg,#fff7ed,#ffedd5)]";
    }
  }, [exportPreferences.cover_style]);

  const generateADEPReportAndOpenEmail = async () => {
    if (!planId || !planRow || !user?.id) {
      toast.error("Rapor oluşturmak için plan kaydedilmiş olmalı.");
      return;
    }

    setSaving(true);
    try {
      await savePlan({
        silent: true,
        markCompleted: progress >= 100,
      });

      toast.info("PDF hazırlanıyor...");
      const pdfDoc = await generateADEPPDF(planId);
      const pdfBlob = pdfDoc.output("blob");

      const safeCompanyName = (planRow.company_name || "Firma").replace(
        /[^a-z0-9]/gi,
        "_"
      );
      const fileName = `ADEP_${safeCompanyName}_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`;
      const storagePath = `adep-reports/${user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("reports")
        .upload(storagePath, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("reports")
        .getPublicUrl(uploadData.path);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Rapor bağlantısı oluşturulamadı.");
      }

      setCurrentReportUrl(publicUrlData.publicUrl);
      setCurrentReportFilename(fileName);
      setSendModalOpen(true);
      toast.success("Rapor e-posta gönderimi için hazır.");
    } catch (e: any) {
      console.error("ADEP report prepare error:", e);
      toast.error("Rapor e-posta için hazırlanamadı", {
        description: e.message || "Bilinmeyen hata",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateExportPreferences = (
    patch: Partial<NonNullable<ADEPPlanData["export_preferences"]>>
  ) => {
    setPlanRow((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan_data: {
          ...prev.plan_data,
          export_preferences: {
            ...DEFAULT_PLAN_DATA.export_preferences!,
            ...(prev.plan_data.export_preferences || {}),
            ...patch,
          },
        },
      };
    });
  };

  // ------------------------------------
  // Render step content
  // ------------------------------------
  const renderStep = () => {
    if (!planRow) return null;

    switch (currentStep) {
      case 1:
        return (
          <ADEPGeneralInfo
            data={{
              plan_name: planRow.plan_name,
              company_name: planRow.company_name,
              hazard_class: planRow.hazard_class,
              employee_count: planRow.employee_count,
              sector: planRow.sector || "",
            }}
            planData={planRow.plan_data}
            onChange={(field: string, value: any) => {
              setPlanRow((prev) => {
                if (!prev) return prev;
                const next = { ...prev } as ADEPPlanRow;
                (next as any)[field] = value;
                return next;
              });
            }}
            onPlanDataChange={(section: string, data: any) => {
              setPlanRow((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  plan_data: {
                    ...prev.plan_data,
                    [section]: data,
                  },
                };
              });
            }}
          />
        );

      case 2:
        return (
          <ADEPLegislationTab
            data={planRow.plan_data.mevzuat}
            onChange={(newMevzuat) => {
              setPlanRow((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  plan_data: {
                    ...prev.plan_data,
                    mevzuat: newMevzuat,
                  },
                };
              });
            }}
          />
        );

      case 3:
        return <ADEPTeamsTab planId={planId || undefined} />;

      case 4:
        return <ADEPScenariosTab planId={planId || undefined} />;

      case 5:
        return <ADEPContactsTab planId={planId || undefined} />;

      // ✅ AI Modules
      case 6:
        return <ADEPPreventiveMeasuresTab planId={planId || undefined} />;

      case 7:
        return <ADEPEquipmentTab planId={planId || undefined} />;

      case 8:
        return <ADEPDrillsTab planId={planId || undefined} />;

      case 9:
        return <ADEPChecklistsTab planId={planId || undefined} />;

      case 10:
        return <ADEPRACITab planId={planId || undefined} />;

      case 11:
        return <ADEPLegalReferencesTab planId={planId || undefined} />;

      case 12:
        return <ADEPRiskSourcesTab planId={planId || undefined} />;

      // ✅ PDF Step
      case 13:
        return (
          <div className="space-y-6">
            {/* AI Banner */}
            <Card className="overflow-hidden rounded-[24px] border-purple-400/20 bg-[linear-gradient(135deg,rgba(168,85,247,0.16),rgba(59,130,246,0.12))] shadow-[0_20px_50px_rgba(15,23,42,0.18)]">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/20">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-1 text-lg font-semibold text-white">
                      AI Destekli Kurumsal ADEP
                    </h3>
                    <p className="text-sm leading-6 text-slate-200">
                      7 AI modülü ile zenginleştirilmiş, ISO 45001 uyumlu, denetim
                      hazır Acil Durum Eylem Planı. Tüm veriler veritabanında
                      tutulur ve PDF her zaman güncel veriden üretilir.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress Summary */}
            <Card className="rounded-[24px] border-white/10 bg-slate-950/55 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                  Plan Durumu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-400">Plan Adı</div>
                    <div className="font-semibold text-white">
                      {planRow.plan_name || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-slate-400">Firma</div>
                    <div className="font-semibold text-white">
                      {planRow.company_name || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-slate-400">
                      Tamamlanma
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="h-2 flex-1" />
                      <Badge
                        variant={progress >= 100 ? "default" : "secondary"}
                      >
                        {progressLoading ? "..." : `%${progress}`}
                      </Badge>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="text-slate-200">Core Modules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-slate-200">AI Modules</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-slate-200">DB-First</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-orange-500" />
                    <span className="text-slate-200">ISO 45001</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border-white/10 bg-slate-950/55 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5 text-orange-500" />
                  Kapak Çerçevesi
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Kurumsal PDF kapağında kullanılacak çerçeve stilini seçin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {ADEP_COVER_STYLES.map((style) => {
                    const active = exportPreferences.cover_style === style.value;
                    return (
                      <button
                        key={style.value}
                        type="button"
                        onClick={() => updateExportPreferences({ cover_style: style.value })}
                        className={[
                          "rounded-2xl border p-4 text-left transition-all",
                          active
                            ? `bg-orange-500/5 shadow-lg shadow-orange-500/10 ${style.accent}`
                            : "border-white/10 bg-white/[0.03] hover:border-orange-300/40 hover:bg-white/[0.06]",
                        ].join(" ")}
                      >
                        <div className="mb-4 flex h-28 items-center justify-center rounded-xl bg-gradient-to-b from-slate-900 to-slate-800/70">
                          <div
                            className={[
                              "h-20 w-14 rounded-md border bg-white shadow-sm",
                              style.accent,
                            ].join(" ")}
                          />
                        </div>
                        <div className="text-sm font-semibold text-white">{style.title}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {style.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-sm text-slate-400">
                  Seçilen stil:{" "}
                  <span className="font-medium text-white">
                    {ADEP_COVER_STYLES.find(
                      (style) => style.value === exportPreferences.cover_style
                    )?.title || "Gölgeli"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[24px] border-white/10 bg-slate-950/55 shadow-[0_18px_40px_rgba(2,6,23,0.18)]">
              <CardHeader className="border-b border-white/10 bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Eye className="h-5 w-5 text-cyan-300" />
                      Belge Önizleme Kartı
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      PDF'ye gitmeden önce kapak ve üst bilgi dilini hızlıca kontrol edin.
                    </CardDescription>
                  </div>
                  <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                    Önizleme
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="rounded-[28px] border border-slate-200/70 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
                  <div className="flex items-start justify-between gap-6 border-b border-slate-300 pb-5">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Acil Durum Eylem Planı
                      </div>
                      <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                        {planRow.plan_name || "Kurumsal ADEP Planı"}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {planRow.company_name || "Firma adı"} • {planRow.hazard_class} •{" "}
                        {planRow.employee_count} çalışan
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-right">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Belge Durumu</div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {progress >= 100 ? "Hazır" : "Taslak"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {pdfPreviewBlocks.map((block) => {
                      const Icon = block.icon;
                      return (
                        <div
                          key={block.label}
                          className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
                        >
                          <div className="flex items-center gap-2 text-slate-500">
                            <Icon className="h-4 w-4" />
                            <span className="text-[11px] uppercase tracking-[0.18em]">
                              {block.label}
                            </span>
                          </div>
                          <div className="mt-3 text-sm font-semibold text-slate-900">
                            {block.value}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className={`rounded-[24px] border p-4 shadow-sm ${coverPreviewClass}`}>
                      <div className="flex h-full min-h-[250px] flex-col justify-between rounded-[18px] border border-black/5 bg-white/85 p-4">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                                Kapak Önizleme
                              </div>
                              <div className="mt-3 h-1.5 w-16 rounded-full bg-slate-900/70" />
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                              {companyLogoUrl ? (
                                <img
                                  src={companyLogoUrl}
                                  alt="Firma logosu"
                                  className="max-h-8 max-w-8 object-contain"
                                />
                              ) : (
                                <Building2 className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                          </div>
                          <div className="mt-3 inline-flex rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                            {planRow.plan_data.genel_bilgiler.revizyon_no || "Rev. 0"}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                            ADEP
                          </div>
                          <div className="mt-3 text-lg font-bold leading-tight text-slate-900">
                            {planRow.company_name || "Firma Adı"}
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            {ADEP_COVER_STYLES.find(
                              (style) => style.value === exportPreferences.cover_style
                            )?.title || "Gölgeli"} kapak stili
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 rounded-full bg-slate-900/15" />
                          <div className="h-2 rounded-full bg-slate-900/10" />
                          <div className="h-2 w-2/3 rounded-full bg-slate-900/10" />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.25fr_0.9fr]">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Bölüm Önizlemesi
                        </div>
                        <div className="mt-4 space-y-3">
                          {[
                            "Kapak ve revizyon alanı",
                            "Ekipler ve sorumluluk dağılımı",
                            "Senaryolar ve iletişim akışı",
                            "Tatbikat, checklist ve risk kaynakları",
                          ].map((item, index) => (
                            <div
                              key={item}
                              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                              <span className="text-sm text-slate-700">{item}</span>
                              <span className="text-xs font-semibold text-slate-500">
                                Bölüm {index + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5">
                        <div className="flex items-center gap-2 text-cyan-700">
                          <Target className="h-4 w-4" />
                          <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                            Son kontrol
                          </span>
                        </div>
                        <div className="mt-4 space-y-3 text-sm text-slate-700">
                          <p>Firma adı, plan adı ve revizyon bilgisi belge kapağında görünür.</p>
                          <p>Kapak çerçevesi seçimi çıktı tonunu doğrudan etkiler.</p>
                          <p>E-posta akışı başlatıldığında bu PDF aynı görünümle paylaşılır.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card className="overflow-hidden rounded-[26px] border-cyan-400/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_24px_60px_rgba(2,6,23,0.26)]">
              <CardHeader className="border-b border-white/10 bg-white/[0.03]">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                    Final Çıktı Merkezi
                  </Badge>
                  <Badge className="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10">
                    PDF • E-posta • Arşiv
                  </Badge>
                </div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5" />
                  PDF Oluşturma
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Tüm modüller veritabanından çekilir. PDF her zaman güncel
                  veriden üretilir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Çıktı Hazırlığı</div>
                    <div className="mt-2 text-lg font-semibold text-white">%{progress}</div>
                    <div className="mt-1 text-xs text-slate-400">Tamamlanan modül oranı</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Firma</div>
                    <div className="mt-2 text-lg font-semibold text-white">{planRow.company_name || "—"}</div>
                    <div className="mt-1 text-xs text-slate-400">PDF üst bilgisinde kullanılacak</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Paylaşım</div>
                    <div className="mt-2 text-lg font-semibold text-white">Hazır</div>
                    <div className="mt-1 text-xs text-slate-400">Mail akışı ve arşiv senaryosu</div>
                  </div>
                </div>
                {!planId && (
                  <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
                    PDF için önce planın kaydedilmesi gerekir.
                  </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row">
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    disabled={
                      saving ||
                      !planRow.plan_name?.trim() ||
                      !planRow.company_name?.trim()
                    }
                    onClick={async () => {
                      const saved = await savePlan({
                        silent: false,
                        markCompleted: progress >= 100,
                      });
                      if (saved?.id) {
                        await refreshProgress(saved.id, {
                          ...planRow,
                          id: saved.id,
                        });
                      }
                    }}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {progress >= 100 ? "Tamamla ve Kaydet" : "Kaydet"}
                  </Button>

                  <Button
                    size="lg"
                    className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    disabled={saving || !planId}
                    onClick={async () => {
                      if (!planId) return;
                      await savePlan({
                        silent: true,
                        markCompleted: progress >= 100,
                      });

                      toast.info("PDF hazırlanıyor...");
                      try {
                        await generateADEPPDF(planId);
                        toast.success("PDF indirildi");
                      } catch (e: any) {
                        console.error(e);
                        toast.error("PDF oluşturma hatası", {
                          description: e.message || "Bilinmeyen hata",
                        });
                      }
                    }}
                  >
                    <Download className="h-4 w-4" />
                    PDF İndir
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="gap-2 border border-cyan-400/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/15"
                    disabled={saving || !planId}
                    onClick={generateADEPReportAndOpenEmail}
                  >
                    <Share2 className="h-4 w-4" />
                    PDF Oluştur ve Gönder
                  </Button>
                </div>

                <div className="space-y-1 text-xs text-slate-400">
                  <div>
                    ✓ 13 modül • DB-first architecture • Türkçe Inter font
                  </div>
                  <div>
                    ✓ Ekipler, senaryolar, iletişim, AI modülleri ilgili
                    tablolardan çekilir
                  </div>
                  <div>✓ PDF her zaman güncel veritabanı verisiyle üretilir</div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  // ------------------------------------
  // Main Render
  // ------------------------------------
  if (!canUseWizard) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Devam etmek için giriş yapmalısınız.
        </CardContent>
      </Card>
    );
  }

  if (loading || !planRow) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Yükleniyor...
        </CardContent>
      </Card>
    );
  }

  const StepIcon = stepMeta.icon;
  const coreSteps = STEPS.filter((s) => s.category === "core");
  const aiSteps = STEPS.filter((s) => s.category === "ai");
  const finalSteps = STEPS.filter((s) => s.category === "final");

  return (
    <div className="space-y-8 pb-10">
      {/* ✅ Premium Header */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.18),_transparent_32%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] p-6 shadow-[0_28px_80px_rgba(2,6,23,0.45)] md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.06),transparent_30%,transparent_70%,rgba(255,255,255,0.04))]" />
        <div className="absolute -top-14 right-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative grid gap-6 xl:grid-cols-[1.4fr_0.85fr] xl:items-end">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-[0_12px_30px_rgba(15,23,42,0.35)] backdrop-blur">
                <StepIcon className="h-7 w-7 text-cyan-200" />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                    ADEP Operasyon Merkezi
                  </Badge>
                  <Badge className="border-white/10 bg-white/8 text-slate-200 hover:bg-white/8">
                    Kurumsal plan sihirbazı
                  </Badge>
                </div>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
                  Acil Durum Eylem Planı
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                  AI Destekli Kurumsal ADEP Sihirbazı •{" "}
                  <span className="font-semibold text-white">
                    {planRow.plan_name?.trim() ? planRow.plan_name : "Yeni Plan"}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1.5 border-white/10 bg-white/10 text-white hover:bg-white/10">
                <Building2 className="h-3 w-3 text-cyan-200" />
                {planRow.company_name || "Firma Adı"}
              </Badge>
              <Badge className="gap-1.5 border-orange-400/25 bg-orange-400/10 text-orange-100 hover:bg-orange-400/10">
                <AlertTriangle className="h-3 w-3" />
                {planRow.hazard_class}
              </Badge>
              <Badge className="gap-1.5 border-emerald-400/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                <Users className="h-3 w-3" />
                {planRow.employee_count} Çalışan
              </Badge>
              {planId && (
                <Badge className="gap-1.5 border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100 hover:bg-fuchsia-400/10">
                  <FileText className="h-3 w-3" />
                  {planId.slice(0, 8)}...
                </Badge>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Aktif Adım</div>
                <div className="mt-2 text-lg font-semibold text-white">{stepMeta.label}</div>
                <div className="mt-1 text-xs text-slate-400">Kurumsal akışta şu an işlenen modül</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Tamamlanma</div>
                <div className="mt-2 text-lg font-semibold text-white">%{progress}</div>
                <div className="mt-1 text-xs text-slate-400">Plan genel doluluk seviyesi</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Durum</div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {progress >= 100 ? "Tamamlandı" : "Çalışma sürüyor"}
                </div>
                <div className="mt-1 text-xs text-slate-400">PDF ve paylaşım öncesi operasyon görünümü</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/65 p-5 shadow-[0_20px_50px_rgba(2,6,23,0.35)] backdrop-blur">
            <div className="min-w-[260px]">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span className="font-medium uppercase tracking-[0.18em]">Tamamlanma Durumu</span>
                <span className="font-semibold text-white">
                  {progressLoading ? "Hesaplanıyor..." : `%${progress}`}
                </span>
              </div>
              <Progress value={progress} className="h-2.5 bg-white/10" />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge
                className={[
                  "gap-1.5 border px-3 py-1",
                  progress >= 100
                    ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-100"
                    : "border-amber-400/25 bg-amber-400/15 text-amber-100",
                ].join(" ")}
              >
                {progress >= 100 ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {progress >= 100 ? "Tamamlandı" : "Devam Ediyor"}
              </Badge>
              <Badge className="gap-1.5 border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100">
                <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                AI Destekli
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-amber-200">Firma Risk Özeti</div>
                    <div className="mt-2 text-lg font-semibold text-white">{companyRiskSummary.level}</div>
                  </div>
                  <div className="rounded-full border border-amber-300/20 bg-white/5 px-3 py-2 text-sm font-semibold text-amber-100">
                    {companyRiskSummary.score}/100
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  {companyRiskSummary.recommendation}
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Operasyon Özeti</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  Temel modüller ve AI modülleri tek akışta ilerliyor. Her adım kaydedilebilir ve PDF aşamasına kontrollü geçiş yapılıyor.
                </p>
              </div>
              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-200">Kullanıcı Etkisi</div>
                <p className="mt-2 text-sm leading-6 text-cyan-50">
                  Kullanıcı önce planı kurar, sonra ekipler, senaryolar ve risk kaynakları üzerinden çıktıya hazır kurumsal bir ADEP üretir.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Modern Stepper */}
      <Card className="overflow-hidden rounded-[24px] border-white/10 bg-slate-950/70 shadow-[0_22px_55px_rgba(2,6,23,0.28)] backdrop-blur">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Core Steps */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Temel Modüller
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {coreSteps.map((s) => {
                  const Icon = s.icon;
                  const active = s.id === currentStep;
                  const done = s.id < currentStep;

                  return (
                    <button
                      key={s.id}
                      onClick={() => void goToStep(s.id)}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "border-cyan-400/40 bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20"
                          : done
                          ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200 hover:border-emerald-400"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-400/35 hover:bg-cyan-400/5",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-6 w-6 rounded-md flex items-center justify-center",
                          active ? "bg-primary-foreground/20" : "",
                        ].join(" ")}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* AI Steps */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  AI Modülleri
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSteps.map((s) => {
                  const Icon = s.icon;
                  const active = s.id === currentStep;
                  const done = s.id < currentStep;

                  return (
                    <button
                      key={s.id}
                      onClick={() => void goToStep(s.id)}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all",
                        active
                          ? "border-fuchsia-400 bg-gradient-to-r from-fuchsia-500 to-violet-500 text-white shadow-lg shadow-fuchsia-500/20"
                          : done
                          ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200 hover:border-fuchsia-400"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-fuchsia-400/35 hover:bg-fuchsia-400/5",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-5 w-5 rounded flex items-center justify-center",
                          active ? "bg-white/20" : "",
                        ].join(" ")}
                      >
                        {done ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Final Step */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Tamamlama
                </span>
              </div>
              <div className="flex gap-2">
                {finalSteps.map((s) => {
                  const Icon = s.icon;
                  const active = s.id === currentStep;

                  return (
                    <button
                      key={s.id}
                      onClick={() => void goToStep(s.id)}
                      className={[
                        "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "border-blue-400 bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-blue-400/35 hover:bg-blue-400/5",
                      ].join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Content Card */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden rounded-[26px] border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-[0_24px_65px_rgba(2,6,23,0.32)]">
        <CardHeader className="border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge className="border-white/10 bg-white/10 text-slate-200 hover:bg-white/10">
                  Adım {currentStep}
                </Badge>
                <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100 hover:bg-cyan-400/10">
                  {stepMeta.category === "core" ? "Temel Modül" : stepMeta.category === "ai" ? "AI Modülü" : "Final Adımı"}
                </Badge>
              </div>
              <CardTitle className="text-xl text-white">
                Adım {currentStep}/13: {stepMeta.label}
              </CardTitle>
              <CardDescription className="mt-1.5 text-slate-400">
                {currentStep === 1 && "Plan meta ve işyeri bilgileri"}
                {currentStep === 2 &&
                  "Standart mevzuat metinleri (düzenlenebilir)"}
                {currentStep === 3 && "Acil durum ekipleri"}
                {currentStep === 4 &&
                  "Senaryolar ve talimatlar"}
                {currentStep === 5 &&
                  "İletişim rehberi "}
                {currentStep === 6 &&
                  "Önleyici tedbir matrisi"}
                {currentStep === 7 &&
                  "Ekipman envanteri (AI: adep_equipment_inventory)"}
                {currentStep === 8 && "Tatbikat kayıtları"}
                {currentStep === 9 &&
                  "Periyodik kontrol listeleri"}
                {currentStep === 10 &&
                  "Sorumluluk matrisi"}
                {currentStep === 11 &&
                  "Mevzuat referansları"}
                {currentStep === 12 &&
                  "Risk kaynakları haritası"}
                {currentStep === 13 && "Kaydet ve PDF oluştur"}
              </CardDescription>
            </div>

            <Button
              variant="outline"
              className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              disabled={
                saving ||
                !planRow.plan_name?.trim() ||
                !planRow.company_name?.trim()
              }
              onClick={async () => {
                const saved = await savePlan({ silent: false });
                if (saved?.id)
                  await refreshProgress(saved.id, { ...planRow, id: saved.id });
              }}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Kaydet
            </Button>
          </div>
        </CardHeader>

        <CardContent className="bg-transparent pt-6 text-slate-100">
          <div className="space-y-6 [&_.rounded-lg]:rounded-2xl [&_.rounded-xl]:rounded-2xl [&_.border]:border-white/10 [&_.bg-card]:bg-slate-950/55 [&_.shadow-sm]:shadow-[0_18px_40px_rgba(2,6,23,0.18)] [&_.text-card-foreground]:text-slate-100 [&_h3]:text-white [&_p.text-muted-foreground]:text-slate-400 [&_label]:text-slate-200 [&_input]:border-white/10 [&_input]:bg-slate-950/60 [&_input]:text-slate-100 [&_textarea]:border-white/10 [&_textarea]:bg-slate-950/60 [&_textarea]:text-slate-100 [&_[role='combobox']]:border-white/10 [&_[role='combobox']]:bg-slate-950/60 [&_[role='combobox']]:text-slate-100 [&_button.variant-outline]:border-white/10 [&_button.variant-outline]:bg-white/5">
            {renderStep()}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card className={`overflow-hidden rounded-[24px] border bg-gradient-to-br ${stepInsight.accent} bg-slate-950/80 shadow-[0_20px_48px_rgba(2,6,23,0.26)] backdrop-blur`}>
          <CardHeader className="border-b border-white/10 bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  {stepInsight.eyebrow}
                </div>
                <CardTitle className="mt-2 text-white">{stepInsight.title}</CardTitle>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <stepInsight.icon className="h-5 w-5 text-white" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm leading-6 text-slate-200">{stepInsight.summary}</p>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {stepInsight.metricLabel}
              </div>
              <div className="mt-2 text-lg font-semibold text-white">{stepInsight.metricValue}</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {moduleCountsLoading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div
                      key={`skeleton-${index}`}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                    >
                      <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
                      <div className="mt-3 h-5 w-24 animate-pulse rounded bg-white/15" />
                    </div>
                  ))
                : stepInsight.stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                          {stat.label}
                        </div>
                        <Badge
                          className={[
                            "border px-2.5 py-1 text-[11px] font-semibold shadow-sm",
                            stepMeta.category === "core"
                              ? "border-cyan-400/25 bg-cyan-400/12 text-cyan-100"
                              : stepMeta.category === "ai"
                              ? "border-fuchsia-400/25 bg-fuchsia-400/12 text-fuchsia-100"
                              : "border-emerald-400/25 bg-emerald-400/12 text-emerald-100",
                          ].join(" ")}
                        >
                          {stat.value}
                        </Badge>
                      </div>
                    </div>
                  ))}
            </div>
            <div className="space-y-2">
              {stepInsight.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-slate-300"
                >
                  {bullet}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px] border-white/10 bg-slate-950/75 shadow-[0_20px_48px_rgba(2,6,23,0.22)]">
          <CardHeader>
            <CardTitle className="text-white">Hızlı kontrol listesi</CardTitle>
            <CardDescription className="text-slate-400">
              Final PDF kalitesini yükselten küçük ama kritik kontroller.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              planRow.plan_name?.trim() ? "Plan adı hazır" : "Plan adı kontrol edilmeli",
              planRow.company_name?.trim() ? "Firma bilgisi girildi" : "Firma bilgisi eksik",
              progress >= 100 ? "Plan tamamlanmış görünüyor" : "Tamamlanma oranı final öncesi gözden geçirilmeli",
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-slate-300"
              >
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>

      {/* ✅ Navigation */}
      <div className="sticky bottom-4 z-20 flex justify-between rounded-2xl border border-white/10 bg-slate-950/80 p-3 shadow-[0_20px_50px_rgba(2,6,23,0.28)] backdrop-blur">
        <Button
          variant="outline"
          size="lg"
          className="gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          onClick={() => void goToStep(currentStep - 1)}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="h-5 w-5" />
          Geri
        </Button>

        {currentStep < 13 ? (
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
            onClick={() => void goToStep(currentStep + 1)}
          >
            İleri
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600"
            disabled={!planId}
            onClick={() => navigate("/adep-plans")}
          >
            <CheckCircle2 className="h-5 w-5" />
            Listeye Dön
          </Button>
        )}
      </div>

      <SendReportModal
        open={sendModalOpen}
        onOpenChange={setSendModalOpen}
        reportType="adep"
        reportUrl={currentReportUrl}
        reportFilename={currentReportFilename}
        companyName={planRow.company_name || "Firma"}
      />
    </div>
  );
}



