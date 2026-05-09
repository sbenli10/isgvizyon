import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
} from "lucide-react";
import { lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { useSafeMode } from "@/hooks/useSafeMode";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import NotificationWidget from "@/components/NotificationWidget";
import { supabase } from "@/integrations/supabase/client";
import { startPremiumTrial } from "@/lib/billing";
import { toast } from "sonner";
import {
  DASHBOARD_CACHE_TTL,
  fetchDashboardSnapshot,
  readDashboardSnapshot,
  writeDashboardSnapshot,
  type DashboardFinding,
  type DashboardInspection,
  type DashboardInspectionStatus,
  type DashboardRiskLevel,
  type DashboardSnapshot,
} from "@/lib/dashboardCache";
const RiskDistributionChart = lazy(() => import("@/components/dashboard/RiskDistributionChart"));

type RiskLevel = DashboardRiskLevel;
type InspectionStatus = DashboardInspectionStatus;
type Inspection = DashboardInspection;

interface MetricCard {
  title: string;
  subtitle: string;
  value: number;
  insight: string;
  icon: React.ReactNode;
  color: string;
}

function RevealBlock({
  children,
  delay = 0,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (disabled) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0px)" : "translateY(26px)",
        transition: `opacity 700ms ease ${delay}ms, transform 700ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

function StorySurface({
  children,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const node = ref.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    node.style.setProperty("--glow-x", `${x}%`);
    node.style.setProperty("--glow-y", `${y}%`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={`relative overflow-hidden ${className}`}
      style={
        {
          "--glow-x": "50%",
          "--glow-y": "30%",
        } as React.CSSProperties
      }
    >
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-300 [background:radial-gradient(circle_at_var(--glow-x)_var(--glow-y),rgba(56,189,248,0.14),transparent_24%),radial-gradient(circle_at_calc(var(--glow-x)_-_14%)_calc(var(--glow-y)_+_18%),rgba(99,102,241,0.10),transparent_26%)] ${disabled ? "opacity-0" : "opacity-70"}`} />
      <div className="relative">{children}</div>
    </div>
  );
}

