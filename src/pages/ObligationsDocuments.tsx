import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  ClipboardCheck,
  FileWarning,
  RefreshCcw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAccessRole } from "@/hooks/useAccessRole";
import { usePageDataTiming } from "@/hooks/usePageDataTiming";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildOsgbRequiredDocumentNotification,
  createOsgbRequiredDocumentTask,
  listOsgbRequiredDocumentsWorkspace,
  updateOsgbRequiredDocumentStatus,
  type OsgbRequiredDocumentRecord,
  type OsgbRequiredDocumentsWorkspaceData,
} from "@/lib/osgbPlatform";
import { cn } from "@/lib/utils";

const statusLabels: Record<OsgbRequiredDocumentRecord["status"], string> = {
  missing: "Eksik",
  submitted: "Gönderildi",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

const riskLabels: Record<OsgbRequiredDocumentRecord["riskLevel"], string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const statusTone = (status: OsgbRequiredDocumentRecord["status"]) => {
  switch (status) {
    case "approved":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
    case "submitted":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-200";
    case "rejected":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }
};

const riskTone = (risk: OsgbRequiredDocumentRecord["riskLevel"]) => {
  switch (risk) {
    case "critical":
      return "border-rose-500/20 bg-rose-500/10 text-rose-200";
    case "high":
      return "border-orange-500/20 bg-orange-500/10 text-orange-200";
    case "medium":
      return "border-amber-500/20 bg-amber-500/10 text-amber-200";
    default:
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

export default function ObligationsDocuments() {
  const { user, profile } = useAuth();
  const { canManage } = useAccessRole();
  const organizationId = profile?.organization_id || null;
  const [workspace, setWorkspace] = useState<OsgbRequiredDocumentsWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | OsgbRequiredDocumentRecord["status"]>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  usePageDataTiming(loading);

  const loadData = useCallback(async () => {
    if (!organizationId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await listOsgbRequiredDocumentsWorkspace(organizationId, user.id);
      setWorkspace(data);
      setSelectedId((current) => current || data.documents[0]?.id || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yasal evraklar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, user?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const documents = useMemo(() => {
    const rows = workspace?.documents || [];
    return rows.filter((row) => {
      const matchesStatus = statusFilter === "ALL" ? true : row.status === statusFilter;
      const term = search.trim().toLocaleLowerCase("tr-TR");
      const matchesSearch = term.length === 0
        ? true
        : [row.companyName, row.documentType, row.obligationName, row.requiredReason, row.riskIfMissing]
            .filter(Boolean)
            .some((value) => String(value).toLocaleLowerCase("tr-TR").includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, workspace?.documents]);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedId) || documents[0] || null,
    [documents, selectedId],
  );

  const handleStatusUpdate = async (document: OsgbRequiredDocumentRecord, status: OsgbRequiredDocumentRecord["status"]) => {
    try {
      await updateOsgbRequiredDocumentStatus(organizationId, document.id, status);
      await loadData();
      toast.success(`Evrak durumu "${statusLabels[status]}" olarak güncellendi.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Evrak durumu güncellenemedi.");
    }
  };

  const handleCreateTask = async (document: OsgbRequiredDocumentRecord) => {
    if (!organizationId || !user?.id) return;
    try {
      const created = await createOsgbRequiredDocumentTask(user.id, organizationId, document);
      toast.success(created ? "Takip görevi oluşturuldu." : "Bu evrak için zaten açık bir görev var.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Görev oluşturulamadı.");
    }
  };

  const handleCustomerNotification = async (document: OsgbRequiredDocumentRecord) => {
    const message = buildOsgbRequiredDocumentNotification(document);
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Müşteri bildirim metni panoya kopyalandı.");
    } catch {
      toast.message(message);
    }
  };

  if (!organizationId) {
    return (
      <div className="container mx-auto py-6">
        <Alert className="border-amber-500/20 bg-amber-500/10 text-amber-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Organizasyon bağlantısı gerekli</AlertTitle>
          <AlertDescription>
            Yasal evrak otomasyonu bir organizasyon altında çalışır. Önce bir kuruma bağlanın.
          </AlertDescription>
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
              <FileWarning className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Yasal Evrak Otomasyonu</h1>
              <p className="text-sm text-slate-400">
                Eksik evrakları yükümlülüklerden otomatik üretin, neden gerekli olduğunu görün ve hızlı aksiyon alın.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void loadData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Yenile
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Yasal evraklar yüklenemedi</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Eksik evrak</CardDescription>
            <CardTitle className="text-3xl text-white">{workspace?.overview.missing || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Geciken evrak</CardDescription>
            <CardTitle className="text-3xl text-white">{workspace?.overview.overdue || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Kritik risk</CardDescription>
            <CardTitle className="text-3xl text-white">{workspace?.overview.critical || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardDescription>Toplam takip</CardDescription>
            <CardTitle className="text-3xl text-white">{workspace?.overview.total || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Eksik ve geciken evraklar</CardTitle>
            <CardDescription>
              Burada neyin eksik olduğu, neden gerekli olduğu ve gecikirse ne risk doğurduğu görünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma, evrak ya da yükümlülük ara" />
              <div className="flex flex-wrap gap-2">
                {(["ALL", "missing", "submitted", "approved", "rejected"] as const).map((item) => (
                  <Button key={item} variant={statusFilter === item ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(item)}>
                    {item === "ALL" ? "Tümü" : statusLabels[item]}
                  </Button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Yükleniyor...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Filtreye uygun evrak kaydı bulunamadı.
              </div>
            ) : (
              documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => setSelectedId(document.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition",
                    selectedDocument?.id === document.id
                      ? "border-cyan-500/30 bg-cyan-500/10"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{document.companyName}</div>
                      <div className="mt-1 text-xs text-slate-400">{document.obligationName || "Yasal yükümlülük"} • {document.documentType}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("border", statusTone(document.status))}>{statusLabels[document.status]}</Badge>
                      <Badge className={cn("border", riskTone(document.riskLevel))}>{riskLabels[document.riskLevel]}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-300">
                    <p>{document.requiredReason}</p>
                    <div className="text-xs text-slate-400">
                      Son tarih: <span className="text-slate-200">{formatDate(document.dueDate)}</span>
                      {document.delayDays > 0 ? ` • ${document.delayDays} gün gecikti` : ""}
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader>
            <CardTitle className="text-white">Detay ve hızlı aksiyonlar</CardTitle>
            <CardDescription>
              Kullanıcı teknik değilse bile burada neyin yanlış olduğunu, neden yanlış olduğunu ve sıradaki adımı açıkça görmeli.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDocument ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-400">
                Detay için soldan bir evrak kaydı seçin.
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-white">{selectedDocument.companyName}</div>
                      <div className="mt-1 text-sm text-slate-400">{selectedDocument.documentType}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn("border", statusTone(selectedDocument.status))}>{statusLabels[selectedDocument.status]}</Badge>
                      <Badge className={cn("border", riskTone(selectedDocument.riskLevel))}>{riskLabels[selectedDocument.riskLevel]}</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-medium text-white">Ne yanlış?</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedDocument.status === "approved"
                        ? "Belge mevcut ve onaylı."
                        : `${statusLabels[selectedDocument.status]} durumunda bir evrak var.`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-medium text-white">Neden yanlış?</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">
                      {selectedDocument.riskIfMissing || "Belge eksikliği yasal yükümlülüğün yerine getirilmediği anlamına gelir."}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="text-sm font-medium text-white">Şimdi ne yapmalıyım?</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{selectedDocument.nextAction}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-sm font-medium text-white">Neden gerekli?</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{selectedDocument.requiredReason}</p>
                  <div className="mt-4 text-sm text-slate-400">
                    Yasal dayanak: <span className="text-slate-200">{selectedDocument.legalBasis || "Belirtilmedi"}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    Son tarih: <span className="text-slate-200">{formatDate(selectedDocument.dueDate)}</span>
                  </div>
                  {selectedDocument.delayDays > 0 ? (
                    <div className="mt-2 text-sm text-rose-300">{selectedDocument.delayDays} gündür gecikiyor.</div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleCreateTask(selectedDocument)} disabled={!canManage}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Görev oluştur
                  </Button>
                  <Button variant="outline" onClick={() => void handleCustomerNotification(selectedDocument)}>
                    <Send className="mr-2 h-4 w-4" />
                    Müşteri bildirimi hazırla
                  </Button>
                  <Button variant="outline" onClick={() => void handleStatusUpdate(selectedDocument, "submitted")} disabled={!canManage}>
                    <BellRing className="mr-2 h-4 w-4" />
                    Gönderildi işaretle
                  </Button>
                  <Button variant="outline" onClick={() => void handleStatusUpdate(selectedDocument, "approved")} disabled={!canManage}>
                    Onaylandı
                  </Button>
                  <Button variant="outline" onClick={() => void handleStatusUpdate(selectedDocument, "rejected")} disabled={!canManage}>
                    Reddedildi
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
