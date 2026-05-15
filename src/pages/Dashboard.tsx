import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  Bot,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileText,
  MapPin,
  Megaphone,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DASHBOARD_CACHE_TTL,
  fetchDashboardSnapshot,
  readDashboardSnapshot,
  writeDashboardSnapshot,
  type DashboardInspection,
  type DashboardSnapshot,
} from "@/lib/dashboardCache";

type CountResult = {
  ok: boolean;
  count: number;
};

type RowsResult<T> = {
  ok: boolean;
  rows: T[];
};

type DashboardStats = {
  activeCompanies: number;
  employees: number;
  openCapa: number;
  upcomingControls: number;
  draftMeetings: number;
  monthlyReports: number;
  activeInspections: number;
  openFindings: number;
  criticalRiskPercent: number;
  overdueActions: number;
  recentInspections: DashboardInspection[];
  riskDistribution: DashboardSnapshot["riskDistribution"];
};

type ActionCard = {
  title: string;
  description: string;
  route?: string;
  externalUrl?: string;
  cta: string;
  icon: ReactNode;
  tone: string;
  badge?: string;
};

const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/ombgdbjkinmfbkpenjihlakgdppkcdbj";

const EMPTY_STATS: DashboardStats = {
  activeCompanies: 0,
  employees: 0,
  openCapa: 0,
  upcomingControls: 0,
  draftMeetings: 0,
  monthlyReports: 0,
  activeInspections: 0,
  openFindings: 0,
  criticalRiskPercent: 0,
  overdueActions: 0,
  recentInspections: [],
  riskDistribution: [],
};

const announcementItems = [
  {
    title: "Çalışma Talimatları AI üretimi yayında",
    date: "15 Mayıs 2026",
    text: "İş/makine adına göre beş başlıklı profesyonel talimat üretip PDF ve Word olarak indirebilirsiniz.",
    tone:
      "border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-100",
  },
  {
    title: "ISGVizyon İSG Bot Chrome eklentisi güncellendi",
    date: "12 Mayıs 2026",
    text: "İSG-KATİP ekranındaki firma/sözleşme verilerini açık onayla içeri aktarma akışı güçlendirildi.",
    tone:
      "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
  },
  {
    title: "Resmi çıktı şablonları iyileştirildi",
    date: "8 Mayıs 2026",
    text: "Yıllık plan, değerlendirme raporu ve eğitim planı çıktı düzenleri daha stabil hale getirildi.",
    tone:
      "border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-100",
  },
  {
    title: "OSGB yönetim modülleri sadeleştirildi",
    date: "3 Mayıs 2026",
    text: "Firma arşivi, görevlendirme, yetkilendirme ve İSG-KATİP merkezi tek akışta toplandı.",
    tone:
      "border-orange-300 bg-orange-50 text-orange-950 dark:border-orange-400/30 dark:bg-orange-500/10 dark:text-orange-100",
  },
];

const getMonthStartIso = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
};

const getTodayIsoDate = () => new Date().toISOString().slice(0, 10);

const getNextDateIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const formatNumber = (value: number) => new Intl.NumberFormat("tr-TR").format(value);

const getPlanLabel = (plan?: string | null, status?: string | null) => {
  if (plan === "osgb") return "OSGB Paket";
  if (plan === "premium") return "Premium";
  if (status === "trial") return "Deneme";
  return "Ücretsiz";
};

const getUserDisplayName = (
  user: ReturnType<typeof useAuth>["user"],
  profile: ReturnType<typeof useAuth>["profile"],
) => {
  const typedProfile = profile as { full_name?: string; name?: string } | null | undefined;
  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;

  return (
    typedProfile?.full_name ||
    typedProfile?.name ||
    metadata?.full_name ||
    metadata?.name ||
    user?.email?.split("@")[0] ||
    "Kullanıcı"
  );
};