function AnimatedNumber({ value, disabled = false }: { value: number; disabled?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (disabled) {
      setDisplayValue(value);
      return;
    }

    const duration = 700;
    const steps = 24;
    const increment = value / steps;
    let currentStep = 0;

    const timer = window.setInterval(() => {
      currentStep += 1;
      if (currentStep >= steps) {
        setDisplayValue(value);
        window.clearInterval(timer);
        return;
      }

      setDisplayValue(Math.round(increment * currentStep));
    }, duration / steps);

    return () => window.clearInterval(timer);
  }, [value]);

  return <span className="notranslate" translate="no">{displayValue}</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { status, plan, canStartTrial, daysLeftInTrial, refetch: refetchSubscription } = useSubscription();
  const { safeMode } = useSafeMode();
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = safeMode || prefersReducedMotion;
  const [loading, setLoading] = useState(true);
  const [startingTrial, setStartingTrial] = useState(false);
  usePageDataTiming(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [, setOrgId] = useState<string | null>(null);

  const [activeInspections, setActiveInspections] = useState(0);
  const [openFindings, setOpenFindings] = useState(0);
  const [criticalRiskPercent, setCriticalRiskPercent] = useState(0);
  const [overdueActions, setOverdueActions] = useState(0);

  const [riskDistribution, setRiskDistribution] = useState<
    Array<{ name: string; value: number; color: string }>
  >([]);
  const [monthlyTrend, setMonthlyTrend] = useState<
    Array<{ month: string; denetimler: number }>
  >([]);
  const [recentInspections, setRecentInspections] = useState<Inspection[]>([]);

  const hasHydratedFromCache = useRef(false);
  const isFetching = useRef(false);
  const hasPremiumAccess = status === "trial" || plan === "premium";
  const isTrialActive = status === "trial";
  const isPremiumMember = plan === "premium";

  const applySnapshot = useCallback((snapshot: DashboardSnapshot) => {
    setOrgId(snapshot.orgId);
    setActiveInspections(snapshot.activeInspections);
    setOpenFindings(snapshot.openFindings);
    setCriticalRiskPercent(snapshot.criticalRiskPercent);
    setOverdueActions(snapshot.overdueActions);
    setRiskDistribution(snapshot.riskDistribution);
    setMonthlyTrend(snapshot.monthlyTrend);
    setRecentInspections(snapshot.recentInspections);
  }, []);

  const fetchPersonalDashboardData = useCallback(async () => {
    if (!user) {
      return;
    }

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (companiesError) {
      throw new Error(`Firma verileri alınamadı: ${companiesError.message}`);
    }

    const companyIds = (companies ?? []).map((company) => company.id);

    const [
      { count: employeesCount, error: employeesError },
      { count: riskAssessmentCount, error: riskAssessmentsError },
      { data: inspections, error: inspectionsError },
      { count: analysisCount, error: analysisError },
    ] = await Promise.all([
      companyIds.length > 0
        ? supabase
            .from("employees")
            .select("id", { count: "exact", head: true })
            .in("company_id", companyIds)
            .eq("is_active", true)
        : Promise.resolve({ count: 0, error: null, data: null }),
      supabase
        .from("risk_assessments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_deleted", false),
      supabase
        .from("inspections")
        .select("id, location_name, risk_level, status, created_at, org_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("document_analyses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    if (employeesError) {
      throw new Error(`Çalışan verileri alınamadı: ${employeesError.message}`);
    }

    if (riskAssessmentsError) {
      throw new Error(`Risk değerlendirme verileri alınamadı: ${riskAssessmentsError.message}`);
    }

    if (inspectionsError) {
      throw new Error(`Denetim verileri alınamadı: ${inspectionsError.message}`);
    }

    if (analysisError) {
      throw new Error(`Analiz verileri alınamadı: ${analysisError.message}`);
    }

    const inspectionList = (inspections ?? []) as DashboardInspection[];
    let findingsList: DashboardFinding[] = [];

    if (inspectionList.length > 0) {
      const inspectionIds = inspectionList.map((inspection) => inspection.id);
      const { data: findings, error: findingsError } = await supabase
        .from("findings")
        .select("id, description, due_date, is_resolved, inspection_id")
        .in("inspection_id", inspectionIds);

      if (findingsError) {
        throw new Error(`Bulgu verileri alınamadı: ${findingsError.message}`);
      }

      findingsList = (findings ?? []) as DashboardFinding[];
    }

    const activeInspectionsCount = inspectionList.filter((inspection) => inspection.status === "in_progress").length;
    const openFindingsCount = findingsList.filter((finding) => !finding.is_resolved).length;
    const criticalCount = inspectionList.filter((inspection) => inspection.risk_level === "critical").length;
    const criticalPercent = inspectionList.length > 0 ? Math.round((criticalCount / inspectionList.length) * 100) : 0;
    const today = new Date();
    const overdueCount = findingsList.filter(
      (finding) => !finding.is_resolved && finding.due_date && new Date(finding.due_date) < today,
    ).length;

    setOrgId("personal");
    setActiveInspections(activeInspectionsCount);
    setOpenFindings(openFindingsCount);
    setCriticalRiskPercent(criticalPercent);
    setOverdueActions(overdueCount);
    setRiskDistribution(
      [
        { name: "Düşük", value: inspectionList.filter((item) => item.risk_level === "low").length, color: "#10b981" },
        { name: "Orta", value: inspectionList.filter((item) => item.risk_level === "medium").length, color: "#f59e0b" },
        { name: "Yüksek", value: inspectionList.filter((item) => item.risk_level === "high").length, color: "#f97316" },
        { name: "Kritik", value: criticalCount, color: "#ef4444" },
      ].filter((item) => item.value > 0),
    );
    setMonthlyTrend(() => {
      const months = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
      const last6Months: Array<{ month: string; denetimler: number }> = [];
      const baseDate = new Date();

      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
        const count = inspectionList.filter((inspection) => {
          const createdAt = new Date(inspection.created_at);
          return createdAt.getMonth() === date.getMonth() && createdAt.getFullYear() === date.getFullYear();
        }).length;

        last6Months.push({
          month: months[date.getMonth()],
          denetimler: count,
        });
      }

      return last6Months;
    });
    setRecentInspections(inspectionList.slice(0, 5));

    return {
      companiesCount: companyIds.length,
      employeesCount: employeesCount ?? 0,
      riskAssessmentCount: riskAssessmentCount ?? 0,
      documentAnalysisCount: analysisCount ?? 0,
    };
  }, [user]);

  const fetchDashboardData = useCallback(
    async (isRefresh = false, force = false) => {
      if (!user || isFetching.current) {
        return;
      }

      const shouldUseOrganizationDashboard = Boolean(profile?.organization_id);
      const shouldUsePersonalDashboard = !profile?.organization_id && hasPremiumAccess;

      if (!shouldUseOrganizationDashboard && !shouldUsePersonalDashboard) {
        return;
      }

      if (!force && !isRefresh && hasHydratedFromCache.current) {
        return;
      }

      isFetching.current = true;

      if (isRefresh) {
        setRefreshing(true);
      } else if (!hasHydratedFromCache.current) {
        setLoading(true);
      }

      try {
        if (shouldUseOrganizationDashboard && profile?.organization_id) {
          const snapshot = await fetchDashboardSnapshot(profile.organization_id);
          applySnapshot(snapshot);
          writeDashboardSnapshot(user.id, snapshot);
        } else {
          await fetchPersonalDashboardData();
        }

        hasHydratedFromCache.current = true;

        if (isRefresh) {
          toast.success("Dashboard güncellendi", {
            description: shouldUseOrganizationDashboard
              ? "Organizasyon verileri yenilendi."
              : "Bireysel premium metrikleri güncellendi.",
          });
        }
      } catch (error: any) {
        console.error("Dashboard fetch error:", error);

        let errorMessage = "Dashboard yüklenemedi";
        let errorDescription = error?.message || "Bilinmeyen hata";

        if (error?.message?.includes("Profil bilgisi")) {
          errorMessage = "Profil hatası";
          errorDescription = "Kullanıcı profili bulunamadı";
        } else if (error?.message?.includes("Kuruluş bilgisi")) {
          errorMessage = "Kuruluş hatası";
          errorDescription = "Kuruluş bilgisi eksik";
        } else if (error?.message?.includes("Denetim verileri")) {
          errorMessage = "Veri hatası";
          errorDescription = "Denetim verileri alınamadı";
        }

        toast.error(errorMessage, {
          description: errorDescription,
          duration: 8000,
          action: {
            label: "Tekrar Dene",
            onClick: () => {
              hasHydratedFromCache.current = false;
              void fetchDashboardData(true, true);
            },
          },
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
        isFetching.current = false;
      }
    },
    [applySnapshot, fetchPersonalDashboardData, hasPremiumAccess, profile?.organization_id, user]
  );

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    if (!profile.organization_id && !hasPremiumAccess) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (profile.organization_id) {
      const cachedSnapshot = readDashboardSnapshot(user.id);
      const isCacheFresh =
        cachedSnapshot && Date.now() - cachedSnapshot.timestamp < DASHBOARD_CACHE_TTL;

      if (cachedSnapshot) {
        applySnapshot(cachedSnapshot);
        hasHydratedFromCache.current = true;
        setLoading(false);
      }

      void fetchDashboardData(false, !isCacheFresh);
      return;
    }

    hasHydratedFromCache.current = false;
    void fetchDashboardData(false, true);
  }, [applySnapshot, fetchDashboardData, hasPremiumAccess, profile, user]);

  const handleRefresh = () => {
    void fetchDashboardData(true, true);
  };

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      await startPremiumTrial();
      await refreshProfile();
      await refetchSubscription();
      toast.success("7 günlük premium deneme başlatıldı", {
        description: "Deneme süresince Premium üyeliğin açtığı tüm özellikler ve ekranlar aktif.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deneme üyeliği başlatılamadı.";
      toast.error("Deneme üyeliği başlatılamadı", { description: message });
    } finally {
      setStartingTrial(false);
    }
  };

  if (user && profile && !profile.organization_id && !hasPremiumAccess) {
    const trialButtonDisabled = startingTrial || !canStartTrial;
  const heroTitle = "İSGVizyon Dünyasına Hoş Geldiniz";
  const heroDescription =
  "Platformumuzu kişisel hesabınızla hemen keşfetmeye başlayabilirsiniz. Yapay zeka analiz araçlarımız ve akıllı asistanımız kullanımınıza hazırdır. Çoklu ekip yönetimi, firma koordinasyonu ve kurumsal finans süreçlerini de aktif hale getirmek isterseniz, kendinize saniyeler içinde şık bir çalışma alanı (organizasyon) tanımlayabilirsiniz.";
    const secondaryActionLabel = "Premium'u incele";
    const secondaryActionTarget = "/settings?tab=billing&upgrade=1";

    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_30%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(10,15,28,0.94))] p-6 text-white shadow-[0_20px_80px_rgba(2,6,23,0.45)] md:p-8">
          <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-100">Hoş geldiniz</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{heroTitle}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            {heroDescription}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => void handleStartTrial()}
              disabled={trialButtonDisabled}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startingTrial
                ? "Premium deneme başlatılıyor..."
                : "7 günlük premium denemeyi başlat"}
            </Button>
            <Button
              onClick={() => navigate("/profile?tab=workspace&action=create")}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Organizasyon Oluştur
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(secondaryActionTarget)}
              className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
            >
              {secondaryActionLabel}
            </Button>
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-5 text-slate-400">
            Premium deneme sırasında Premium üyeliğin açtığı tüm AI, raporlama, çıktı ve gelişmiş operasyon ekranları erişilebilir olur. OSGB modülü bu kapsama dahil değildir.
          </p>
        </section>
      </div>
    );
  }
  const getRiskColor = (level: RiskLevel) => {
    const colors: Record<RiskLevel, string> = {
      low: "bg-success/10 text-success border-success/30",
      medium: "bg-warning/10 text-warning border-warning/30",
      high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
      critical: "bg-destructive/10 text-destructive border-destructive/30",
    };
    return colors[level] || "bg-secondary";
  };

  const getRiskLabel = (level: RiskLevel) => {
    const labels: Record<RiskLevel, string> = {
      low: "Düşük",
      medium: "Orta",
      high: "Yüksek",
      critical: "Kritik",
    };
    return labels[level] || level;
  };
   
  const getStatusLabel = (status: InspectionStatus) => {
    const labels: Record<InspectionStatus, string> = {
      in_progress: "Devam Ediyor",
      completed: "Tamamlandı",
      draft: "Taslak",
      cancelled: "İptal",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: InspectionStatus) => {
    const colors: Record<InspectionStatus, string> = {
      in_progress: "bg-blue-500/10 text-blue-500 border-blue-500/30",
      completed: "bg-success/10 text-success border-success/30",
      draft: "bg-secondary/50 text-muted-foreground border-border",
      cancelled: "bg-destructive/10 text-destructive border-destructive/30",
    };
    return colors[status] || "bg-secondary";
  };

  const metrics: MetricCard[] = [
    {
      title: "Aktif Denetim Hattı",
      subtitle: "Sahada devam eden iş akışı",
      value: activeInspections,
      insight: activeInspections > 0 ? "İş yükü aktif şekilde ilerliyor" : "Yeni denetim planlanmalı",
      icon: <Activity className="h-5 w-5" />,
      color: "from-cyan-500 via-sky-500 to-blue-600",
    },
    {
      title: "Açık DÖF Havuzu",
      subtitle: "Takip isteyen bulgular",
      value: openFindings,
      insight: openFindings > 0 ? "Kapanış odaklı takip gerekli" : "Açık bulgu baskısı görünmüyor",
      icon: <AlertTriangle className="h-5 w-5" />,
      color: "from-amber-500 via-orange-500 to-orange-600",
    },
    {
      title: "Kritik Risk Oranı",
      subtitle: "En yüksek öncelikli risk payı",
      value: criticalRiskPercent,
      insight:
        criticalRiskPercent > 20
          ? "Yönetim müdahalesi gerekiyor"
          : criticalRiskPercent > 0
            ? "Kontrol altında izlenmeli"
            : "Kritik yoğunluk görünmüyor",
      icon: <AlertCircle className="h-5 w-5" />,
      color: "from-rose-500 via-red-500 to-red-700",
    },
    {
      title: "Geciken İşlemler",
      subtitle: "Termin aşımı yaşayan aksiyonlar",
      value: overdueActions,
      insight: overdueActions > 0 ? "Hızlı kapanış gerekli" : "Takvim baskısı görünmüyor",
      icon: <Clock className="h-5 w-5" />,
      color: "from-fuchsia-500 via-violet-500 to-purple-600",
    },
  ];

  const operationalScore = Math.max(
    0,
    100 - Math.min(criticalRiskPercent * 2, 50) - Math.min(overdueActions * 4, 30) - Math.min(openFindings, 20),
  );

  const criticalRecentCount = recentInspections.filter((inspection) => inspection.risk_level === "critical").length;
  const totalRiskVolume = riskDistribution.reduce((sum, item) => sum + item.value, 0);
  const dominantRisk = [...riskDistribution].sort((a, b) => b.value - a.value)[0];
  const latestTrend = monthlyTrend[monthlyTrend.length - 1]?.denetimler ?? 0;
  const previousTrend = monthlyTrend[monthlyTrend.length - 2]?.denetimler ?? 0;
  const momentumDelta = latestTrend - previousTrend;

  const priorityHeadline =
    overdueActions > 0
      ? `${overdueActions} geciken işlem bugün öncelik istiyor`
      : openFindings > 0
        ? `${openFindings} açık DÖF için kapanış takibi gerekli`
        : "Operasyon görünümü dengeli, yeni denetim planlamasına geçilebilir";

  const priorityActions = [
    {
      title: "Geciken İşlemler",
      detail:
        overdueActions > 0
          ? `${overdueActions} kayıt için kapanış aksiyonu planlanmalı`
          : "Geciken işlem görünmüyor",
      tone:
        overdueActions > 0
          ? "border-red-500/20 bg-red-500/10 text-red-100"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    },
    {
      title: "Açık DÖF Akışı",
      detail:
        openFindings > 0
          ? `${openFindings} açık kayıt için sorumlu ve termin kontrolü gerekli`
          : "Açık DÖF baskısı görünmüyor",
      tone:
        openFindings > 0
          ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    },
    {
      title: "Kritik Risk Yoğunluğu",
      detail:
        criticalRiskPercent > 20
          ? `Kritik oran %${criticalRiskPercent}; yönetim değerlendirmesi gerekli`
          : criticalRiskPercent > 0
            ? `Kritik oran %${criticalRiskPercent}; kontrollü takip önerilir`
            : "Kritik risk baskısı görünmüyor",
      tone:
        criticalRiskPercent > 20
          ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
          : criticalRiskPercent > 0
            ? "border-orange-500/20 bg-orange-500/10 text-orange-100"
            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    },
  ];

  return (
    <div className="space-y-8 notranslate" translate="no">
      {!profile?.organization_id && hasPremiumAccess && (
        <RevealBlock disabled={reduceMotion}>
          <section className="relative overflow-hidden rounded-[26px] border border-emerald-400/18 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_34%),radial-gradient(circle_at_82%_18%,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(145deg,rgba(5,10,22,0.98),rgba(12,20,36,0.94))] p-5 shadow-[0_20px_60px_rgba(6,95,70,0.22)] md:p-6">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.05)_48%,transparent_100%)] opacity-70" />
            <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-400/20 bg-emerald-400/12 px-3 py-1 text-emerald-50 shadow-[0_8px_24px_rgba(16,185,129,0.14)]">
                    {isTrialActive ? `Premium demo aktif · ${daysLeftInTrial} gün` : "Premium üyelik aktif"}
                  </Badge>
                  <Badge variant="outline" className="border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                    Bireysel kullanım modu
                  </Badge>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-white md:text-2xl">Premium araç setiniz aktif</h2>
                  <p className="max-w-3xl text-sm leading-6 text-slate-300">
                    AI analiz, raporlama ve premium üretim ekranları bireysel hesabınızda açık. Organizasyon kurmadan kişisel premium akışlarını kullanabilirsiniz; sadece OSGB, ekip yönetimi ve finans operasyonları için organizasyon gerekir.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Erişim Türü</p>
                    <p className="mt-2 text-sm font-semibold text-white">{isTrialActive ? "Premium Demo" : "Premium Üyelik"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Kalan Süre</p>
                    <p className="mt-2 text-sm font-semibold text-white">{isTrialActive ? `${daysLeftInTrial} gün` : "Süre kısıtı yok"}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Açık Modüller</p>
                    <p className="mt-2 text-sm font-semibold text-white">{isPremiumMember ? "Premium üretim araçları" : "AI, raporlama ve premium akışlar"}</p>
                  </div>
                </div>
                <p className="text-xs leading-5 text-slate-400">
                  Trial sürecinde Premium üyeliğin açtığı tüm bireysel modüller kullanılabilir. OSGB modülü ve kurumsal finans ekranları bu kapsamın dışındadır.
                </p>
              </div>
              <div className="flex flex-col gap-3 xl:min-w-[320px]">
                <Button
                  onClick={() => navigate("/settings?tab=billing&upgrade=1")}
                  className="h-11 bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-[0_14px_32px_rgba(34,211,238,0.22)] hover:from-emerald-300 hover:to-cyan-300"
                >
                  Premium avantajlarını yönet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/profile?tab=workspace&action=create")}
                  className="h-11 border-white/10 bg-white/5 text-slate-100 hover:border-emerald-300/30 hover:bg-white/10"
                >
                  OSGB için organizasyon oluştur
                </Button>
              </div>
            </div>
          </section>
        </RevealBlock>
      )}

      <RevealBlock disabled={reduceMotion}>
        <section className="relative overflow-hidden rounded-[24px] border border-cyan-500/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.16),_transparent_28%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(10,15,28,0.94))] p-4 shadow-[0_20px_80px_rgba(2,6,23,0.45)] md:rounded-[28px] md:p-8">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,rgba(255,255,255,0.04)_45%,transparent_100%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-100">İSG Yönetim Paneli</Badge>
              <Badge variant="outline" className="border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                Operasyon skoru: {operationalScore}/100
              </Badge>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] uppercase tracking-[0.34em] text-cyan-200/70">Executive Safety Narrative</p>
              <h1 className="max-w-4xl text-2xl font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-3xl md:text-5xl xl:text-[3.8rem]">
                Denetim, risk ve aksiyon yükünü tek bakışta yöneten kurumsal kontrol masası
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-[15px]">
                Kritik yoğunluğu, saha hareketini ve kapanış baskısını aynı çerçevede gösterir. Panelin amacı sayı
                vermek değil, yöneticiye bugün neye odaklanması gerektiğini netleştirmektir.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-transform duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Bugünün Önceliği</p>
                <p className="mt-3 text-sm font-medium leading-6 text-white">{priorityHeadline}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-transform duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Kritik Sonuçlar</p>
                <p className="mt-3 text-3xl font-semibold text-white"><AnimatedNumber value={criticalRecentCount} disabled={reduceMotion} /></p>
                <p className="mt-1 text-sm text-slate-300">Son denetimlerde kritik risk etiketi alan kayıtlar</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition-transform duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operasyon Yorumu</p>
                <p className="mt-3 text-sm font-medium leading-6 text-white">
                  {operationalScore >= 80
                    ? "Sistem dengeli görünüyor, standart takiple ilerlenebilir."
                    : operationalScore >= 60
                      ? "Panel kontrollü ama dikkat isteyen alanlar var."
                      : "Yük baskısı yüksek, kritik akışlar ayrıştırılmalı."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4">
            <div className="rounded-[22px] border border-white/10 bg-black/20 p-4 backdrop-blur md:rounded-[24px] md:p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Canlı Durum</p>
                  <p className="mt-2 text-3xl font-semibold text-white md:text-4xl">
                    <AnimatedNumber value={operationalScore} disabled={reduceMotion} />
                  </p>
                </div>
                <Button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Yenile
                </Button>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee_0%,#3b82f6_45%,#8b5cf6_100%)]"
                  style={{ width: `${operationalScore}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-300">
                Skor; kritik risk oranı, geciken işlemler ve açık DÖF yoğunluğuna göre dinamik hesaplanır.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Saha Akışı</p>
                <p className="mt-2 text-2xl font-semibold text-white"><AnimatedNumber value={activeInspections} disabled={reduceMotion} /></p>
                <p className="mt-1 text-sm text-slate-300">Aktif yürüyen denetim</p>
              </div>
              <div className="rounded-2xl border border-amber-400/10 bg-amber-400/5 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Kapanış Baskısı</p>
                <p className="mt-2 text-2xl font-semibold text-white"><AnimatedNumber value={openFindings + overdueActions} disabled={reduceMotion} /></p>
                <p className="mt-1 text-sm text-slate-300">Açık bulgu + geciken işlem toplamı</p>
              </div>
            </div>
          </div>
        </div>
        </section>
      </RevealBlock>

      <Tabs defaultValue="executive" className="space-y-6">
        <RevealBlock delay={80} disabled={reduceMotion}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Dashboard Akışı</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Sade görünüm seçin</h2>
            </div>
            <TabsList className="h-auto rounded-2xl border border-white/10 bg-white/5 p-1 text-slate-300">
              <TabsTrigger
                value="executive"
                className="rounded-xl px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950"
              >
                Yönetici Özeti
              </TabsTrigger>
              <TabsTrigger
                value="operations"
                className="rounded-xl px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950"
              >
                Operasyon Görünümü
              </TabsTrigger>
            </TabsList>
          </div>
        </RevealBlock>

        <TabsContent value="executive" className="space-y-6">
          <RevealBlock delay={100} disabled={reduceMotion}>
            <section className="grid gap-3 md:grid-cols-3">
              {priorityActions.map((action, index) => (
                <div
                  key={action.title}
                  className={`rounded-2xl border p-4 shadow-[0_10px_30px_rgba(2,6,23,0.18)] transition-transform duration-300 hover:-translate-y-0.5 ${action.tone}`}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{action.title}</p>
                    <span className="h-2.5 w-2.5 rounded-full bg-current opacity-80 animate-pulse" />
                  </div>
                  <p className="mt-2 text-sm leading-6 opacity-90">{action.detail}</p>
                </div>
              ))}
            </section>
          </RevealBlock>

          <RevealBlock delay={140} disabled={reduceMotion}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="glass-card space-y-3 border border-primary/10 p-5">
                    <div className="flex items-center justify-between">
                      <div className="h-3 w-24 animate-pulse rounded bg-slate-800" />
                      <div className="h-10 w-10 animate-pulse rounded-lg bg-slate-800" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-8 w-16 animate-pulse rounded bg-slate-800" />
                      <div className="h-3 w-28 animate-pulse rounded bg-slate-900" />
                    </div>
                  </div>
                ))
              ) : (
                metrics.map((metric) => (
                  <div
                    key={metric.title}
                    className="group relative overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(8,12,22,0.96))] p-5 transition-all hover:-translate-y-0.5 hover:border-cyan-400/20"
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{metric.title}</p>
                        <p className="text-sm text-slate-300">{metric.subtitle}</p>
                      </div>
                      <div className={`rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg ${metric.color}`}>
                        {metric.icon}
                      </div>
                    </div>
                    <div className="mt-6 space-y-2">
                      <p className="text-4xl font-semibold tracking-tight text-white">
                        <AnimatedNumber value={metric.value} disabled={reduceMotion} />
                      </p>
                      <p className="text-sm text-slate-300">{metric.insight}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </RevealBlock>

          <RevealBlock delay={180} disabled={reduceMotion}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <section className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,31,0.96),rgba(10,14,24,0.98))] p-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Risk Hacmi</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                    <AnimatedNumber value={totalRiskVolume} disabled={reduceMotion} />
                  </p>
                  <p className="mt-2 text-sm text-slate-300">Toplam sınıflandırılmış risk kaydı</p>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,31,0.96),rgba(10,14,24,0.98))] p-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Baskın Seviye</p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                    {dominantRisk?.name ?? "Veri yok"}
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {dominantRisk ? `${dominantRisk.value} kayıt ile en yoğun alan` : "Risk dağılımı oluşmadı"}
                  </p>
                </div>
                <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,31,0.96),rgba(10,14,24,0.98))] p-5">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Ritim Farkı</p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                    {momentumDelta > 0 ? "+" : ""}
                    <AnimatedNumber value={Math.abs(momentumDelta)} disabled={reduceMotion} />
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {momentumDelta === 0 ? "Son iki ay aynı ritimde" : momentumDelta > 0 ? "Son ay yukarı yönlü" : "Son ay aşağı yönlü"}
                  </p>
                </div>
              </section>

              <StorySurface disabled={reduceMotion} className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,26,0.98),rgba(18,24,41,0.92))] p-6 md:p-7">
                <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative grid gap-6 lg:grid-cols-[0.44fr_0.56fr]">
                  <div className="space-y-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Risk Özeti</p>
                      <h3 className="mt-3 text-[1.8rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
                        Risk dağılımını tek panelde okuyun
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        Yönetici özeti tarafında sadece karar verdiren ana görünüm bırakıldı.
                      </p>
                    </div>
                    <div className="grid gap-3">
                      {riskDistribution.slice(0, 4).map((item) => (
                        <div key={item.name} className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-white">{item.name}</p>
                            <span className="text-sm text-slate-300">{item.value}</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${totalRiskVolume > 0 ? (item.value / totalRiskVolume) * 100 : 0}%`,
                                background: item.color,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                    <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
                      <Suspense fallback={<div className="h-[320px] animate-pulse rounded-2xl bg-slate-900/70" />}>
                        <RiskDistributionChart loading={loading} riskDistribution={riskDistribution} />
                      </Suspense>
                    </div>
                </div>
              </StorySurface>
            </div>
          </RevealBlock>
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          <RevealBlock delay={140} disabled={reduceMotion}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.02fr_0.98fr]">
              <StorySurface disabled={reduceMotion} className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,26,0.98),rgba(20,26,44,0.92))] p-6 md:p-7">
                <div className="relative">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Saha Akışı</p>
                      <h3 className="mt-3 text-[1.8rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
                        Son denetimler ve kritik etiketler
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Son kayıtları, risk seviyesi ve durum etiketiyle birlikte hızlıca tarayın.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                      {recentInspections.length} kayıt
                    </Badge>
                  </div>

                  <div className="relative ml-2 space-y-3 border-l border-white/10 pl-5">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="rounded-2xl border border-border/40 bg-secondary/30 p-4">
                          <div className="mb-2 h-4 w-52 animate-pulse rounded bg-slate-800" />
                          <div className="h-3 w-36 animate-pulse rounded bg-slate-900" />
                        </div>
                      ))
                    ) : recentInspections.length > 0 ? (
                      recentInspections.map((inspection, index) => (
                        <div
                          key={inspection.id}
                          className="relative grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all hover:border-cyan-400/20 hover:bg-white/[0.05] md:grid-cols-[1fr_auto]"
                        >
                          <div className="absolute -left-[30px] top-6 flex h-4 w-4 items-center justify-center rounded-full border border-cyan-400/30 bg-slate-950">
                            <div className={`h-2 w-2 rounded-full ${inspection.risk_level === "critical" ? "bg-red-400" : inspection.risk_level === "high" ? "bg-orange-400" : "bg-cyan-400"}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">#{String(index + 1).padStart(2, "0")}</p>
                              <p className="truncate text-sm font-medium text-white">
                                {inspection.location_name || "İsimsiz Lokasyon"}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-slate-400">
                              {new Date(inspection.created_at).toLocaleDateString("tr-TR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="flex flex-col items-start gap-2 md:items-end">
                            <div className="flex items-center gap-2 md:justify-end">
                              <Badge variant="outline" className={`text-[10px] ${getRiskColor(inspection.risk_level)}`}>
                                {getRiskLabel(inspection.risk_level)}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] ${getStatusColor(inspection.status)}`}>
                                {getStatusLabel(inspection.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">Denetim akışındaki son kayıt</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <AlertCircle className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-30" />
                        <p className="text-sm font-medium text-foreground">Henüz denetim bulunmuyor</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          İlk denetiminizi oluşturmak için "Denetimler" sayfasını ziyaret edin
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </StorySurface>

              <section className="space-y-6">
                <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,29,0.96),rgba(8,12,22,0.98))] p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Aylık Ritim</p>
                      <h3 className="mt-3 text-[1.55rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white">
                        Grafik yerine kısa okuma
                      </h3>
                    </div>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                      6 aylık görünüm
                    </Badge>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {monthlyTrend.map((item) => (
                      <div key={item.month} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.month}</p>
                          <p className="mt-1 text-sm text-slate-300">Tamamlanan denetim</p>
                        </div>
                        <p className="text-2xl font-semibold text-white">{item.denetimler}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Yorum</p>
                    <p className="mt-2 text-sm leading-6 text-slate-200">
                      {momentumDelta > 0
                        ? "Denetim temposu toparlanıyor."
                        : momentumDelta < 0
                          ? "Ritim zayıflıyor, planlama gözden geçirilmeli."
                          : "Ritim stabil ilerliyor."}
                    </p>
                  </div>
                </div>

                <StorySurface disabled={reduceMotion} className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(9,13,24,0.98),rgba(19,24,41,0.92))] p-6 md:p-7">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Bildirim Merkezi</p>
                      <h3 className="mt-3 text-[1.8rem] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
                        Canlı bildirim akışı
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                        Operasyon akışını kesen uyarılar, hatırlatmalar ve işlem çağrıları burada toplanır.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-right">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Kontrol modu</p>
                      <p className="mt-2 text-sm font-medium text-white">Gerçek zamanlı bildirim akışı</p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-black/20">
                    <NotificationWidget />
                  </div>
                </StorySurface>
              </section>
            </div>
          </RevealBlock>
        </TabsContent>
      </Tabs>
    </div>
  );
}
