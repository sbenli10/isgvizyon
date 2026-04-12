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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import NotificationWidget from "@/components/NotificationWidget";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DASHBOARD_CACHE_TTL,
  fetchDashboardSnapshot,
  readDashboardSnapshot,
  writeDashboardSnapshot,
  type DashboardInspection,
  type DashboardInspectionStatus,
  type DashboardRiskLevel,
  type DashboardSnapshot,
} from "@/lib/dashboardCache";

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
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
  }, []);

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
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  const handleMove = (event: React.MouseEvent<HTMLDivElement>) => {
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
      <div className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 [background:radial-gradient(circle_at_var(--glow-x)_var(--glow-y),rgba(56,189,248,0.14),transparent_24%),radial-gradient(circle_at_calc(var(--glow-x)_-_14%)_calc(var(--glow-y)_+_18%),rgba(99,102,241,0.10),transparent_26%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
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
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
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

  const fetchDashboardData = useCallback(
    async (isRefresh = false, force = false) => {
      if (!user || !profile?.organization_id || isFetching.current) {
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
        const snapshot = await fetchDashboardSnapshot(profile.organization_id);
        applySnapshot(snapshot);
        writeDashboardSnapshot(user.id, snapshot);
        hasHydratedFromCache.current = true;

        if (isRefresh) {
          toast.success("Dashboard güncellendi", {
            description: `${snapshot.openFindings} açık bulgu, ${snapshot.activeInspections} aktif denetim`,
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
    [applySnapshot, profile?.organization_id, user]
  );

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    const cachedSnapshot = readDashboardSnapshot(user.id);
    const isCacheFresh =
      cachedSnapshot && Date.now() - cachedSnapshot.timestamp < DASHBOARD_CACHE_TTL;

    if (cachedSnapshot) {
      applySnapshot(cachedSnapshot);
      hasHydratedFromCache.current = true;
      setLoading(false);
    }

    void fetchDashboardData(false, !isCacheFresh);
  }, [applySnapshot, fetchDashboardData, profile, user]);

  const handleRefresh = () => {
    void fetchDashboardData(true, true);
  };

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
      <RevealBlock>
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
                <p className="mt-3 text-3xl font-semibold text-white"><AnimatedNumber value={criticalRecentCount} /></p>
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
                    <AnimatedNumber value={operationalScore} />
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
                <p className="mt-2 text-2xl font-semibold text-white"><AnimatedNumber value={activeInspections} /></p>
                <p className="mt-1 text-sm text-slate-300">Aktif yürüyen denetim</p>
              </div>
              <div className="rounded-2xl border border-amber-400/10 bg-amber-400/5 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/70">Kapanış Baskısı</p>
                <p className="mt-2 text-2xl font-semibold text-white"><AnimatedNumber value={openFindings + overdueActions} /></p>
                <p className="mt-1 text-sm text-slate-300">Açık bulgu + geciken işlem toplamı</p>
              </div>
            </div>
          </div>
        </div>
        </section>
      </RevealBlock>

      <RevealBlock delay={80}>
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

      <RevealBlock delay={120}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="glass-card space-y-3 border border-primary/10 p-5"
            >
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
          metrics.map((metric, idx) => (
            <div
              key={idx}
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
                  <AnimatedNumber value={metric.value} />
                </p>
                <p className="text-sm text-slate-300">{metric.insight}</p>
              </div>
              <div className="mt-5 h-px bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>Durum sinyali</span>
                <span>{metric.value > 0 ? "Canlı" : "Beklemede"}</span>
              </div>
            </div>
          ))
        )}
        </div>
      </RevealBlock>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <RevealBlock delay={180} className="space-y-6">
          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,18,31,0.96),rgba(10,14,24,0.98))] p-6">
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Control Thesis</p>
              <h3 className="mt-3 text-[1.7rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
                Güvenlik operasyonu şu an hangi baskıyla yönetiliyor?
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Panelin merkezinde üç sinyal var: kritik riskin payı, kapanış bekleyen aksiyon yükü ve sahadaki denetim ritmi.
                Bu üçlü birlikte okunduğunda yöneticinin gerçekten müdahale etmesi gereken tablo ortaya çıkıyor.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Risk Hacmi</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                  <AnimatedNumber value={totalRiskVolume} />
                </p>
                <p className="mt-2 text-sm text-slate-300">Toplam sınıflandırılmış risk kaydı</p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Baskın Seviye</p>
                <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {dominantRisk?.name ?? "Veri yok"}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {dominantRisk ? `${dominantRisk.value} kayıt ile en yoğun alan` : "Risk dağılımı oluşmadı"}
                </p>
              </div>
              <div className="rounded-[26px] border border-white/10 bg-white/[0.035] p-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Ritim Farkı</p>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
                  {momentumDelta > 0 ? "+" : ""}
                  <AnimatedNumber value={Math.abs(momentumDelta)} />
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {momentumDelta === 0 ? "Son iki ay aynı ritimde" : momentumDelta > 0 ? "Son ay yukarı yönlü" : "Son ay aşağı yönlü"}
                </p>
              </div>
            </div>
          </section>

          <StorySurface className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,26,0.98),rgba(18,24,41,0.92))] p-6 md:p-7">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative grid gap-6 lg:grid-cols-[0.42fr_0.58fr]">
              <div className="space-y-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Risk Story Panel</p>
                  <h3 className="mt-3 text-[1.95rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white">Risk haritası hangi seviyede yoğunlaşıyor?</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Grafik burada tek başına bir kart değil. Portföyün hangi yoğunlukta risk ürettiğini, hangi
                    seviyenin baskın olduğunu ve müdahale tonunu birlikte anlatan bir hikâye paneli.
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
                            width: `${riskDistribution.reduce((sum, entry) => sum + entry.value, 0) > 0 ? (item.value / riskDistribution.reduce((sum, entry) => sum + entry.value, 0)) * 100 : 0}%`,
                            background: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
                {loading ? (
                  <div className="h-[340px] animate-pulse rounded-2xl bg-slate-900/70" />
                ) : riskDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={340}>
                    <PieChart>
                      <Pie
                        data={riskDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={110}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth={2}
                      >
                        {riskDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[340px] flex-col items-center justify-center text-muted-foreground">
                    <AlertCircle className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">Henüz denetim verisi yok</p>
                    <p className="mt-1 text-xs">İlk denetiminizi oluşturun</p>
                  </div>
                )}
              </div>
            </div>
          </StorySurface>

          <StorySurface className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(10,14,26,0.98),rgba(20,26,44,0.92))] p-6 md:p-7">
            <div className="absolute left-0 top-10 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Field Story</p>
                  <h3 className="mt-3 text-[1.95rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white">Sahadan son gelen hareketler</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Bu alan son denetimleri sadece listelemez; kritik yoğunluğu ve tamamlanma durumunu yöneticinin
                    tarayabileceği hızlı bir akış halinde gösterir.
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
                        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">Saha Günlüğü</p>
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
        </RevealBlock>

        <RevealBlock delay={240} className="space-y-6">
          <section className="grid gap-4 md:grid-cols-[0.74fr_1.26fr]">
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,29,0.96),rgba(8,12,22,0.98))] p-6">
              <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Narrative Cue</p>
              <h3 className="mt-3 text-[1.7rem] font-semibold leading-[1.05] tracking-[-0.04em] text-white">
                Rapor değil, okuma sırası olan bir yönetim yüzeyi
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-300">
                Sağ blok trendin yönünü, alttaki bildirim odası ise o yönü bozan gerçek zamanlı sinyalleri gösterir.
                Böylece yönetici önce eğilimi, sonra kesintiyi okur.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.08),rgba(99,102,241,0.08),rgba(15,23,42,0.85))] p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Son Ay</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{latestTrend}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Önceki Ay</p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{previousTrend}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Yorum</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {momentumDelta > 0
                      ? "Denetim temposu toparlanıyor."
                      : momentumDelta < 0
                        ? "Ritim zayıflıyor, planlama gözden geçirilmeli."
                        : "Ritim stabil ilerliyor."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <StorySurface className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(9,13,24,0.98),rgba(19,24,41,0.92))] p-6 md:p-7">
            <div className="absolute bottom-0 right-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="relative space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Momentum Story</p>
                  <h3 className="mt-3 text-[1.95rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white">Denetim ritmi nasıl değişiyor?</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    Son altı ayın hareketini, ani düşüş veya yükselişleri daha sinematik bir yüzeyde gösteren trend
                    paneli. Yöneticiye sayıdan çok yön hissi verir.
                  </p>
                </div>
                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-200">
                  6 aylık görünüm
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {monthlyTrend.map((item) => (
                  <div key={item.month} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{item.month}</p>
                    <p className="mt-2 text-2xl font-semibold text-white">{item.denetimler}</p>
                    <p className="mt-1 text-xs text-slate-400">Tamamlanan denetim</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[26px] border border-white/8 bg-black/20 p-4">
                {loading ? (
                  <div className="h-[320px] animate-pulse rounded-2xl bg-slate-900/70" />
                ) : monthlyTrend.some((m) => m.denetimler > 0) ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={monthlyTrend}>
                      <defs>
                        <linearGradient id="storyTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                          <stop offset="60%" stopColor="#3b82f6" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#243042" />
                      <XAxis dataKey="month" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #243042",
                          borderRadius: "12px",
                        }}
                        labelStyle={{ color: "#f8fafc" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="denetimler"
                        stroke="#22d3ee"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#storyTrend)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[320px] flex-col items-center justify-center text-muted-foreground">
                    <TrendingUp className="mb-3 h-12 w-12 opacity-30" />
                    <p className="text-sm">Henüz trend verisi yok</p>
                    <p className="mt-1 text-xs">Denetimler eklendikçe grafik oluşacak</p>
                  </div>
                )}
              </div>
            </div>
          </StorySurface>

          <StorySurface className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(9,13,24,0.98),rgba(19,24,41,0.92))] p-6 md:p-7">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Signal Room</p>
                <h3 className="mt-3 text-[1.95rem] font-semibold leading-[1.04] tracking-[-0.045em] text-white">Canlı bildirim odası</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Operasyon akışını kesen uyarılar, hatırlatmalar ve işlem çağrıları bu bölümde odaklı biçimde toplanır.
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
        </RevealBlock>
      </div>
    </div>
  );
}
