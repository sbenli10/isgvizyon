import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Building2, Chrome, ExternalLink, Link2, RefreshCcw, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listOsgbIsgKatipWorkspace, runOsgbIsgKatipSyncRefresh, type OsgbIsgKatipWorkspace } from "@/lib/osgbOrchestration";

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR");
};

export default function OsgbKatipSyncCenter() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbIsgKatipWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listOsgbIsgKatipWorkspace(organizationId);
      setWorkspace(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ISG-KATIP merkezi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSync = async () => {
    if (!organizationId || !user?.id) return;
    setSyncing(true);
    try {
      const summary = await runOsgbIsgKatipSyncRefresh(organizationId, user.id);
      await loadData();
      toast.success(`${summary.success || 0} firma kaydi organizasyon havuzuna alindi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ISG-KATIP senkronizasyonu basarisiz oldu.");
    } finally {
      setSyncing(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon baglantisi gerekli</AlertTitle>
          <AlertDescription>ISG-KATIP merkezi organizasyon kapsaminda calisir. Once bir kuruma baglanin.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const extension = workspace?.extension;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">ISG-KATIP Merkezi</h1>
              <p className="text-sm text-slate-400">Kaynak sistem olarak ISGBot Chrome Extension verisini kullanir ve organizasyon havuzuna toplar.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/docs/isg-bot-setup")}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Kurulum rehberi
          </Button>
          <Button variant="outline" onClick={() => navigate("/isg-bot")}>
            <Chrome className="mr-2 h-4 w-4" />
            ISGBot'a git
          </Button>
          <Button onClick={() => void handleSync()} disabled={syncing}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {syncing ? "Organizasyon havuzu guncelleniyor" : "Veriyi organizasyona al"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Merkez yuklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader><CardDescription>Extension durumu</CardDescription><CardTitle className="text-white">{extension?.isConnected ? "Bagli gorunuyor" : "Baglanti yok"}</CardTitle></CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader><CardDescription>Kaynak modu</CardDescription><CardTitle className="text-cyan-200">{extension?.sourceMode === "member_extension" ? "Ekip uzantisi" : extension?.sourceMode === "organization" ? "Organizasyon havuzu" : "-"}</CardTitle></CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader><CardDescription>Bulunan firma</CardDescription><CardTitle className="text-white">{workspace?.summary.companyCount || 0}</CardTitle></CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader><CardDescription>Son veri akisi</CardDescription><CardTitle className="text-sm text-white">{formatDateTime(extension?.lastSyncAt || workspace?.summary.lastSyncAt || null)}</CardTitle></CardHeader>
        </Card>
      </div>

      <Alert className="border-cyan-500/20 bg-cyan-500/10 text-cyan-50">
        <Chrome className="h-4 w-4" />
        <AlertTitle>Bu ekran resmi API oturumu acmaz</AlertTitle>
        <AlertDescription>
          Veri kaynagi ISGBot Chrome Extension'dir. Uzman veya ekip uyesi ISG-KATIP'e girip extension ile senkron yaptiginda,
          bu merkez veriyi organizasyon scope'una tasir ve OSGB operasyon ekranlarinda kullanir.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Firma sagligi</CardTitle>
            <CardDescription>Extension veya ekip uyeleri tarafindan gelen firmalar tek havuzda gorunur.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && !workspace ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/40" />
                ))}
              </div>
            ) : workspace?.companies.length ? (
              workspace.companies.map((company) => (
                <div key={company.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-cyan-300" />
                        <div className="font-medium text-white">{company.companyName}</div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">
                        SGK: {company.sgkNo || "-"} • {company.employeeCount} calisan • {company.hazardClass || "Sinif yok"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{company.assignedMinutes}/{company.requiredMinutes} dk</Badge>
                      {company.criticalFlagCount > 0 ? <Badge className="bg-rose-500/15 text-rose-200">{company.criticalFlagCount} kritik</Badge> : null}
                      {company.flagCount > 0 ? <Badge className="bg-amber-500/15 text-amber-200">{company.flagCount} bayrak</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-slate-500">
                    Son sync: {formatDateTime(company.lastSyncedAt)} • Sozlesme bitisi: {company.contractEnd ? new Date(company.contractEnd).toLocaleDateString("tr-TR") : "-"}
                  </div>
                </div>
              ))
            ) : (
              <Alert className="border-slate-800 bg-slate-950/50 text-slate-200">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Henüz extension verisi bulunmuyor</AlertTitle>
                <AlertDescription>ISGBot kurulumunu tamamlayip bir ekip uyesi ile ilk senkronu yaptiktan sonra bu liste dolar.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-white">Kaynak ozet</CardTitle>
              <CardDescription>Extension verisinin hangi modelle toplandigi burada gorunur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm font-medium text-white">Ekipten gelen veri</div>
                <div className="mt-1 text-sm text-slate-400">{extension?.sourceMemberCount || 0} ekip uyesinin extension kaydi taraniyor.</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm font-medium text-white">Normalizasyon hedefi</div>
                <div className="mt-1 text-sm text-slate-400">Eski `user.id` scope'unda duran firma kayitlari bu merkezden organizasyon scope'una tasinir.</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm font-medium text-white">Sonraki kullanim</div>
                <div className="mt-1 text-sm text-slate-400">OSGB dashboard, kapasite, evrak, saha ve finans panelleri ayni havuzu kullanir.</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/70">
            <CardHeader>
              <CardTitle className="text-white">Son islem kayitlari</CardTitle>
              <CardDescription>Senkron ve aktarma kayitlari.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {workspace?.logs.length ? workspace.logs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-white">{log.action}</div>
                    <Badge variant="outline">{log.status}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{formatDateTime(log.createdAt)} • {log.source || "manuel"}</div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                  Henuz senkron gecmisi kaydi yok.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
