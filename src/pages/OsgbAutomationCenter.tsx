import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellRing, Bot, CreditCard, ExternalLink, FileWarning, Mail, MapPinned, MessageCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listOsgbAutomationWorkspace, runOsgbAutomationBatch, type OsgbAutomationBatchResult, type OsgbAutomationWorkspace } from "@/lib/osgbOrchestration";
import { useOsgbAccess } from "@/hooks/useOsgbAccess";

const kindIcon = {
  document: FileWarning,
  finance: CreditCard,
  field_visit: MapPinned,
} as const;

export default function OsgbAutomationCenter() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { canManageAutomation, canManageOperations } = useOsgbAccess();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbAutomationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<OsgbAutomationBatchResult | null>(null);
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
    if (!canManageAutomation) {
      toast.error("Bu rol otomasyon batch çalıştıramaz.");
      return;
    }
    if (!organizationId || !user?.id) return;
    setRunning(true);
    try {
      const result = await runOsgbAutomationBatch(organizationId, user.id);
      setLastRunResult(result);
      await loadData();
      if (result.createdTasks > 0) {
        toast.success(`${result.createdTasks} yeni görev üretildi.`);
      } else if (result.skippedExistingTasks > 0) {
        toast.info(`Yeni görev üretilmedi. ${result.skippedExistingTasks} aksiyon için zaten açık görev var.`);
      } else {
        toast.info("Yeni görev üretilmedi. Şu anda otomasyona düşen yeni bir baskı görünmüyor.");
      }
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

  const openMail = (email: string | null | undefined, action: string, companyName: string) => {
    if (!email) {
      toast.error("Bu firma için e-posta bilgisi yok.");
      return;
    }
    window.open(`mailto:${email}?subject=${encodeURIComponent(`${companyName} operasyon bildirimi`)}&body=${encodeURIComponent(action)}`);
  };

  const openWhatsapp = (phone: string | null | undefined, action: string) => {
    if (!phone) {
      toast.error("Bu firma için telefon bilgisi yok.");
      return;
    }
    const cleaned = phone.replace(/[^\d]/g, "");
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(action)}`, "_blank", "noopener,noreferrer");
  };

  const emptyStateMessage = workspace?.summary.blockedByExistingTasks
    ? "Yeni aksiyon baskısı var ama bunların tamamı için zaten açık otomasyon görevi bulunuyor."
    : "Şu an otomasyonun aksiyona çevirmesi gereken açık bir baskı görünmüyor.";

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
          <Button onClick={() => void handleRun()} disabled={running || !canManageAutomation}>
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

      {lastRunResult ? (
        <Alert className="border-cyan-500/20 bg-cyan-500/10 text-cyan-50">
          <BellRing className="h-4 w-4" />
          <AlertTitle>Son batch sonucu</AlertTitle>
          <AlertDescription>
            {lastRunResult.processed} aksiyon işlendi, {lastRunResult.createdTasks} yeni görev oluşturuldu, {lastRunResult.skippedExistingTasks} aksiyon mevcut açık görev olduğu için atlandı.
            {` `}Dağılım: saha {lastRunResult.breakdown.fieldVisit}, evrak {lastRunResult.breakdown.document}, finans {lastRunResult.breakdown.finance}.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Bekleyen aksiyon</CardDescription><CardTitle className="text-white">{workspace?.summary.pendingActions || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Geciken evrak</CardDescription><CardTitle className="text-rose-200">{workspace?.summary.overdueDocuments || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Kanit eksik ziyaret</CardDescription><CardTitle className="text-amber-200">{workspace?.summary.missingProofVisits || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Geciken odeme</CardDescription><CardTitle className="text-cyan-200">{workspace?.summary.latePayers || 0}</CardTitle></CardHeader></Card>
        <Card className="border-slate-800 bg-slate-900/70"><CardHeader><CardDescription>Açık otomasyon görevi</CardDescription><CardTitle className="text-white">{workspace?.summary.openAutomationTasks || 0}</CardTitle><CardDescription className="pt-1">Mevcut görev yüzünden atlanan: {workspace?.summary.blockedByExistingTasks || 0}</CardDescription></CardHeader></Card>
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
                      {action.skipReason === "existing_task" ? (
                        <Badge className="bg-cyan-500/15 text-cyan-200">Zaten açık görev var</Badge>
                      ) : null}
                    </div>
                  </div>
                  {action.skipReason === "existing_task" ? (
                    <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                      Bu aksiyon için yeni görev üretilmedi çünkü aynı firma ve başlıkta açık bir otomasyon görevi zaten bulunuyor.
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(action.actionUrl)} disabled={!canManageOperations}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Operasyon ekranını aç
                    </Button>
                    {action.existingTaskId ? (
                      <Button size="sm" variant="outline" onClick={() => navigate(`/osgb/tasks?taskId=${encodeURIComponent(action.existingTaskId)}`)}>
                        <BellRing className="mr-2 h-4 w-4" />
                        AÃ§Ä±k gÃ¶reve git
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => openMail(action.contactEmail, action.reason, action.companyName)}>
                      <Mail className="mr-2 h-4 w-4" />
                      E-posta hazırla
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openWhatsapp(action.contactPhone, action.reason)}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      WhatsApp aç
                    </Button>
                    {action.portalLinkToken ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`/portal/company/${action.portalLinkToken}`, "_blank", "noopener,noreferrer")}
                      >
                        Portalı aç
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-5 text-sm text-slate-400">
              {emptyStateMessage}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