async function safeCount(
  label: string,
  query: PromiseLike<{ count: number | null; error: { message?: string } | null }>,
): Promise<CountResult> {
  try {
    const { count, error } = await query;

    if (error) {
      console.warn(`[Dashboard] ${label} sayısı alınamadı:`, error.message);
      return { ok: false, count: 0 };
    }

    return { ok: true, count: count ?? 0 };
  } catch (error) {
    console.warn(`[Dashboard] ${label} sayısı alınamadı:`, error);
    return { ok: false, count: 0 };
  }
}

async function safeRows<T>(
  label: string,
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
): Promise<RowsResult<T>> {
  try {
    const { data, error } = await query;

    if (error) {
      console.warn(`[Dashboard] ${label} verisi alınamadı:`, error.message);
      return { ok: false, rows: [] };
    }

    return { ok: true, rows: data ?? [] };
  } catch (error) {
    console.warn(`[Dashboard] ${label} verisi alınamadı:`, error);
    return { ok: false, rows: [] };
  }
}

async function fetchCompanyIds(userId: string, orgId?: string | null) {
  const client = supabase as any;

  if (orgId) {
    const byOrg = await safeRows<{ id: string }>(
      "kuruluş firmaları",
      client.from("companies").select("id").eq("org_id", orgId).eq("is_active", true),
    );

    if (byOrg.ok) {
      return byOrg.rows.map((company) => company.id);
    }
  }

  const byUser = await safeRows<{ id: string }>(
    "kullanıcı firmaları",
    client.from("companies").select("id").eq("user_id", userId).eq("is_active", true),
  );

  return byUser.rows.map((company) => company.id);
}

function applySnapshot(base: DashboardStats, snapshot: DashboardSnapshot): DashboardStats {
  return {
    ...base,
    activeInspections: snapshot.activeInspections,
    openFindings: snapshot.openFindings,
    openCapa: snapshot.openFindings,
    criticalRiskPercent: snapshot.criticalRiskPercent,
    overdueActions: snapshot.overdueActions,
    recentInspections: snapshot.recentInspections,
    riskDistribution: snapshot.riskDistribution,
  };
}

function DashboardCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white text-slate-950 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0f172a]/92 dark:text-slate-100 dark:shadow-[0_18px_60px_rgba(2,8,23,0.45)] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300/80">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  icon,
  tone,
}: {
  title: string;
  value: number;
  hint: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <DashboardCard className="group overflow-hidden p-4 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-300/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
            {formatNumber(value)}
          </p>
        </div>
        <div className={`rounded-2xl p-2.5 ${tone}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{hint}</p>
    </DashboardCard>
  );
}

function CompactAction({
  title,
  description,
  route,
  cta,
  icon,
  tone,
}: ActionCard) {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 p-3 shadow-sm dark:border-white/10 dark:bg-slate-950/45 dark:shadow-none">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`shrink-0 rounded-xl p-2 ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
          <p className="line-clamp-1 text-xs text-slate-600 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        className="h-8 shrink-0 rounded-xl bg-cyan-500/15 text-xs text-cyan-800 hover:bg-cyan-500/25 dark:text-cyan-100"
        onClick={() => route && navigate(route)}
      >
        {cta}
      </Button>
    </div>
  );
}

