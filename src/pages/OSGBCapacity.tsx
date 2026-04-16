import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
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
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { readOsgbPageCache, writeOsgbPageCache } from "@/lib/osgbPageCache";
import { getOsgbPlatformDashboard, type OsgbPlatformDashboardData } from "@/lib/osgbPlatform";

const CACHE_TTL_MS = 5 * 60 * 1000;

const getCacheKey = (organizationId: string) => `osgb:capacity-v2:${organizationId}`;

export default function OSGBCapacity() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [data, setData] = useState<OsgbPlatformDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadCapacity = async (forceRefresh = false) => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    if (forceRefresh) {
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
      setError(err instanceof Error ? err.message : "Süre ve kapasite görünümü yüklenemedi.");
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
      void loadCapacity(true);
      return;
    }

    void loadCapacity();
  }, [organizationId]);

  const uncoveredCompanies = useMemo(
    () => (data?.complianceRows ?? []).filter((company) => company.deficitMinutes > 0),
    [data],
  );
  const balancedCompanies = useMemo(
    () => (data?.complianceRows ?? []).filter((company) => company.deficitMinutes <= 0 && company.complianceStatus === "compliant"),
    [data],
  );
  const unassignedCompanies = useMemo(
    () =>
      (data?.complianceRows ?? []).filter(
        (company) => company.assignedMinutesByRole.igu + company.assignedMinutesByRole.hekim + company.assignedMinutesByRole.dsp === 0,
      ),
    [data],
  );
  const totalRequired = useMemo(
    () => (data?.complianceRows ?? []).reduce((sum, company) => sum + company.totalRequiredMinutes, 0),
    [data],
  );
  const totalAssigned = useMemo(
    () => (data?.complianceRows ?? []).reduce((sum, company) => sum + company.totalAssignedMinutes, 0),
    [data],
  );
  const gap = Math.max(0, totalRequired - totalAssigned);

  if (loading && !data) {
    return (
      <div className="container mx-auto space-y-6 py-6">
        <div className="h-9 w-72 animate-pulse rounded-lg bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
          ))}
        </div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert>
          <AlertTitle>Organizasyon bağlantısı gerekli</AlertTitle>
          <AlertDescription>Süre ve kapasite ekranı organization scope ile çalışır. Önce profilinizden organizasyon bağlayın.</AlertDescription>
        </Alert>
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
              <h1 className="text-3xl font-bold tracking-tight text-white">Dakika ve Kapasite Paneli</h1>
              <p className="text-sm text-slate-400">
                Gerçek mevzuat motorundan gelen açık dakika, rol bazlı yük ve personel kapasitesi görünümü.
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

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Toplam gerekli süre</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{totalRequired} dk</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Bu ay tüm roller için gereken toplam mevzuat süresi.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Toplam atanmış süre</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{totalAssigned} dk</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Aktif atamalardan hesaplanan gerçek toplam dakika.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Kalan açık</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{gap} dk</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Açık dakika bulunan firmalar için kapanması gereken fark.</CardContent>
            </Card>
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader className="pb-3">
                <CardDescription>Aşırı yüklü personel</CardDescription>
                <CardTitle className="mt-2 text-3xl text-white">{data.personnelLoads.filter((item) => item.overloaded).length}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-400">Aylık dakika kapasitesini aşan veya yüzde 100’e dayanan ekip üyeleri.</CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Eksik kapasite bulunan firmalar</CardTitle>
                <CardDescription>Rol bazlı gereken dakika ile aktif atamayı karşılaştırır.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {uncoveredCompanies.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                    Eksik kapasite görünen firma bulunmuyor.
                  </div>
                ) : (
                  uncoveredCompanies.slice(0, 8).map((company) => {
                    const coverage = company.totalRequiredMinutes > 0
                      ? Math.min(100, Math.round((company.totalAssignedMinutes / company.totalRequiredMinutes) * 100))
                      : 0;
                    return (
                      <div key={company.companyId} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <div className="text-base font-medium text-white">{company.companyName}</div>
                          <Badge variant="outline">{company.hazardClass}</Badge>
                          <Badge className="border border-red-400/20 bg-red-500/15 text-red-200">Açık {company.deficitMinutes} dk</Badge>
                        </div>
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                          <span>Karşılama oranı</span>
                          <span>%{coverage}</span>
                        </div>
                        <Progress value={coverage} className="h-2 bg-slate-800" />
                        <div className="mt-3 grid gap-2 text-sm text-slate-400 sm:grid-cols-3">
                          <div>Toplam gerekli: <span className="text-slate-200">{company.totalRequiredMinutes} dk</span></div>
                          <div>Toplam atanan: <span className="text-slate-200">{company.totalAssignedMinutes} dk</span></div>
                          <div>Fazla mesai: <span className="text-slate-200">{company.overtimeMinutes} dk</span></div>
                        </div>
                        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                          <div>İGU {company.assignedMinutesByRole.igu}/{company.requiredMinutesByRole.igu}</div>
                          <div>Hekim {company.assignedMinutesByRole.hekim}/{company.requiredMinutesByRole.hekim}</div>
                          <div>DSP {company.assignedMinutesByRole.dsp}/{company.requiredMinutesByRole.dsp}</div>
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
                <CardDescription>Portföyün genel yük ve açık özetini yönetim bakışıyla verir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <ShieldAlert className="h-4 w-4 text-red-300" />
                    Süre açığı olan firma
                  </div>
                  <p className="text-sm text-slate-400">{uncoveredCompanies.length} firma gerekli süreyi karşılamıyor.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <Users className="h-4 w-4 text-cyan-300" />
                    Ataması olmayan firma
                  </div>
                  <p className="text-sm text-slate-400">{unassignedCompanies.length} firma henüz hiçbir role bağlanmamış görünüyor.</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-2 flex items-center gap-2 text-white">
                    <Gauge className="h-4 w-4 text-emerald-300" />
                    Dengeli portföy
                  </div>
                  <p className="text-sm text-slate-400">{balancedCompanies.length} firma şu ay uyumlu ve açık dakikasız ilerliyor.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Tehlike sınıfı kırılımı</CardTitle>
                <CardDescription>Tehlike sınıfına göre gerekli ve atanan dakika dağılımı.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead>Sınıf</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Çalışan</TableHead>
                      <TableHead>Gerekli</TableHead>
                      <TableHead>Atanan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {["Az Tehlikeli", "Tehlikeli", "Çok Tehlikeli"].map((hazardClass) => {
                      const rows = data.complianceRows.filter((item) => item.hazardClass === hazardClass);
                      return (
                        <TableRow key={hazardClass} className="border-slate-800">
                          <TableCell className="font-medium text-white">{hazardClass}</TableCell>
                          <TableCell>{rows.length}</TableCell>
                          <TableCell>{rows.reduce((sum, row) => sum + row.employeeCount, 0)}</TableCell>
                          <TableCell>{rows.reduce((sum, row) => sum + row.totalRequiredMinutes, 0)} dk</TableCell>
                          <TableCell>{rows.reduce((sum, row) => sum + row.totalAssignedMinutes, 0)} dk</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/70">
              <CardHeader>
                <CardTitle className="text-white">Personel bazlı kapasite görünümü</CardTitle>
                <CardDescription>Kapasiteye yaklaşan veya aşan ekip üyeleri üstte listelenir.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead>Personel</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Firma</TableHead>
                      <TableHead>Atanan</TableHead>
                      <TableHead>Kapasite</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.personnelLoads.map((person) => (
                      <TableRow key={person.personnelId} className="border-slate-800">
                        <TableCell className="font-medium text-white">{person.fullName}</TableCell>
                        <TableCell>{person.role.toUpperCase()}</TableCell>
                        <TableCell>{person.activeCompanyCount}</TableCell>
                        <TableCell>{person.assignedMinutes} dk</TableCell>
                        <TableCell>{person.monthlyCapacityMinutes} dk</TableCell>
                        <TableCell>
                          <Badge className={cn("border", person.overloaded ? "border-red-400/20 bg-red-500/15 text-red-200" : "border-emerald-400/20 bg-emerald-500/15 text-emerald-200")}>
                            %{person.utilizationRatio}
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
