import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CreditCard,
  FileWarning,
  Gauge,
  RefreshCcw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import {
  getOsgbPlatformDashboard,
  type OsgbComplianceCompanyRecord,
  type OsgbPlatformDashboardData,
} from "@/lib/osgbPlatform";

const CACHE_TTL_MS = 5 * 60 * 1000;

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

const getCacheKey = (organizationId: string) => `osgb:platform-dashboard:${organizationId}`;

const complianceTone = (status: OsgbComplianceCompanyRecord["complianceStatus"]) => {
  switch (status) {
    case "compliant":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";
    case "warning":
      return "border-amber-400/20 bg-amber-500/10 text-amber-200";
    case "overdue":
    case "missing":
      return "border-rose-400/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-700 bg-slate-800/70 text-slate-200";
  }
};

function LoadingState() {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="h-40 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        ))}
      </div>
    </div>
  );
}

export default function OSGBDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [data, setData] = useState<OsgbPlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadDashboard = async (force = false) => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    if (force) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await getOsgbPlatformDashboard(organizationId, { refreshCompliance: true });
      setData(result);
      writeOsgbPageCache(getCacheKey(organizationId), result);
      setError(null);
    } catch (err) {
      console.error("OSGB platform dashboard yükleme hatası:", err);
      setError(err instanceof Error ? err.message : "OSGB dashboard verisi yüklenemedi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    const cached = readOsgbPageCache<OsgbPlatformDashboardData>(getCacheKey(organizationId), CACHE_TTL_MS);
    if (cached) {
      setData(cached);
      setLoading(false);
      void loadDashboard(true);
      return;
    }

    void loadDashboard();
  }, [organizationId]);

  const topGapCompanies = useMemo(
    () => (data?.complianceRows ?? []).filter((row) => row.deficitMinutes > 0).slice(0, 6),
    [data],
  );

  const financePressure = useMemo(
    () => (data?.complianceRows ?? []).filter((row) => row.overdueBalance > 0).sort((a, b) => b.overdueBalance - a.overdueBalance).slice(0, 6),
    [data],
  );

  const expiringContracts = useMemo(
    () => (data?.contractRows ?? []).filter((row) => row.contractStatus === "active" && row.endsOn).slice(0, 6),
    [data],
  );

  if (loading && !data) {
    return <LoadingState />;
  }

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertTitle>Organizasyon bağlantısı gerekli</AlertTitle>
          <AlertDescription>
            OSGB dashboard yeni operasyon omurgasıyla çalışıyor. Önce profilinizden bir organizasyona bağlanmanız gerekiyor.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertTitle>OSGB dashboard yüklenemedi</AlertTitle>
          <AlertDescription>{error || "Veri okunamadı."}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(15,23,42,0.86))] p-6 shadow-2xl shadow-slate-950/40">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border border-cyan-400/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                OSGB operasyon merkezi
              </Badge>
              <Badge variant="outline">Servis ayı: {formatDate(data.serviceMonth)}</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Mevzuat açığı, dakika dengesi ve finans baskısı tek ekranda
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
                Bu dashboard artık eski özet katalog değil; yeni OSGB veri omurgasına bağlı gerçek bir operasyon ekranı.
                Şu ay hangi firmada süre açığı var, hangi sözleşme yaklaşıyor, hangi tahsilat nakit akışını sıkıştırıyor
                ve ekip kapasitesi nerede zorlanıyor sorularını tek bakışta gösterir.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => navigate("/osgb/assignments")}
                className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-sm font-semibold text-white">Atama paneli</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  Rol bazlı dakika açığı olan firmaları düzenleyin ve bu ayın atamalarını tamamlayın.
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate("/osgb/capacity")}
                className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-sm font-semibold text-white">Dakika / kapasite</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  Personel yükü, eksik dakika ve mevzuat açığını detaylı panelde görün.
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate("/osgb/finance")}
                className="rounded-2xl border border-slate-800 bg-slate-950/45 p-4 text-left transition hover:border-cyan-500/30 hover:bg-slate-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-500" />
                </div>
                <div className="text-sm font-semibold text-white">Cari ve kârlılık</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">
                  Tahsilat riski yüksek müşterileri ve marj baskısını finans görünümünden yönetin.
                </div>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="border-slate-800 bg-slate-950/45">
              <CardContent className="space-y-2 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Mevzuat açığı</div>
                <div className="text-3xl font-bold text-white">{data.summary.totalDeficitMinutes} dk</div>
                <div className="text-sm text-slate-400">{data.summary.companiesWithGap} firmada bu ay açık görünüyor.</div>
              </CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-950/45">
              <CardContent className="space-y-2 p-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Tahsilat baskısı</div>
                <div className="text-3xl font-bold text-white">{formatCurrency(data.summary.overdueBalance)}</div>
                <div className="text-sm text-slate-400">{financePressure.length} müşteri gecikmiş bakiye taşıyor.</div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-3">
              <Button variant="outline" onClick={() => void loadDashboard(true)} disabled={refreshing}>
                <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                Dashboard yenile
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Uyumda olan firma</CardDescription>
            <CardTitle className="text-3xl text-white">{data.summary.compliantCompanies}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400">Bu ay dakika ve mevzuat açısından dengede kalan portföy.</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Aktif sözleşme</CardDescription>
            <CardTitle className="text-3xl text-white">{data.summary.activeContracts}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400">{data.summary.expiringContracts} sözleşme 30 gün içinde bitiyor.</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Mevzuat uyarısı</CardDescription>
            <CardTitle className="text-3xl text-white">{data.summary.overdueObligations + data.summary.warningObligations}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400">Gecikmiş veya yaklaşan obligation kayıtları.</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Ortalama marj</CardDescription>
            <CardTitle className={cn("text-3xl", data.summary.averageMargin >= 0 ? "text-white" : "text-rose-300")}>
              {formatCurrency(data.summary.averageMargin)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-400">Aktif portföy için tahmini aylık marj ortalaması.</CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShieldAlert className="h-5 w-5 text-amber-300" />
              Mevzuat Açığı Olan Firmalar
            </CardTitle>
            <CardDescription>Bu ay gerekli dakika karşılanmayan veya compliance durumu kırmızı olan firmalar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topGapCompanies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Açık dakika görünen firma kalmadı.
              </div>
            ) : (
              topGapCompanies.map((company) => (
                <div key={company.companyId} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-white">{company.companyName}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        {company.hazardClass} • {company.employeeCount} çalışan • {company.packageName || "Paket tanımsız"}
                      </div>
                    </div>
                    <Badge className={cn("border", complianceTone(company.complianceStatus))}>
                      {company.complianceStatus === "compliant"
                        ? "Uyumlu"
                        : company.complianceStatus === "warning"
                          ? "Uyarı"
                          : company.complianceStatus === "overdue"
                            ? "Gecikmiş"
                            : "Eksik"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                    <div>Toplam gerekli: <span className="font-semibold text-white">{company.totalRequiredMinutes} dk</span></div>
                    <div>Toplam atanan: <span className="font-semibold text-white">{company.totalAssignedMinutes} dk</span></div>
                    <div>Açık: <span className="font-semibold text-amber-300">{company.deficitMinutes} dk</span></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>İGU {company.assignedMinutesByRole.igu}/{company.requiredMinutesByRole.igu} dk</span>
                    <span>Hekim {company.assignedMinutesByRole.hekim}/{company.requiredMinutesByRole.hekim} dk</span>
                    <span>DSP {company.assignedMinutesByRole.dsp}/{company.requiredMinutesByRole.dsp} dk</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileWarning className="h-5 w-5 text-rose-300" />
              Kritik Obligation Listesi
            </CardTitle>
            <CardDescription>Overdue, missing ve warning durumundaki mevzuat yükümlülükleri.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.obligationRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Açık obligation kaydı görünmüyor.
              </div>
            ) : (
              data.obligationRows.slice(0, 8).map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{item.companyName}</div>
                    <Badge className={cn("border", complianceTone(item.status))}>
                      {item.status === "warning" ? "Yaklaşıyor" : item.status === "overdue" ? "Gecikmiş" : "Eksik"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{item.obligationName}</div>
                  <div className="mt-2 text-xs text-slate-400">
                    Son tarih: {formatDate(item.dueDate)} • Sorumlu rol: {item.responsibleRole || "Tanımsız"}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CreditCard className="h-5 w-5 text-cyan-300" />
              Finans ve Kârlılık Baskısı
            </CardTitle>
            <CardDescription>Gecikmiş bakiye ve marj baskısı yüksek portföy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {financePressure.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Gecikmiş bakiye görünmüyor.
              </div>
            ) : (
              financePressure.map((row) => (
                <div key={row.companyId} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{row.companyName}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        Tahmini marj: {formatCurrency(row.estimatedMonthlyMargin)} • Risk skoru: {row.collectionRiskScore}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-rose-300">{formatCurrency(row.overdueBalance)}</div>
                      <div className="text-xs text-slate-500">gecikmiş bakiye</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Activity className="h-5 w-5 text-cyan-300" />
              Ekip Kapasite Dağılımı
            </CardTitle>
            <CardDescription>Bu ay atama yükü ve kullanılabilir dakika dengesi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.personnelLoads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Aktif personel görünmüyor.
              </div>
            ) : (
              data.personnelLoads.slice(0, 8).map((person) => (
                <div key={person.personnelId} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">{person.fullName}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">{person.role}</div>
                    </div>
                    <Badge className={cn("border", person.overloaded ? "border-rose-400/20 bg-rose-500/10 text-rose-200" : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200")}>
                      %{person.utilizationRatio}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
                    <div>Atanan: <span className="font-semibold text-white">{person.assignedMinutes} dk</span></div>
                    <div>Kalan: <span className={cn("font-semibold", person.remainingMinutes < 0 ? "text-rose-300" : "text-white")}>{person.remainingMinutes} dk</span></div>
                    <div>Firma: <span className="font-semibold text-white">{person.activeCompanyCount}</span></div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Yaklaşan sözleşmeler</CardTitle>
            <CardDescription>Aktif olup bitiş tarihine yaklaşan kontratlar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiringContracts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Yaklaşan sözleşme görünmüyor.
              </div>
            ) : (
              expiringContracts.map((row) => (
                <div key={row.id} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div>
                    <div className="font-semibold text-white">{row.companyName}</div>
                    <div className="mt-1 text-xs text-slate-400">{row.packageName} • {formatCurrency(row.monthlyFee)}</div>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <div>Bitiş</div>
                    <div className="font-semibold text-white">{formatDate(row.endsOn)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Hızlı yönlendirme</CardTitle>
            <CardDescription>Bu dashboard’daki veriyi aksiyona çevirmek için kısa rota.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              "Önce mevzuat açığı olan firmaları atama paneline taşıyın ve rol bazlı açık dakikayı kapatın.",
              "Obligation listesinde overdue kayıtları görev veya saha ziyareti planına dönüştürün.",
              "Finans baskısı kartında gecikmiş bakiye taşıyan müşterileri cari tahsilat sürecine çekin.",
              "Kapasite dağılımında yüzde 100’e dayanan personeller için portföy dengelemesi yapın.",
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
      </section>
    </div>
  );
}
