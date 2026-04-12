import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Briefcase,
  Gauge,
  RefreshCcw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getOsgbDashboardData, type OsgbDashboardData } from "@/lib/osgbData";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";

const CACHE_TTL_MS = 5 * 60 * 1000;
const getCacheKey = (userId: string) => `osgb:capacity:${userId}`;

function buildCapacityView(data: OsgbDashboardData) {
  const uncoveredCompanies = data.companies.filter((company) => company.assignedMinutes < company.requiredMinutes);
  const balancedCompanies = data.companies.filter((company) => company.assignedMinutes >= company.requiredMinutes);
  const totalRequired = data.companies.reduce((sum, company) => sum + company.requiredMinutes, 0);
  const totalAssigned = data.companies.reduce((sum, company) => sum + company.assignedMinutes, 0);
  const gap = Math.max(0, totalRequired - totalAssigned);
  const overloadedExperts = data.expertLoads.filter((expert) => expert.overloaded);
  const unassignedCompanies = data.companies.filter((company) => !company.assignedPersonName);

  const hazardSummary = ["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"].map((hazardClass) => {
    const companies = data.companies.filter((company) => company.hazardClass === hazardClass);
    return {
      hazardClass,
      companyCount: companies.length,
      employeeCount: companies.reduce((sum, company) => sum + company.employeeCount, 0),
      requiredMinutes: companies.reduce((sum, company) => sum + company.requiredMinutes, 0),
      assignedMinutes: companies.reduce((sum, company) => sum + company.assignedMinutes, 0),
    };
  });

  return {
    uncoveredCompanies,
    balancedCompanies,
    totalRequired,
    totalAssigned,
    gap,
    overloadedExperts,
    unassignedCompanies,
    hazardSummary,
  };
}

export default function OSGBCapacity() {
  const { user } = useAuth();
  const [data, setData] = useState<OsgbDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  usePageDataTiming(loading);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCapacity = async (forceRefresh = false) => {
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
      setError(err instanceof Error ? err.message : "Süre ve kapasite görünümü yüklenemedi.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadCapacity(false);
  }, [user?.id]);

  const capacity = useMemo(() => (data ? buildCapacityView(data) : null), [data]);

  if (loading && !data) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="h-[360px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          <div className="h-[360px] animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Süre ve Kapasite Analizi</h1>
              <p className="text-sm text-slate-400">
                Atanmış dakika, gerekli süre, uzman yoğunluğu ve eksik kapasite görünümü.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => void loadCapacity(true)} disabled={refreshing}>
          <RefreshCcw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
          Yenile
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Kapasite görünümü yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {capacity && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Toplam gerekli süre</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{capacity.totalRequired} dk</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">İSG-KATİP verisinden hesaplanan toplam ihtiyaç.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Toplam atanmış süre</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{capacity.totalAssigned} dk</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Portföyde uzmanlara atanmış toplam dakika.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Kapasite açığı</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{capacity.gap} dk</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Eksik süre bulunan firmalar için kapanması gereken fark.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Dengesiz uzman</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{capacity.overloadedExperts.length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Atanan süresi, gereken sürenin altında kalan uzman sayısı.</CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Eksik kapasite bulunan firmalar</CardTitle>
                <CardDescription>Gerekli süreyi karşılamayan firmalar öncelik sırasıyla listelenir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {capacity.uncoveredCompanies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                    Eksik kapasite görünen firma bulunmuyor.
                  </div>
                ) : (
                  capacity.uncoveredCompanies.slice(0, 8).map((company) => {
                    const coverage = company.requiredMinutes > 0 ? Math.min(100, Math.round((company.assignedMinutes / company.requiredMinutes) * 100)) : 0;
                    const gap = Math.max(0, company.requiredMinutes - company.assignedMinutes);
                    return (
                      <div key={company.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <div className="text-base font-medium text-white">{company.companyName}</div>
                          <Badge variant="outline">{company.hazardClass}</Badge>
                          <Badge className="border bg-red-500/15 text-red-200 border-red-400/20">Açık {gap} dk</Badge>
                        </div>
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>Karşılama oranı</span>
                          <span>%{coverage}</span>
                        </div>
                        <Progress value={coverage} className="h-2 bg-slate-800" />
                        <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
                          <div>Gerekli: <span className="text-slate-200">{company.requiredMinutes} dk</span></div>
                          <div>Atanan: <span className="text-slate-200">{company.assignedMinutes} dk</span></div>
                          <div>Uzman: <span className="text-slate-200">{company.assignedPersonName || "Atanmamış"}</span></div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Kapasite özeti</CardTitle>
                <CardDescription>Portföy yapısının yönetim düzeyi görünümü.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <ShieldAlert className="h-4 w-4 text-red-300" />
                    Eksik kapasite firmaları
                  </div>
                  <p className="text-sm text-slate-400">{capacity.uncoveredCompanies.length} firma gerekli süreyi karşılamıyor.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <Users className="h-4 w-4 text-cyan-300" />
                    Atanmamış kayıtlar
                  </div>
                  <p className="text-sm text-slate-400">{capacity.unassignedCompanies.length} firma henüz bir uzmana bağlanmamış görünüyor.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <Briefcase className="h-4 w-4 text-amber-300" />
                    Dengeli portföy
                  </div>
                  <p className="text-sm text-slate-400">{capacity.balancedCompanies.length} firma gerekli süreyi karşılıyor.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Tehlike sınıfı kırılımı</CardTitle>
                <CardDescription>Tehlike sınıfına göre şirket ve dakika dağılımı.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead>Sınıf</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Çalışan</TableHead>
                      <TableHead>Gerekli</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capacity.hazardSummary.map((row) => (
                      <TableRow key={row.hazardClass} className="border-slate-800">
                        <TableCell className="font-medium text-white">{row.hazardClass}</TableCell>
                        <TableCell>{row.companyCount}</TableCell>
                        <TableCell>{row.employeeCount}</TableCell>
                        <TableCell>{row.requiredMinutes} dk</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Uzman bazlı kapasite görünümü</CardTitle>
                <CardDescription>Eksik süre kalan uzmanlar üstte listelenir.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead>Uzman</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Atanan</TableHead>
                      <TableHead>Gerekli</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expertLoads.map((expert) => (
                      <TableRow key={expert.expertName} className="border-slate-800">
                        <TableCell className="font-medium text-white">{expert.expertName}</TableCell>
                        <TableCell>{expert.companyCount}</TableCell>
                        <TableCell>{expert.totalAssignedMinutes} dk</TableCell>
                        <TableCell>{expert.totalRequiredMinutes} dk</TableCell>
                        <TableCell>
                          <Badge className={cn("border", expert.overloaded ? "bg-red-500/15 text-red-200 border-red-400/20" : "bg-emerald-500/15 text-emerald-200 border-emerald-400/20")}>
                            {expert.overloaded ? "Açık var" : "Dengeli"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
