import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Gauge,
  RefreshCcw,
  ScrollText,
  ShieldAlert,
  Sparkles,
  Users,
  Waypoints,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { getOsgbDashboardCatalogData, type OsgbDashboardCatalogData } from "@/lib/osgbData";
import { getOsgbDashboardOperationalSummary, type OsgbDashboardOperationalSummary } from "@/lib/osgbOperations";

const CACHE_TTL_MS = 5 * 60 * 1000;

const getCacheKey = (userId: string) => `osgb:dashboard:${userId}`;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

type DashboardSnapshot = {
  data: OsgbDashboardCatalogData;
  operations: OsgbDashboardOperationalSummary;
};

type ModuleStatus = "good" | "warning" | "critical" | "info";

type ModuleCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  tone: string;
  status: ModuleStatus;
  statusLabel: string;
  stats: Array<{ label: string; value: string }>;
  lastActionLabel: string;
  lastActionValue: string;
  recommendedAction: string;
};

const statusStyles: Record<ModuleStatus, string> = {
  good: "border-emerald-400/20 bg-emerald-500/10 text-emerald-200",
  warning: "border-amber-400/20 bg-amber-500/10 text-amber-200",
  critical: "border-red-400/20 bg-red-500/10 text-red-200",
  info: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
};

function LoadingCatalog() {
  return (
    <div className="container mx-auto space-y-5 py-5 sm:space-y-6 sm:py-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 sm:p-6">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-3 sm:space-y-4">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
            <div className="h-10 w-full max-w-md animate-pulse rounded bg-slate-800" />
            <div className="h-20 w-full animate-pulse rounded bg-slate-800" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-800" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-72 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        ))}
      </div>
    </div>
  );
}

