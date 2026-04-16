import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellRing, Bot, CreditCard, FileWarning, MapPinned, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listOsgbAutomationWorkspace, runOsgbAutomationBatch, type OsgbAutomationWorkspace } from "@/lib/osgbOrchestration";

const kindIcon = {
  document: FileWarning,
  finance: CreditCard,
  field_visit: MapPinned,
} as const;

export default function OsgbAutomationCenter() {
  const { user, profile } = useAuth();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbAutomationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listOsgbAutomationWorkspace(organizationId, user.id);
      setWorkspace(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Otomasyon merkezi yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRun = async () => {
    if (!organizationId || !user?.id) return;
    setRunning(true);
    try {
      const result = await runOsgbAutomationBatch(organizationId, user.id);
      await loadData();
      toast.success(`${result.createdTasks} yeni gorev ve bildirim uretildi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Otomasyon calistirilamadi.");
    } finally {
      setRunning(false);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon baglantisi gerekli</AlertTitle>
          <AlertDescription>Otomasyon merkezi gorev ve bildirimleri organizasyon bazinda uretir.</AlertDescription>
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
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">OSGB Otomasyon Merkezi</h1>
              <p className="text-sm text-slate-400">Eksik hizmet, belge ve tahsilat baskisini goreve ve bildirime cevirin.</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
          <Button onClick={() => void handleRun()} disabled={running}>
            <BellRing className="mr-2 h-4 w-4" />
            {running ? "Calisiyor" : "Aksiyonlari uret"}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Otomasyon merkezi yuklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Bekleyen aksiyon</CardDescription><CardTitle className="text-white">{workspace?.summary.pendingActions || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Geciken evrak</CardDescription><CardTitle className="text-rose-200">{workspace?.summary.overdueDocuments || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Kanit eksik ziyaret</CardDescription><CardTitle className="text-amber-200">{workspace?.summary.missingProofVisits || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Geciken odeme</CardDescription><CardTitle className="text-cyan-200">{workspace?.summary.latePayers || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Acik otomasyon gorevi</CardDescription><CardTitle className="text-white">{workspace?.summary.openAutomationTasks || 0}</CardTitle></CardHeader></Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/70">
        <CardHeader>
          <CardTitle className="text-white">Onerilen aksiyonlar</CardTitle>
          <CardDescription>Her satir su 3 soruya cevap verir: ne yanlis, neden yanlis, simdi ne yapmaliyim.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && !workspace ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-950/40" />
            ))
          ) : workspace?.actions.length ? (
            workspace.actions.map((action) => {
              const Icon = kindIcon[action.kind];
              return (
                <div key={action.key} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{action.title}</div>
                        <div className="mt-1 text-sm text-slate-400">{action.reason}</div>
                        <div className="mt-2 text-xs text-slate-500">{action.companyName}</div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{action.actionLabel}</Badge>
                      <Badge className={action.priority === "critical" ? "bg-rose-500/15 text-rose-200" : "bg-amber-500/15 text-amber-200"}>
                        {action.priority === "critical" ? "Kritik" : "Yuksek"}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-sm text-slate-400">
              Su an otomasyonun aksiyona cevirmesi gereken acik bir baski gorunmuyor.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
