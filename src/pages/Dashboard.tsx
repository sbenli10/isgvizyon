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
    tone: "border-cyan-400/30 bg-cyan-500/10 text-cyan-900 dark:text-cyan-100",
  },
  {
    title: "ISGVizyon İSG Bot Chrome eklentisi güncellendi",
    date: "12 Mayıs 2026",
    text: "İSG-KATİP ekranındaki firma/sözleşme verilerini açık onayla içeri aktarma akışı güçlendirildi.",
    tone: "border-emerald-400/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
  },
  {
    title: "Resmi çıktı şablonları iyileştirildi",
    date: "8 Mayıs 2026",
    text: "Yıllık plan, değerlendirme raporu ve eğitim planı çıktı düzenleri daha stabil hale getirildi.",
    tone: "border-violet-400/30 bg-violet-500/10 text-violet-900 dark:text-violet-100",
  },
  {
    title: "OSGB yönetim modülleri sadeleştirildi",
    date: "3 Mayıs 2026",
    text: "Firma arşivi, görevlendirme, yetkilendirme ve İSG-KATİP merkezi tek akışta toplandı.",
    tone: "border-orange-400/30 bg-orange-500/10 text-orange-900 dark:text-orange-100",
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

const getUserDisplayName = (user: ReturnType<typeof useAuth>["user"], profile: ReturnType<typeof useAuth>["profile"]) => {
  const typedProfile = profile as { full_name?: string; name?: string } | null | undefined;
  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  return typedProfile?.full_name || typedProfile?.name || metadata?.full_name || metadata?.name || user?.email?.split("@")[0] || "Kullanıcı";
};

async function safeCount(label: string, query: PromiseLike<{ count: number | null; error: { message?: string } | null }>): Promise<CountResult> {
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

async function safeRows<T>(label: string, query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>): Promise<RowsResult<T>> {
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
      client.from("companies").select("id").eq("org_id", orgId).eq("is_active", true)
    );

    if (byOrg.ok) {
      return byOrg.rows.map((company) => company.id);
    }
  }

  const byUser = await safeRows<{ id: string }>(
    "kullanıcı firmaları",
    client.from("companies").select("id").eq("user_id", userId).eq("is_active", true)
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
    <div className={`rounded-2xl border border-slate-200/80 bg-white/85 shadow-[0_18px_60px_rgba(8,13,35,0.10)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70 dark:shadow-[0_18px_60px_rgba(8,13,35,0.32)] ${className}`}>
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
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-700 dark:text-cyan-300/80">{eyebrow}</p> : null}
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
    <div
      className={`group relative min-h-[122px] overflow-hidden rounded-2xl border p-4 text-white shadow-[0_14px_36px_rgba(15,23,42,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(15,23,42,0.22)] dark:shadow-[0_18px_55px_rgba(2,8,23,0.55)] ${tone}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/18 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-white/82">
            {title}
          </p>

          <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            {formatNumber(value)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/16 p-2.5 text-white shadow-sm backdrop-blur">
          {icon}
        </div>
      </div>

      <p className="relative z-10 mt-3 line-clamp-2 text-xs font-medium leading-relaxed text-white/78">
        {hint}
      </p>
    </div>
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
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-950/45">
      <div className="flex min-w-0 items-center gap-3">
        <div className={`shrink-0 rounded-xl p-2 ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
          <p className="line-clamp-1 text-xs text-slate-600 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <Button size="sm" className="h-8 shrink-0 rounded-xl bg-cyan-500/15 text-xs text-cyan-800 hover:bg-cyan-500/25 dark:text-cyan-100" onClick={() => route && navigate(route)}>
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
    <div
      className={`group relative min-h-[145px] overflow-hidden rounded-2xl border p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:shadow-[0_18px_60px_rgba(2,8,23,0.55)] dark:hover:shadow-[0_24px_75px_rgba(2,8,23,0.72)] ${tone}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/18 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="rounded-xl border border-white/20 bg-white/16 p-2.5 text-white shadow-sm backdrop-blur">
          {icon}
        </div>

        {badge ? (
          <Badge className="border-white/20 bg-white/18 text-white shadow-sm backdrop-blur">
            {badge}
          </Badge>
        ) : null}
      </div>

      <div className="relative z-10 mt-4">
        <h3 className="text-base font-extrabold tracking-tight text-white">
          {title}
        </h3>

        <p className="mt-1.5 min-h-[34px] text-xs font-medium leading-relaxed text-white/82">
          {description}
        </p>

        <Button
          variant="ghost"
          className="mt-3 h-8 px-0 text-xs font-extrabold text-white hover:bg-transparent hover:text-white/85"
          onClick={handleClick}
        >
          {cta}
          <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
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
      className={`group relative min-h-[118px] overflow-hidden rounded-2xl border p-4 text-left text-white shadow-[0_14px_36px_rgba(15,23,42,0.16)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(15,23,42,0.22)] dark:shadow-[0_18px_55px_rgba(2,8,23,0.55)] ${tone}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/18 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-black/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold tracking-tight text-white">
          {title}
        </p>
        <span className="rounded-xl border border-white/20 bg-white/16 px-2.5 py-1 text-xl font-extrabold text-white shadow-sm backdrop-blur">
          {value}
        </span>
      </div>

      <p className="relative z-10 mt-3 text-xs font-medium leading-relaxed text-white/82">
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
          <Button variant="ghost" size="sm" className="h-8 text-xs text-cyan-700 hover:bg-cyan-500/10 hover:text-cyan-800 dark:text-cyan-200 dark:hover:text-cyan-100">
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
            <p className="mt-1 line-clamp-2 text-xs opacity-80">{item.text}</p>
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
          text: inspection.status === "completed" ? "Denetim tamamlandı" : inspection.status === "in_progress" ? "Denetim devam ediyor" : "Denetim taslakta",
          date: new Date(inspection.created_at).toLocaleDateString("tr-TR"),
        }))
      : [
          { title: "Risk sihirbazı hazır", text: "Yeni risk raporu oluşturmak için hızlı işlem kartını kullanabilirsiniz.", date: "Bugün" },
          { title: "Acil durum planı", text: "Firma özelinde ADEP planı hazırlama akışı hazır.", date: "Bu hafta" },
          { title: "İSG Bot", text: "Chrome eklentisi ile firma aktarımını başlatabilirsiniz.", date: "Yeni" },
        ];

  return (
    <DashboardCard className="p-4">
      <SectionHeader eyebrow="Akış" title="Son Aktiviteler" />
      <div className="space-y-3">
        {items.slice(0, 4).map((item) => (
          <div key={`${item.title}-${item.date}`} className="flex gap-3 rounded-xl bg-slate-50/80 p-3 dark:bg-slate-950/40">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.7)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-950 dark:text-white">{item.title}</p>
              <p className="line-clamp-1 text-xs text-slate-600 dark:text-slate-400">{item.text}</p>
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
  const orgId = (profile as { organization_id?: string | null } | null | undefined)?.organization_id ?? null;
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
        let companyIds = await fetchCompanyIds(user.id, orgId);

        nextStats.activeCompanies = companyIds.length;

        if (companyIds.length > 0) {
          const employees = await safeCount(
            "aktif çalışanlar",
            client.from("employees").select("id", { count: "exact", head: true }).in("company_id", companyIds).eq("is_active", true)
          );
          nextStats.employees = employees.count;
        }

        if (orgId) {
          const cached = forceRefresh ? null : readDashboardSnapshot(user.id);
          const isCacheValid = cached && cached.orgId === orgId && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL;
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
              .limit(8)
          );

          nextStats.recentInspections = inspections.rows;
          nextStats.activeInspections = inspections.rows.filter((inspection) => inspection.status === "in_progress").length;
          nextStats.criticalRiskPercent =
            inspections.rows.length > 0
              ? Math.round((inspections.rows.filter((inspection) => inspection.risk_level === "critical").length / inspections.rows.length) * 100)
              : 0;
        }

        const [monthlyReports, upcomingControls, draftMeetings] = await Promise.all([
          safeCount(
            "bu ay oluşturulan rapor",
            client.from("document_analyses").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", getMonthStartIso())
          ),
          safeCount(
            "yaklaşan periyodik kontrol",
            client
              .from("periodic_controls")
              .select("id", { count: "exact", head: true })
              .gte("next_control_date", getTodayIsoDate())
              .lte("next_control_date", getNextDateIso(30))
          ),
          safeCount("taslak kurul toplantısı", client.from("board_meetings").select("id", { count: "exact", head: true }).eq("status", "draft")),
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
    [orgId, user?.id]
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
    icon: <Building2 className="h-5 w-5 text-white" />,
    tone:
      "border-cyan-300/25 bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 dark:border-cyan-300/20 dark:from-cyan-700 dark:via-sky-800 dark:to-blue-950",
  },
  {
    title: "Toplam Çalışan",
    value: stats.employees,
    hint: "Firma kayıtlarından gelen aktif çalışan sayısı.",
    icon: <Users className="h-5 w-5 text-white" />,
    tone:
      "border-emerald-300/25 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 dark:border-emerald-300/20 dark:from-emerald-700 dark:via-teal-800 dark:to-green-950",
  },
  {
    title: "Açık DÖF",
    value: stats.openCapa,
    hint: "Kapanmayı bekleyen düzeltici/önleyici aksiyonlar.",
    icon: <ClipboardCheck className="h-5 w-5 text-white" />,
    tone:
      "border-rose-300/25 bg-gradient-to-br from-rose-600 via-red-600 to-rose-800 dark:border-rose-300/20 dark:from-rose-700 dark:via-red-800 dark:to-rose-950",
  },
  {
    title: "Yaklaşan Periyodik Kontrol",
    value: stats.upcomingControls,
    hint: "Önümüzdeki 30 gün içinde takibe düşen kontroller.",
    icon: <CalendarClock className="h-5 w-5 text-white" />,
    tone:
      "border-amber-300/25 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 dark:border-amber-300/20 dark:from-amber-600 dark:via-orange-800 dark:to-amber-950",
  },
  {
    title: "Taslak Kurul Toplantısı",
    value: stats.draftMeetings,
    hint: "Tamamlanmayı bekleyen kurul toplantısı kayıtları.",
    icon: <ClipboardList className="h-5 w-5 text-white" />,
    tone:
      "border-violet-300/25 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 dark:border-violet-300/20 dark:from-violet-700 dark:via-fuchsia-800 dark:to-purple-950",
  },
  {
    title: "Bu Ay Oluşturulan Rapor",
    value: stats.monthlyReports,
    hint: "Bu ay hazırlanan analiz ve rapor çıktıları.",
    icon: <FileText className="h-5 w-5 text-white" />,
    tone:
      "border-sky-300/25 bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-600 dark:border-sky-300/20 dark:from-blue-700 dark:via-sky-800 dark:to-cyan-950",
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
      "border-cyan-300/25 bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-600 dark:border-cyan-300/20 dark:from-cyan-600 dark:via-sky-700 dark:to-blue-900",
  },
  {
    title: "Risk Sihirbazı",
    description: "Adım adım Fine-Kinney risk raporu oluşturun.",
    route: "/risk-wizard",
    cta: "Rapor hazırla",
    icon: <Sparkles className="h-5 w-5" />,
    tone:
      "border-violet-300/25 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-purple-700 dark:border-violet-300/20 dark:from-violet-700 dark:via-fuchsia-800 dark:to-purple-950",
    badge: "AI",
  },
  {
    title: "Acil Durum Planı",
    description: "ADEP planı, ekipler, senaryolar ve resmi çıktılar.",
    route: "/adep-wizard",
    cta: "Plan oluştur",
    icon: <ShieldAlert className="h-5 w-5" />,
    tone:
      "border-orange-300/25 bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 dark:border-orange-300/20 dark:from-orange-600 dark:via-amber-800 dark:to-orange-950",
  },
  {
    title: "Chrome Web Store",
    description: "ISGVizyon İSG Bot eklentisi ile İSG-KATİP firma aktarımını hızlandırın.",
    externalUrl: CHROME_STORE_URL,
    cta: "Hemen yükle",
    icon: <Bot className="h-5 w-5" />,
    tone:
      "border-sky-300/25 bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-600 dark:border-sky-300/20 dark:from-blue-700 dark:via-sky-800 dark:to-cyan-950",
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
      "border-purple-300/25 bg-gradient-to-br from-purple-600 via-fuchsia-600 to-violet-700 dark:border-purple-300/20 dark:from-purple-700 dark:via-fuchsia-800 dark:to-violet-950",
    badge: "YENİ",
  },
  {
    title: "Personel Görevlendirme",
    description: "Uzman, hekim ve DSP atamalarını portföy kapasitesine göre yönetin.",
    route: "/osgb/assignments",
    cta: "İncele",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    tone:
      "border-emerald-300/25 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 dark:border-emerald-300/20 dark:from-emerald-700 dark:via-teal-800 dark:to-green-950",
    badge: "OSGB",
  },
  {
    title: "Firma Yetkilendirme",
    description: "Müşteri portalı ve dış erişim bağlantılarını kontrollü şekilde yönetin.",
    route: "/osgb/client-portal",
    cta: "Yetkilendir",
    icon: <Zap className="h-5 w-5" />,
    tone:
      "border-orange-300/25 bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 dark:border-orange-300/20 dark:from-orange-600 dark:via-amber-800 dark:to-orange-950",
  },
  {
    title: "İSG-KATİP / Chrome Eklentisi",
    description: "Aktarım, uyum bayrakları ve senkronizasyon durumlarını izleyin.",
    route: "/osgb/isgkatip",
    cta: "Merkeze git",
    icon: <Bot className="h-5 w-5" />,
    tone:
      "border-sky-300/25 bg-gradient-to-br from-blue-600 via-sky-600 to-cyan-600 dark:border-sky-300/20 dark:from-blue-700 dark:via-sky-800 dark:to-cyan-950",
  },
];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 text-slate-950 dark:bg-[#08111f] dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1800px] flex-col gap-5">
        <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-indigo-600 via-fuchsia-600 to-violet-700 px-5 py-4 text-white shadow-[0_18px_55px_rgba(88,28,135,0.35)]">
  <div className="pointer-events-none absolute -left-16 top-0 h-32 w-32 rounded-full bg-cyan-300/20 blur-3xl" />
  <div className="pointer-events-none absolute right-64 -top-16 h-40 w-40 rounded-full bg-pink-300/20 blur-3xl" />
  <div className="pointer-events-none absolute -right-12 -bottom-16 h-40 w-40 rounded-full bg-indigo-950/30 blur-3xl" />

  <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-white/75">
        İyi Akşamlar
      </p>

      <h1 className="mt-1 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
        {displayName}
      </h1>

      <p className="mt-2 hidden max-w-xl text-xs font-medium leading-relaxed text-white/70 md:block">
        İSG süreçlerinizi tek panelden takip edin, kritik aksiyonları hızlıca yönetin.
      </p>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="h-9 rounded-xl bg-cyan-400 px-4 text-xs font-extrabold text-slate-950 shadow-[0_10px_28px_rgba(34,211,238,0.25)] hover:bg-cyan-300"
          onClick={() => navigate("/osgb/field-visits")}
        >
          <MapPin className="mr-2 h-3.5 w-3.5" />
          Firma Ziyareti Bildir
        </Button>

        <Button
          className="h-9 rounded-xl bg-orange-400 px-4 text-xs font-extrabold text-slate-950 shadow-[0_10px_28px_rgba(251,146,60,0.24)] hover:bg-orange-300"
          onClick={() => navigate("/settings?tab=billing&upgrade=1")}
        >
          <Sparkles className="mr-2 h-3.5 w-3.5" />
          Şimdi Satın Al
        </Button>
      </div>

      <div className="min-w-[220px] rounded-2xl border border-white/18 bg-white/12 px-4 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_14px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl">
        <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-white/55">
          Mevcut Abonelik
        </p>

        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="text-lg font-extrabold leading-none text-white">
              {planLabel}
            </p>

            <p className="mt-2 text-[11px] font-medium text-white/72">
              Başlangıç: <span className="font-bold text-white">-</span>
              <span className="mx-1 text-white/35">•</span>
              Bitiş: <span className="font-bold text-white">Süresiz</span>
            </p>
          </div>

          <span className="rounded-full border border-emerald-300/25 bg-emerald-300/15 px-2 py-0.5 text-[10px] font-bold text-emerald-100">
            Aktif
          </span>
        </div>
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
                    className="h-8 text-xs text-cyan-200 hover:bg-cyan-500/10 hover:text-cyan-100"
                    onClick={() => loadDashboard(true)}
                    disabled={refreshing}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
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
                  tone="border-rose-300/25 bg-gradient-to-br from-rose-600 via-red-600 to-rose-800 dark:border-rose-300/20 dark:from-rose-700 dark:via-red-800 dark:to-rose-950"
                />

                <RiskSummaryCard
                  title="Orta Öncelik"
                  value={formatNumber(stats.openFindings)}
                  description="Açık bulgular ve takip bekleyen iyileştirmeler."
                  route="/inspections"
                  tone="border-amber-300/25 bg-gradient-to-br from-amber-500 via-orange-500 to-amber-700 dark:border-amber-300/20 dark:from-amber-600 dark:via-orange-800 dark:to-amber-950"
                />

                <RiskSummaryCard
                  title="Düşük Öncelik"
                  value={formatNumber(Math.max(stats.activeCompanies - stats.openCapa, 0))}
                  description="Kontrol altında görünen firma ve süreçler."
                  route="/companies"
                  tone="border-emerald-300/25 bg-gradient-to-br from-emerald-600 via-teal-600 to-green-700 dark:border-emerald-300/20 dark:from-emerald-700 dark:via-teal-800 dark:to-green-950"
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Durum</p>
                  <h2 className="mt-1 text-lg font-semibold text-white">Operasyon Nabzı</h2>
                </div>
                {loading ? (
                  <Badge className="bg-slate-700 text-slate-200">Yükleniyor</Badge>
                ) : (
                  <Badge className="bg-emerald-500/15 text-emerald-200">Sistem hazır</Badge>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                  <AlertTriangle className="h-4 w-4 text-rose-300" />
                  <p className="mt-2 text-xl font-bold text-white">{formatNumber(stats.overdueActions)}</p>
                  <p className="text-xs text-slate-400">Geciken aksiyon</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <p className="mt-2 text-xl font-bold text-white">{formatNumber(stats.activeInspections)}</p>
                  <p className="text-xs text-slate-400">Aktif denetim</p>
                </div>
              </div>
            </DashboardCard>
            <AnnouncementList />
            <RecentActivityList inspections={stats.recentInspections} />
            <DashboardCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-500/15 p-3 text-cyan-100">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Chrome eklentisiyle hız kazanın</p>
                  <p className="mt-1 text-xs text-slate-400">Firma aktarımı ve İSG-KATİP takibini tek yerden yönetin.</p>
                </div>
              </div>
              <Button className="mt-4 h-9 w-full rounded-xl bg-cyan-500 text-sm font-semibold text-slate-950 hover:bg-cyan-400" onClick={() => window.open(CHROME_STORE_URL, "_blank", "noopener,noreferrer")}>
                Eklentiyi Aç
              </Button>
            </DashboardCard>
          </aside>
        </div>
      </div>
    </div>
  );
}