export default function OSGBDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState<OsgbDashboardCatalogData | null>(null);
  const [operations, setOperations] = useState<OsgbDashboardOperationalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async (force = false) => {
    if (!user) return;

    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [dashboardData, operationalSummary] = await Promise.all([
        getOsgbDashboardCatalogData(user.id),
        getOsgbDashboardOperationalSummary(user.id),
      ]);

      setData(dashboardData);
      setOperations(operationalSummary);
      setError(null);

      writeOsgbPageCache<DashboardSnapshot>(getCacheKey(user.id), {
        data: dashboardData,
        operations: operationalSummary,
      });
    } catch (err) {
      console.error("OSGB dashboard yükleme hatası:", err);
      if (!data || !operations) {
        setError("OSGB katalog verisi yüklenemedi. Sayfayı yenileyip tekrar deneyin.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    const cached = readOsgbPageCache<DashboardSnapshot>(getCacheKey(user.id), CACHE_TTL_MS);
    if (cached) {
      setData(cached.data);
      setOperations(cached.operations);
      setLoading(false);
      void loadDashboard(true);
      return;
    }

    void loadDashboard();
  }, [user]);

  const overviewCards = useMemo(() => {
    if (!data || !operations) return [];

    return [
      {
        title: "Portföy kapsamı",
        value: `${data.summary.totalCompanies} firma`,
        detail: `${data.summary.totalEmployees.toLocaleString("tr-TR")} çalışan`,
      },
      {
        title: "Uyum ve risk",
        value: `%${data.summary.coverageRate} süre uyumu`,
        detail: `${data.summary.criticalCompanies} kritik firma`,
      },
      {
        title: "Finans baskısı",
        value: formatCurrency(operations.finance.overdueAmount),
        detail: `${operations.finance.overdueCount} geciken tahsilat`,
      },
      {
        title: "Evrak takibi",
        value: `${operations.documents.warningCount + operations.documents.expiredCount} kayıt`,
        detail: `${operations.documents.expiredCount} süresi dolmuş`,
      },
    ];
  }, [data, operations]);

  const featureCards = useMemo<ModuleCard[]>(() => {
    if (!data || !operations) return [];

    return [
      {
        title: "Personel Havuzu",
        description: "Uzman, hekim ve DSP kadrosunu kapasite, belge geçerliliği ve uzmanlık alanlarıyla yönetin.",
        href: "/osgb/personnel",
        icon: Users,
        tone: "from-cyan-500/15 to-blue-500/5",
        status: data.latestSyncDate ? "good" : "info",
        statusLabel: data.latestSyncDate ? "Senkron güncel" : "İzleme aktif",
        stats: [
          { label: "Uzman yükü", value: `${data.expertLoads.length} kişi` },
          { label: "Kapsam", value: `${data.summary.totalCompanies} firma` },
        ],
        lastActionLabel: "Son işlem",
        lastActionValue: formatDate(data.latestSyncDate),
        recommendedAction: "Belge bitiş tarihlerini ve kapasite doluluklarını gözden geçir.",
      },
      {
        title: "Personel Görevlendirme",
        description: "Firma atamalarını yönetin, mevzuat önerisini görün ve mükerrer atamayı engelleyin.",
        href: "/osgb/assignments",
        icon: Briefcase,
        badge: "Öneri Motoru",
        tone: "from-indigo-500/15 to-blue-500/5",
        status: data.summary.coverageRate >= 90 ? "good" : data.summary.coverageRate >= 70 ? "warning" : "critical",
        statusLabel: data.summary.coverageRate >= 90 ? "Atama dengeli" : data.summary.coverageRate >= 70 ? "Süre açığı var" : "Kritik süre açığı",
        stats: [
          { label: "Toplam firma", value: `${data.summary.totalCompanies}` },
          { label: "Süre uyumu", value: `%${data.summary.coverageRate}` },
        ],
        lastActionLabel: "Son sözleşme",
        lastActionValue: formatDate(data.latestContractDate),
        recommendedAction: "Eksik dakika olan firmalar için atama planını güncelle.",
      },
      {
        title: "Firma Takibi",
        description: "Her firmanın atama, evrak, finans, görev ve not görünümünü tek ekrandan izleyin.",
        href: "/osgb/company-tracking",
        icon: Building2,
        tone: "from-emerald-500/15 to-green-500/5",
        status: data.summary.criticalCompanies > 0 ? "warning" : "good",
        statusLabel: data.summary.criticalCompanies > 0 ? "Kritik firma var" : "Portföy dengeli",
        stats: [
          { label: "Kritik firma", value: `${data.summary.criticalCompanies}` },
          { label: "Sözleşme baskısı", value: `${data.summary.expiringContracts}` },
        ],
        lastActionLabel: "Son senkron",
        lastActionValue: formatDate(data.latestSyncDate),
        recommendedAction: "Kritik firmaları drawer üzerinden hızlı aksiyonla kapat.",
      },
      {
        title: "Süre ve Kapasite",
        description: "Gerekli süre, atanmış süre ve uzman doluluk oranlarını operasyonel olarak karşılaştırın.",
        href: "/osgb/capacity",
        icon: Gauge,
        badge: "Canlı İzleme",
        tone: "from-amber-500/15 to-orange-500/5",
        status: data.expertLoads.some((item) => item.overloaded) ? "critical" : "good",
        statusLabel: data.expertLoads.some((item) => item.overloaded) ? "Eksik kapasite" : "Kapasite uygun",
        stats: [
          { label: "Eksik kapasite", value: `${data.expertLoads.filter((item) => item.overloaded).length} uzman` },
          { label: "Ortalama risk", value: `${data.summary.averageRiskScore}` },
        ],
        lastActionLabel: "Son kontrol",
        lastActionValue: formatDate(data.latestSyncDate),
        recommendedAction: "Aşırı yüklü uzmanlar için dakika dağılımını yeniden dengele.",
      },
      {
        title: "Uyarı Merkezi",
        description: "Sözleşme, uygunsuzluk ve öngörüsel risk uyarılarını önceliklendirip göreve dönüştürün.",
        href: "/osgb/alerts",
        icon: AlarmClock,
        badge: "Aksiyon",
        tone: "from-rose-500/15 to-red-500/5",
        status: data.summary.openFlags + data.summary.openAlerts > 0 ? "critical" : "good",
        statusLabel: data.summary.openFlags + data.summary.openAlerts > 0 ? "Açık uyarı var" : "Merkez temiz",
        stats: [
          { label: "Açık uygunsuzluk", value: `${data.summary.openFlags}` },
          { label: "Öngörüsel uyarı", value: `${data.summary.openAlerts}` },
        ],
        lastActionLabel: "Son uyarı",
        lastActionValue: formatDate(data.latestAlertDate || data.latestFlagDate),
        recommendedAction: "Önce kritik severity kayıtlarını göreve çevir.",
      },
      {
        title: "Finans Yönetimi",
        description: "Tahsilatları, geciken ödemeleri, haftalık planı ve ödeme takvimini izleyin.",
        href: "/osgb/finance",
        icon: CreditCard,
        tone: "from-violet-500/15 to-fuchsia-500/5",
        status: operations.finance.overdueCount > 0 ? "warning" : "good",
        statusLabel: operations.finance.overdueCount > 0 ? "Tahsilat baskısı var" : "Tahsilat dengeli",
        stats: [
          { label: "Bekleyen", value: formatCurrency(operations.finance.pendingAmount) },
          { label: "Geciken", value: formatCurrency(operations.finance.overdueAmount) },
        ],
        lastActionLabel: "Takvim görünümü",
        lastActionValue: `${operations.finance.calendarItemCount} kayıt`,
        recommendedAction: "Geciken tahsilatları haftalık planda öncele.",
      },
      {
        title: "Evrak Takibi",
        description: "Yaklaşan ve süresi dolan evrakları görün, batch ve manuel görev üretimini yönetin.",
        href: "/osgb/documents",
        icon: FileCheck2,
        tone: "from-sky-500/15 to-cyan-500/5",
        status: operations.documents.expiredCount > 0 ? "critical" : operations.documents.warningCount > 0 ? "warning" : "good",
        statusLabel: operations.documents.expiredCount > 0 ? "Süresi dolan evrak var" : operations.documents.warningCount > 0 ? "Yaklaşan evrak var" : "Evrak takibi temiz",
        stats: [
          { label: "Yaklaşan", value: `${operations.documents.warningCount}` },
          { label: "Süresi dolmuş", value: `${operations.documents.expiredCount}` },
        ],
        lastActionLabel: "Son senkron",
        lastActionValue: formatDate(data.latestSyncDate),
        recommendedAction: "Warning ve expired kayıtlar için batch veya manuel görev üret.",
      },
      {
        title: "Görev Motoru",
        description: "Bot, uyarı merkezi ve batch tarafından üretilen operasyon görevlerini yönetin.",
        href: "/osgb/tasks",
        icon: ClipboardList,
        tone: "from-blue-500/15 to-indigo-500/5",
        status: data.summary.openFlags + data.summary.openAlerts > 10 ? "warning" : "info",
        statusLabel: data.summary.openFlags + data.summary.openAlerts > 10 ? "Görev yükü artıyor" : "Görev akışı aktif",
        stats: [
          { label: "Potansiyel aksiyon", value: `${data.summary.openFlags + data.summary.openAlerts}` },
          { label: "Evrak tetikleyici", value: `${operations.documents.warningCount + operations.documents.expiredCount}` },
        ],
        lastActionLabel: "Kaynak yükü",
        lastActionValue: `${data.summary.openFlags + data.summary.openAlerts + operations.documents.warningCount + operations.documents.expiredCount} kayıt`,
        recommendedAction: "Açık uyarıları görev listesine dönüştürüp sorumlu ata.",
      },
      {
        title: "Operasyon Notları",
        description: "Firma bazlı operasyon bilgisini kurumsal hafızaya dönüştürün ve ekip içi not akışı tutun.",
        href: "/osgb/notes",
        icon: ScrollText,
        tone: "from-slate-500/15 to-slate-300/5",
        status: "info",
        statusLabel: "Kurumsal hafıza",
        stats: [
          { label: "Kullanım alanı", value: "Firma bazlı hafıza" },
          { label: "Portföy", value: `${data.summary.totalCompanies} firma` },
        ],
        lastActionLabel: "Son senkron",
        lastActionValue: formatDate(data.latestSyncDate),
        recommendedAction: "Kritik firmalar için son saha notlarını güncelle.",
      },
      {
        title: "Trend Analizi",
        description: "Finans ve evrak trendlerini tarih aralığı filtresiyle inceleyin, drill-down raporlarına geçin.",
        href: "/osgb/analytics?view=finance",
        icon: Activity,
        tone: "from-teal-500/15 to-cyan-500/5",
        status: "info",
        statusLabel: "Analiz hazır",
        stats: [
          { label: "Finans trend", value: `${operations.finance.monthlyTrendMonths} ay` },
          { label: "Evrak trend", value: `${operations.documents.monthlyTrendMonths} ay` },
        ],
        lastActionLabel: "Analiz kapsamı",
        lastActionValue: "Son 6 ay",
        recommendedAction: "Sapma gösteren aylarda drill-down analizi aç.",
      },
    ];
  }, [data, operations]);

  const quickStartCards = useMemo(() => {
    if (!data || !operations) return [];

    return [
      {
        title: "Bugün Öncelikli İşler",
        description: "Kritik uyarılar, geciken tahsilatlar ve süresi dolan evraklar.",
        href: "/osgb/alerts",
        icon: ShieldAlert,
        meta: `${data.summary.openFlags + data.summary.openAlerts} açık kayıt`,
      },
      {
        title: "Operasyon Sağlık Skoru",
        description: "Portföyün genel süre, finans ve evrak dengesini özet görün.",
        href: "/osgb/capacity",
        icon: Sparkles,
        meta: `%${Math.max(0, Math.min(100, Math.round((data.summary.coverageRate + (100 - Math.min(100, data.summary.averageRiskScore))) / 2)))}`,
      },
      {
        title: "Finans Planı",
        description: "Tahsilat baskısı yüksek firmalara ve haftalık ödeme planına geçin.",
        href: "/osgb/finance?status=overdue",
        icon: Waypoints,
        meta: `${operations.finance.overdueCount} geciken tahsilat`,
      },
    ];
  }, [data, operations]);

  if (loading && (!data || !operations)) {
    return <LoadingCatalog />;
  }

  if (!data || !operations) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>OSGB kataloğu yüklenemedi</AlertTitle>
          <AlertDescription>{error || "Veri okunamadı."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-5 sm:space-y-8 sm:py-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.86))] p-4 shadow-2xl shadow-slate-950/40 sm:p-6">
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="space-y-4 sm:space-y-5">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                OSGB operasyon kataloğu
              </Badge>
              <Badge variant="outline">Son sözleşme: {formatDate(data.latestContractDate)}</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                OSGB modülündeki tüm operasyon ekranları tek katalogda
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                Bu sayfa, OSGB modülünü kullanıcıya anlatan ana rehber ve hızlı başlat ekranıdır.
                Firma, personel, atama, finans, evrak ve görev süreçlerini kart bazında açar.
                Kullanıcı önce modülün ne iş yaptığını görür, sonra ilgili karta tıklayıp doğrudan o ekrana geçer.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {quickStartCards.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => navigate(item.href)}
                    className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-left transition hover:border-cyan-500/30 hover:bg-slate-900 sm:p-4"
                  >
                    <div className="mb-3 flex items-center justify-between sm:mb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200 sm:h-11 sm:w-11">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="text-sm font-semibold text-white sm:text-base">{item.title}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-400 sm:text-sm sm:leading-6">{item.description}</div>
                    <div className="mt-3 text-xs font-medium text-cyan-200 sm:mt-4">{item.meta}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {overviewCards.map((item) => (
              <Card key={item.title} className="border-slate-800 bg-slate-950/50">
                <CardContent className="space-y-2 p-4 sm:p-5">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.title}</div>
                  <div className="text-xl font-bold text-white sm:text-2xl">{item.value}</div>
                  <div className="text-xs text-slate-400 sm:text-sm">{item.detail}</div>
                </CardContent>
              </Card>
            ))}

            <div className="flex flex-col gap-3 sm:flex-row xl:flex-col">
              <Button className="flex-1" onClick={() => navigate("/osgb")}>
                Modül Tanıtımı
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => void loadDashboard(true)}
                disabled={refreshing}
              >
                <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                Yenile
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <Alert>
          <AlertTitle>Arka planda yenileme sırasında sorun oluştu</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-white">
          <BadgeCheck className="h-5 w-5 text-cyan-300" />
          OSGB modül bileşenleri
        </div>
        <p className="text-sm leading-6 text-slate-400">
          Her kart modülün bir operasyon alanını temsil eder. Kartın içindeki canlı sayı, durum rozeti,
          son işlem tarihi ve önerilen aksiyon satırı kullanıcıya ekranın ne iş yaptığını hızlıca anlatır.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {featureCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className={`group border-slate-800 bg-gradient-to-br ${card.tone} bg-slate-900/70 transition hover:-translate-y-1 hover:border-cyan-500/30`}
              >
                <CardHeader className="space-y-3 p-4 pb-0 sm:p-5 sm:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Badge className={cn("border", statusStyles[card.status])}>{card.statusLabel}</Badge>
                      {card.badge ? <Badge variant="outline">{card.badge}</Badge> : null}
                    </div>
                  </div>
                  <div>
                    <CardTitle className="text-lg text-white sm:text-xl">{card.title}</CardTitle>
                    <CardDescription className="pt-2 text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">
                      {card.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-4 pt-4 sm:p-5 sm:pt-5">
                  <div className="grid gap-3 grid-cols-2">
                    {card.stats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-950/45 p-3">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs">{stat.label}</div>
                        <div className="mt-2 text-xs font-semibold text-white sm:text-sm">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{card.lastActionLabel}</div>
                    <div className="text-sm font-medium text-white">{card.lastActionValue}</div>
                    <div className="text-xs leading-5 text-slate-400">Önerilen aksiyon: {card.recommendedAction}</div>
                  </div>

                  <Button className="w-full justify-between" onClick={() => navigate(card.href)}>
                    Ekranı Aç
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Kullanıcı bu sayfayı nasıl kullanır?</CardTitle>
            <CardDescription>Özellikle yeni kullanıcı için başlangıç akışı.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Önce portföy özetini kontrol eder ve hangi alanda baskı olduğunu görür.",
              "İhtiyacına göre Personel, Atama, Evrak veya Finans kartını açar.",
              "Uyarı Merkezi ve Görev Motoru ile aksiyon gerektiren kayıtları işler.",
              "Trend Analizi ile finans ve evrak hareketlerini denetler.",
            ].map((item, index) => (
              <div key={item} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-sm font-semibold text-cyan-200">
                  {index + 1}
                </div>
                <p className="text-sm leading-6 text-slate-300">{item}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Canlı operasyon özeti</CardTitle>
            <CardDescription>Bu katalog sayfası aynı zamanda günlük yönlendirme ekranı gibi davranır.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-200">
                <ShieldAlert className="h-4 w-4" />
                Kritik firma
              </div>
              <div className="text-2xl font-bold text-white">{data.summary.criticalCompanies}</div>
              <div className="mt-2 text-sm text-slate-400">Bugün öncelik verilmesi gereken portföy kayıtları.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-200">
                <FileCheck2 className="h-4 w-4" />
                Evrak baskısı
              </div>
              <div className="text-2xl font-bold text-white">
                {operations.documents.warningCount + operations.documents.expiredCount}
              </div>
              <div className="mt-2 text-sm text-slate-400">Yaklaşan veya süresi dolan evrakların toplamı.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-200">
                <CreditCard className="h-4 w-4" />
                Tahsilat riski
              </div>
              <div className="text-2xl font-bold text-white">{formatCurrency(operations.finance.overdueAmount)}</div>
              <div className="mt-2 text-sm text-slate-400">Gecikmiş finans kayıtları ve nakit akışı baskısı.</div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-cyan-200">
                <ClipboardList className="h-4 w-4" />
                Aksiyon yükü
              </div>
              <div className="text-2xl font-bold text-white">
                {data.summary.openFlags + data.summary.openAlerts + operations.documents.warningCount + operations.documents.expiredCount}
              </div>
              <div className="mt-2 text-sm text-slate-400">Uygunsuzluk, uyarı ve evrak baskısından türeyen operasyon hacmi.</div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
