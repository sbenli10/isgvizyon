import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Siren,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { createOsgbTask } from "@/lib/osgbOperations";
import { getOsgbDashboardData, type OsgbDashboardData } from "@/lib/osgbData";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";

const CACHE_TTL_MS = 5 * 60 * 1000;
const getCacheKey = (userId: string) => `osgb:alerts:${userId}`;

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const getDaysUntil = (value: string | null) => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  return Math.floor((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

const severityBadgeClass = (severity: string) => {
  const value = severity.toUpperCase();
  if (value === "CRITICAL") return "bg-red-500/15 text-red-200 border-red-400/20";
  if (value === "HIGH") return "bg-orange-500/15 text-orange-200 border-orange-400/20";
  if (value === "WARNING") return "bg-yellow-500/15 text-yellow-200 border-yellow-400/20";
  return "bg-slate-500/15 text-slate-200 border-slate-400/20";
};

function buildAlertView(data: OsgbDashboardData) {
  const contractAlerts = data.companies
    .map((company) => {
      const daysLeft = getDaysUntil(company.contractEnd);
      if (daysLeft === null || daysLeft > 45) return null;
      return {
        id: `contract-${company.id}`,
        companyId: company.id,
        companyName: company.companyName,
        message: daysLeft < 0
          ? `Sözleşme ${Math.abs(daysLeft)} gün önce sona ermiş.`
          : `Sözleşme ${daysLeft} gün içinde sona erecek.`,
        severity: daysLeft < 0 ? "CRITICAL" : daysLeft <= 15 ? "HIGH" : "WARNING",
        dueDate: company.contractEnd,
      };
    })
    .filter(Boolean);

  const criticalFlags = data.flags.filter((flag) => ["CRITICAL", "HIGH"].includes(flag.severity.toUpperCase()));
  const criticalPredictiveAlerts = data.alerts.filter((alert) => ["CRITICAL", "HIGH"].includes(alert.severity.toUpperCase()));

  return {
    contractAlerts,
    criticalFlags,
    criticalPredictiveAlerts,
  };
}

export default function OSGBAlerts() {
  const { user } = useAuth();
  const [data, setData] = useState<OsgbDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTaskId, setCreatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async (forceRefresh = false) => {
    if (!user?.id) return;

    const cacheKey = getCacheKey(user.id);
    const cached = readOsgbPageCache<OsgbDashboardData>(cacheKey, CACHE_TTL_MS);

    if (!forceRefresh && cached) {
      setData(cached);
      setLoading(false);
    }

    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else if (!data) {
        setLoading(true);
      }

      const result = await getOsgbDashboardData(user.id);
      setData(result);
      setError(null);
      writeOsgbPageCache(cacheKey, result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uyarı merkezi yüklenemedi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadAlerts(false);
  }, [user?.id]);

  const alertView = useMemo(() => (data ? buildAlertView(data) : null), [data]);

  const handleQuickTaskCreate = async (params: {
    id: string;
    companyId?: string | null;
    title: string;
    description: string;
    dueDate?: string | null;
    priority: "high" | "critical";
  }) => {
    if (!user?.id) return;
    setCreatingTaskId(params.id);
    try {
      await createOsgbTask(user.id, {
        companyId: params.companyId || null,
        title: params.title,
        description: params.description,
        dueDate: params.dueDate || null,
        priority: params.priority,
        source: "alerts",
      });
      toast.success("Görev oluşturuldu.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev oluşturulamadı.");
    } finally {
      setCreatingTaskId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          ))}
        </div>
        <div className="h-[420px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Uyarı Merkezi</h1>
              <p className="text-sm text-slate-400">
                Yaklaşan sözleşmeler, kritik uygunsuzluklar ve öngörüsel riskler tek ekranda.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => void loadAlerts(true)} disabled={refreshing}>
          <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Yenile
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Uyarılar yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {data && alertView ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Kritik uygunsuzluk</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{alertView.criticalFlags.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Açık ve yüksek öncelikli uyumsuzluk kayıtları.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Öngörüsel risk</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{alertView.criticalPredictiveAlerts.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Yaklaşan olay veya sözleşme baskısı için aktif tahminler.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Sözleşme uyarısı</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{alertView.contractAlerts.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">45 gün içinde sona erecek veya süresi dolmuş sözleşmeler.</CardContent>
            </Card>
          </div>

          <Tabs defaultValue="contracts" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
              <TabsTrigger value="contracts">Sözleşme Uyarıları</TabsTrigger>
              <TabsTrigger value="flags">Uyumsuzluklar</TabsTrigger>
              <TabsTrigger value="predictive">Öngörüsel Riskler</TabsTrigger>
            </TabsList>

            <TabsContent value="contracts" className="space-y-4">
              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-white">Sözleşme baskısı</CardTitle>
                  <CardDescription>Önümüzdeki 45 gün içindeki kritik sözleşme takibi.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alertView.contractAlerts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                      Yaklaşan sözleşme uyarısı bulunmuyor.
                    </div>
                  ) : (
                    alertView.contractAlerts.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <div className="font-medium text-white">{item.companyName}</div>
                          <Badge className={cn("border", severityBadgeClass(item.severity))}>{item.severity}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-400">{item.message}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDate(item.dueDate)}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={creatingTaskId === item.id}
                            onClick={() =>
                              void handleQuickTaskCreate({
                                id: item.id,
                                companyId: item.companyId,
                                title: `Sözleşme takibi - ${item.companyName}`,
                                description: item.message,
                                dueDate: item.dueDate,
                                priority: item.severity === "CRITICAL" ? "critical" : "high",
                              })
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Görev oluştur
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flags" className="space-y-4">
              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-white">Kritik uygunsuzluklar</CardTitle>
                  <CardDescription>Mevzuat tarafında açık ve öncelikli kayıtlar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alertView.criticalFlags.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                      Kritik açık uygunsuzluk bulunmuyor.
                    </div>
                  ) : (
                    alertView.criticalFlags.map((flag) => (
                      <div key={flag.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <ShieldAlert className="h-4 w-4 text-red-300" />
                          <div className="font-medium text-white">{flag.ruleName}</div>
                          <Badge className={cn("border", severityBadgeClass(flag.severity))}>{flag.severity}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-400">{flag.message}</p>
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={creatingTaskId === flag.id}
                            onClick={() =>
                              void handleQuickTaskCreate({
                                id: flag.id,
                                companyId: flag.company_id,
                                title: `Uyumsuzluk takibi - ${flag.rule_name}`,
                                description: flag.message,
                                priority: flag.severity.toUpperCase() === "CRITICAL" ? "critical" : "high",
                              })
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Görev oluştur
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="predictive" className="space-y-4">
              <Card className="border-slate-800 bg-slate-900/70">
                <CardHeader>
                  <CardTitle className="text-white">Öngörüsel riskler</CardTitle>
                  <CardDescription>Yaklaşan olaylar için sistemin işaretlediği aktif risk uyarıları.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {alertView.criticalPredictiveAlerts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                      Kritik öngörüsel uyarı bulunmuyor.
                    </div>
                  ) : (
                    alertView.criticalPredictiveAlerts.map((alert) => (
                      <div key={alert.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Siren className="h-4 w-4 text-cyan-300" />
                          <div className="font-medium text-white">{alert.alertType}</div>
                          <Badge className={cn("border", severityBadgeClass(alert.severity))}>{alert.severity}</Badge>
                        </div>
                        <p className="text-sm leading-6 text-slate-400">{alert.message}</p>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-500">Tahmini tarih: {formatDate(alert.predictedDate)}</div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={creatingTaskId === alert.id}
                            onClick={() =>
                              void handleQuickTaskCreate({
                                id: alert.id,
                                companyId: alert.company_id,
                                title: `Öngörüsel risk takibi - ${alert.alertType}`,
                                description: alert.message,
                                dueDate: alert.predictedDate,
                                priority: alert.severity.toUpperCase() === "CRITICAL" ? "critical" : "high",
                              })
                            }
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Görev oluştur
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