function LargeActionCard({
  title,
  description,
  route,
  externalUrl,
  cta,
  icon,
  tone,
  badge,
}: ActionCard) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (externalUrl) {
      window.open(externalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (route) navigate(route);
  };

  return (
    <DashboardCard
      className={`group relative min-h-[190px] overflow-hidden p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_70px_rgba(15,23,42,0.16)] dark:hover:shadow-[0_22px_70px_rgba(2,8,23,0.62)] ${tone}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-slate-900/[0.04] blur-2xl dark:bg-white/[0.08]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white/40 to-transparent dark:from-black/15" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="rounded-2xl border border-slate-300/70 bg-white/90 p-3 text-slate-900 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-white">
          {icon}
        </div>

        {badge ? (
          <Badge className="border-slate-300 bg-white/85 text-slate-800 shadow-sm dark:border-white/20 dark:bg-white/15 dark:text-white">
            {badge}
          </Badge>
        ) : null}
      </div>

      <div className="relative mt-4">
        <h3 className="text-base font-bold text-slate-950 dark:text-white">
          {title}
        </h3>

        <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-slate-700 dark:text-slate-200/80">
          {description}
        </p>

        <Button
          variant="ghost"
          className="mt-4 h-8 px-0 text-xs font-bold text-slate-900 hover:bg-transparent hover:text-cyan-700 dark:text-white dark:hover:text-cyan-100"
          onClick={handleClick}
        >
          {cta}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </DashboardCard>
  );
}

function RiskSummaryCard({
  title,
  value,
  description,
  route,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  route: string;
  tone: string;
}) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(route)}
      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${tone}`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
        <span className="text-xl font-bold text-slate-950 dark:text-white">{value}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-white/70">
        {description}
      </p>
    </button>
  );
}

function AnnouncementList() {
  return (
    <DashboardCard className="p-4">
      <SectionHeader
        eyebrow="Güncel"
        title="Duyurular & Yenilikler"
        action={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-cyan-700 hover:bg-cyan-500/10 hover:text-cyan-800 dark:text-cyan-200 dark:hover:text-cyan-100"
          >
            Tümünü Gör
          </Button>
        }
      />

      <div className="space-y-2">
        {announcementItems.slice(0, 4).map((item) => (
          <div key={item.title} className={`rounded-xl border p-3 ${item.tone}`}>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{item.title}</p>
              <span className="shrink-0 text-[10px] opacity-75">{item.date}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs opacity-85">{item.text}</p>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

function RecentActivityList({ inspections }: { inspections: DashboardInspection[] }) {
  const items =
    inspections.length > 0
      ? inspections.map((inspection) => ({
          title: inspection.location_name || "Denetim kaydı",
          text:
            inspection.status === "completed"
              ? "Denetim tamamlandı"
              : inspection.status === "in_progress"
                ? "Denetim devam ediyor"
                : "Denetim taslakta",
          date: new Date(inspection.created_at).toLocaleDateString("tr-TR"),
        }))
      : [
          {
            title: "Risk sihirbazı hazır",
            text: "Yeni risk raporu oluşturmak için hızlı işlem kartını kullanabilirsiniz.",
            date: "Bugün",
          },
          {
            title: "Acil durum planı",
            text: "Firma özelinde ADEP planı hazırlama akışı hazır.",
            date: "Bu hafta",
          },
          {
            title: "İSG Bot",
            text: "Chrome eklentisi ile firma aktarımını başlatabilirsiniz.",
            date: "Yeni",
          },
        ];

  return (
    <DashboardCard className="p-4">
      <SectionHeader eyebrow="Akış" title="Son Aktiviteler" />

      <div className="space-y-3">
        {items.slice(0, 4).map((item) => (
          <div
            key={`${item.title}-${item.date}`}
            className="flex gap-3 rounded-xl border border-slate-200/70 bg-slate-50/90 p-3 dark:border-white/8 dark:bg-slate-950/40"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-500 shadow-[0_0_16px_rgba(6,182,212,0.5)] dark:bg-cyan-300 dark:shadow-[0_0_16px_rgba(34,211,238,0.7)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950 dark:text-white">
                {item.title}
              </p>
              <p className="line-clamp-1 text-xs text-slate-600 dark:text-slate-400">
                {item.text}
              </p>
              <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">{item.date}</p>
            </div>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { status, plan } = useSubscription();

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);

  usePageDataTiming(loading);

  const displayName = useMemo(() => getUserDisplayName(user, profile), [user, profile]);

  const orgId =
    (profile as { organization_id?: string | null } | null | undefined)?.organization_id ?? null;

  const planLabel = getPlanLabel(plan, status);

  const loadDashboard = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      if (forceRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const client = supabase as any;
        let nextStats: DashboardStats = { ...EMPTY_STATS };

        const companyIds = await fetchCompanyIds(user.id, orgId);

        nextStats.activeCompanies = companyIds.length;

        if (companyIds.length > 0) {
          const employees = await safeCount(
            "aktif çalışanlar",
            client
              .from("employees")
              .select("id", { count: "exact", head: true })
              .in("company_id", companyIds)
              .eq("is_active", true),
          );

          nextStats.employees = employees.count;
        }

        if (orgId) {
          const cached = forceRefresh ? null : readDashboardSnapshot(user.id);
          const isCacheValid =
            cached &&
            cached.orgId === orgId &&
            Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL;

          const snapshot = isCacheValid ? cached : await fetchDashboardSnapshot(orgId);

          if (!isCacheValid) writeDashboardSnapshot(user.id, snapshot);

          nextStats = applySnapshot(nextStats, snapshot);
        } else {
          const inspections = await safeRows<DashboardInspection>(
            "kişisel denetimler",
            client
              .from("inspections")
              .select("id, location_name, risk_level, status, created_at, org_id")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(8),
          );

          nextStats.recentInspections = inspections.rows;
          nextStats.activeInspections = inspections.rows.filter(
            (inspection) => inspection.status === "in_progress",
          ).length;

          nextStats.criticalRiskPercent =
            inspections.rows.length > 0
              ? Math.round(
                  (inspections.rows.filter((inspection) => inspection.risk_level === "critical")
                    .length /
                    inspections.rows.length) *
                    100,
                )
              : 0;
        }

        const [monthlyReports, upcomingControls, draftMeetings] = await Promise.all([
          safeCount(
            "bu ay oluşturulan rapor",
            client
              .from("document_analyses")
              .select("id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .gte("created_at", getMonthStartIso()),
          ),
          safeCount(
            "yaklaşan periyodik kontrol",
            client
              .from("periodic_controls")
              .select("id", { count: "exact", head: true })
              .gte("next_control_date", getTodayIsoDate())
              .lte("next_control_date", getNextDateIso(30)),
          ),
          safeCount(
            "taslak kurul toplantısı",
            client
              .from("board_meetings")
              .select("id", { count: "exact", head: true })
              .eq("status", "draft"),
          ),
        ]);

        nextStats.monthlyReports = monthlyReports.count;
        nextStats.upcomingControls = upcomingControls.count;
        nextStats.draftMeetings = draftMeetings.count;

        if (nextStats.openCapa === 0 && nextStats.openFindings > 0) {
          nextStats.openCapa = nextStats.openFindings;
        }

        if (mountedRef.current) setStats(nextStats);
      } catch (error) {
        console.error("Dashboard verileri alınamadı:", error);
        toast.error("Dashboard verileri alınırken bir sorun oluştu.");
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [orgId, user?.id],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadDashboard();

    return () => {
      mountedRef.current = false;
    };
  }, [loadDashboard]);

  const kpis = [
    {
      title: "Aktif Firma",
      value: stats.activeCompanies,
      hint: "Portföyünüzde takip edilen aktif işyerleri.",
      icon: <Building2 className="h-5 w-5 text-cyan-700 dark:text-cyan-100" />,
      tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-100",
    },
    {
      title: "Toplam Çalışan",
      value: stats.employees,
      hint: "Firma kayıtlarından gelen aktif çalışan sayısı.",
      icon: <Users className="h-5 w-5 text-emerald-700 dark:text-emerald-100" />,
      tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-100",
    },
    {
      title: "Açık DÖF",
      value: stats.openCapa,
      hint: "Kapanmayı bekleyen düzeltici/önleyici aksiyonlar.",
      icon: <ClipboardCheck className="h-5 w-5 text-rose-700 dark:text-rose-100" />,
      tone: "bg-rose-500/15 text-rose-700 dark:text-rose-100",
    },
    {
      title: "Yaklaşan Periyodik Kontrol",
      value: stats.upcomingControls,
      hint: "Önümüzdeki 30 gün içinde takibe düşen kontroller.",
      icon: <CalendarClock className="h-5 w-5 text-amber-700 dark:text-amber-100" />,
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-100",
    },
    {
      title: "Taslak Kurul Toplantısı",
      value: stats.draftMeetings,
      hint: "Tamamlanmayı bekleyen kurul toplantısı kayıtları.",
      icon: <ClipboardList className="h-5 w-5 text-violet-700 dark:text-violet-100" />,
      tone: "bg-violet-500/15 text-violet-700 dark:text-violet-100",
    },
    {
      title: "Bu Ay Oluşturulan Rapor",
      value: stats.monthlyReports,
      hint: "Bu ay hazırlanan analiz ve rapor çıktıları.",
      icon: <FileText className="h-5 w-5 text-sky-700 dark:text-sky-100" />,
      tone: "bg-sky-500/15 text-sky-700 dark:text-sky-100",
    },
  ];

  const priorityActions: ActionCard[] = [
    {
      title: "Risk değerlendirmesi oluştur",
      description: "Firma risklerini hızlı sihirbazla puanlayın ve raporlayın.",
      route: "/risk-wizard",
      cta: "Başla",
      icon: <TrendingUp className="h-4 w-4" />,
      tone: "bg-violet-500/15 text-violet-700 dark:text-violet-100",
    },
    {
      title: "Acil durum planı hazırla",
      description: "Tahliye, ekip ve senaryo planlarını tek ekranda tamamlayın.",
      route: "/adep-wizard",
      cta: "Hazırla",
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-100",
    },
    {
      title: "Firma ziyareti bildir",
      description: "OSGB saha hizmetinizi kanıtlarıyla kayıt altına alın.",
      route: "/osgb/field-visits",
      cta: "Bildir",
      icon: <MapPin className="h-4 w-4" />,
      tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-100",
    },
    {
      title: "Kurul toplantısı taslağını tamamla",
      description: "Gündem, kararlar ve katılımcıları resmi çıktı için hazırlayın.",
      route: "/board-meetings/new",
      cta: "Tamamla",
      icon: <ClipboardList className="h-4 w-4" />,
      tone: "bg-amber-500/15 text-amber-700 dark:text-amber-100",
    },
  ];

  const quickActions: ActionCard[] = [
  {
    title: "Yeni Firma Ekle",
    description: "Firma bilgilerini kaydedin, çalışan ve belge süreçlerini başlatın.",
    route: "/companies",
    cta: "Firma ekle",
    icon: <Plus className="h-5 w-5" />,
    tone:
      "border-cyan-300 bg-gradient-to-br from-cyan-100 via-cyan-50 to-white dark:border-cyan-400/20 dark:from-cyan-500/20 dark:via-slate-900/90 dark:to-slate-950",
  },
  {
    title: "Risk Sihirbazı",
    description: "Adım adım Fine-Kinney risk raporu oluşturun.",
    route: "/risk-wizard",
    cta: "Rapor hazırla",
    icon: <Sparkles className="h-5 w-5" />,
    tone:
      "border-violet-300 bg-gradient-to-br from-violet-100 via-fuchsia-50 to-white dark:border-violet-400/20 dark:from-violet-600/30 dark:via-slate-900/90 dark:to-fuchsia-950/40",
    badge: "AI",
  },
  {
    title: "Acil Durum Planı",
    description: "ADEP planı, ekipler, senaryolar ve resmi çıktılar.",
    route: "/adep-wizard",
    cta: "Plan oluştur",
    icon: <ShieldAlert className="h-5 w-5" />,
    tone:
      "border-orange-300 bg-gradient-to-br from-orange-100 via-amber-50 to-white dark:border-orange-400/20 dark:from-orange-600/28 dark:via-slate-900/90 dark:to-slate-950",
  },
  {
    title: "Chrome Web Store",
    description: "ISGVizyon İSG Bot eklentisi ile İSG-KATİP firma aktarımını hızlandırın.",
    externalUrl: CHROME_STORE_URL,
    cta: "Hemen yükle",
    icon: <Bot className="h-5 w-5" />,
    tone:
      "border-sky-300 bg-gradient-to-br from-sky-100 via-cyan-50 to-white dark:border-sky-400/20 dark:from-sky-500/25 dark:via-slate-900/90 dark:to-cyan-950/40",
    badge: "GOOGLE",
  },
];

 const osgbModules: ActionCard[] = [
  {
    title: "Firma Arşiv Depolama",
    description: "OSGB müşterilerinin resmi belge, PDF ve kayıtlarını güvenle saklayın.",
    route: "/osgb/documents",
    cta: "Arşive git",
    icon: <Archive className="h-5 w-5" />,
    tone:
      "border-purple-300 bg-gradient-to-br from-purple-100 via-violet-50 to-white dark:border-purple-400/20 dark:from-purple-600/30 dark:via-slate-900/90 dark:to-slate-950",
    badge: "YENİ",
  },
  {
    title: "Personel Görevlendirme",
    description: "Uzman, hekim ve DSP atamalarını portföy kapasitesine göre yönetin.",
    route: "/osgb/assignments",
    cta: "İncele",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    tone:
      "border-emerald-300 bg-gradient-to-br from-emerald-100 via-teal-50 to-white dark:border-emerald-400/20 dark:from-emerald-600/28 dark:via-slate-900/90 dark:to-teal-950/40",
    badge: "OSGB",
  },
  {
    title: "Firma Yetkilendirme",
    description: "Müşteri portalı ve dış erişim bağlantılarını kontrollü şekilde yönetin.",
    route: "/osgb/client-portal",
    cta: "Yetkilendir",
    icon: <Zap className="h-5 w-5" />,
    tone:
      "border-orange-300 bg-gradient-to-br from-orange-100 via-amber-50 to-white dark:border-orange-400/20 dark:from-orange-600/30 dark:via-slate-900/90 dark:to-amber-950/40",
  },
  {
    title: "İSG-KATİP / Chrome Eklentisi",
    description: "Aktarım, uyum bayrakları ve senkronizasyon durumlarını izleyin.",
    route: "/osgb/isgkatip",
    cta: "Merkeze git",
    icon: <Bot className="h-5 w-5" />,
    tone:
      "border-cyan-300 bg-gradient-to-br from-cyan-100 via-blue-50 to-white dark:border-cyan-400/20 dark:from-cyan-600/28 dark:via-slate-900/90 dark:to-blue-950/40",
  },
];

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950 dark:bg-[#08111f] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-r from-cyan-100 via-violet-100 to-indigo-100 p-5 shadow-[0_24px_90px_rgba(15,23,42,0.12)] dark:border-white/10 dark:from-indigo-600 dark:via-fuchsia-600 dark:to-violet-700 dark:shadow-[0_24px_90px_rgba(124,58,237,0.35)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-white/75">İyi Günler</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">
                {displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-700 dark:text-white/80">
                Bugün İSG süreçleriniz için kritik takipleri buradan yönetebilirsiniz.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row lg:items-stretch">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                <Button
                  className="h-10 rounded-xl bg-cyan-500 text-xs font-semibold text-white hover:bg-cyan-600 dark:bg-cyan-400 dark:text-slate-950 dark:hover:bg-cyan-300"
                  onClick={() => navigate("/companies")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Yeni Firma Ekle
                </Button>

                <Button
                  className="h-10 rounded-xl bg-orange-500 text-xs font-semibold text-white hover:bg-orange-600 dark:bg-orange-400 dark:text-slate-950 dark:hover:bg-orange-300"
                  onClick={() => navigate("/risk-wizard")}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Risk Raporu Oluştur
                </Button>

                <Button
                  className="h-10 rounded-xl bg-slate-900/10 text-xs font-semibold text-slate-950 hover:bg-slate-900/15 dark:bg-white/15 dark:text-white dark:hover:bg-white/25"
                  onClick={() => navigate("/osgb/field-visits")}
                >
                  <MapPin className="mr-2 h-4 w-4" />
                  Firma Ziyareti Bildir
                </Button>
              </div>

              <div className="min-w-[190px] rounded-2xl border border-slate-300/80 bg-white/70 p-4 text-slate-950 shadow-sm backdrop-blur dark:border-white/20 dark:bg-white/10 dark:text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-white/60">
                  Mevcut Abonelik
                </p>
                <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">{planLabel}</p>
                <p className="mt-1 text-xs text-slate-700 dark:text-white/70">
                  Başlangıç, bitiş ve kullanım durumunu ayarlardan yönetebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.title} {...kpi} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(360px,0.85fr)]">
          <div className="space-y-5">
            <DashboardCard className="p-4 sm:p-5">
              <SectionHeader
                eyebrow="Öncelik"
                title="Bugün Ne Yapmalıyım?"
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs text-cyan-700 hover:bg-cyan-500/10 hover:text-cyan-800 dark:text-cyan-200 dark:hover:text-cyan-100"
                    onClick={() => loadDashboard(true)}
                    disabled={refreshing}
                  >
                    <RefreshCw
                      className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Yenile
                  </Button>
                }
              />

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {priorityActions.map((action) => (
                  <CompactAction key={action.title} {...action} />
                ))}
              </div>
            </DashboardCard>

            <DashboardCard className="p-4 sm:p-5">
              <SectionHeader eyebrow="Uyum" title="Risk ve Uyum Özeti" />

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <RiskSummaryCard
                  title="Kritik Uyarı"
                  value={`${stats.criticalRiskPercent}%`}
                  description="Kritik risk oranı ve geciken aksiyonları gözden geçirin."
                  route="/inspections"
                  tone="border-rose-300 bg-rose-50 hover:border-rose-400 dark:border-rose-400/30 dark:bg-rose-500/12 dark:hover:border-rose-300/60"
                />

                <RiskSummaryCard
                  title="Orta Öncelik"
                  value={formatNumber(stats.openFindings)}
                  description="Açık bulgular ve takip bekleyen iyileştirmeler."
                  route="/inspections"
                  tone="border-amber-300 bg-amber-50 hover:border-amber-400 dark:border-amber-400/30 dark:bg-amber-500/12 dark:hover:border-amber-300/60"
                />

                <RiskSummaryCard
                  title="Düşük Öncelik"
                  value={formatNumber(Math.max(stats.activeCompanies - stats.openCapa, 0))}
                  description="Kontrol altında görünen firma ve süreçler."
                  route="/companies"
                  tone="border-emerald-300 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-400/30 dark:bg-emerald-500/12 dark:hover:border-emerald-300/60"
                />
              </div>
            </DashboardCard>

            <div>
              <SectionHeader eyebrow="Kısayollar" title="Hızlı İşlem Kartları" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {quickActions.map((action) => (
                  <LargeActionCard key={action.title} {...action} />
                ))}
              </div>
            </div>

            <div>
              <SectionHeader eyebrow="OSGB" title="OSGB Yönetim Modülleri" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                {osgbModules.map((action) => (
                  <LargeActionCard key={action.title} {...action} />
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <DashboardCard className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300/80">
                    Durum
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                    Operasyon Nabzı
                  </h2>
                </div>

                {loading ? (
                  <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    Yükleniyor
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-200">
                    Sistem hazır
                  </Badge>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-slate-950/40">
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-300" />
                  <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
                    {formatNumber(stats.overdueActions)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Geciken aksiyon</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 dark:border-white/10 dark:bg-slate-950/40">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <p className="mt-2 text-xl font-bold text-slate-950 dark:text-white">
                    {formatNumber(stats.activeInspections)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Aktif denetim</p>
                </div>
              </div>
            </DashboardCard>

            <AnnouncementList />

            <RecentActivityList inspections={stats.recentInspections} />

            <DashboardCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-700 dark:text-cyan-100">
                  <Megaphone className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">
                    Chrome eklentisiyle hız kazanın
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Firma aktarımı ve İSG-KATİP takibini tek yerden yönetin.
                  </p>
                </div>
              </div>

              <Button
                className="mt-4 h-9 w-full rounded-xl bg-cyan-500 text-sm font-semibold text-white hover:bg-cyan-600 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                onClick={() => window.open(CHROME_STORE_URL, "_blank", "noopener,noreferrer")}
              >
                Eklentiyi Aç
              </Button>
            </DashboardCard>
          </aside>
        </div>
      </div>
    </div>
  );
}