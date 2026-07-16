import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CircleHelp, CreditCard, FileText, ShieldCheck, UploadCloud } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePersistentDraft } from "@/hooks/usePersistentDraft";
import { getOsgbClientPortalSnapshot, submitOsgbClientPortalUpload, type OsgbPublicClientPortalSnapshot } from "@/lib/osgbOrchestration";

type UploadDraft = {
  requiredDocumentId: string;
  submittedByName: string;
  submittedByEmail: string;
  note: string;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value || 0);

const visitTypeLabels: Record<string, string> = {
  onsite_visit: "Saha ziyareti",
  remote_support: "Uzaktan destek",
  document_review: "Evrak inceleme",
  audit: "Denetim",
  training: "Eğitim hizmeti",
  emergency_drill: "Acil durum tatbikatı",
};

const visitStatusLabels: Record<string, string> = {
  planned: "Planlandı",
  in_progress: "Devam ediyor",
  completed: "Tamamlandı",
  missed: "Kaçırıldı",
  cancelled: "İptal edildi",
};

const documentStatusLabels: Record<string, string> = {
  missing: "Bekleniyor",
  pending: "İncelemede",
  uploaded: "Yüklendi",
  approved: "Onaylandı",
  rejected: "Revize gerekli",
};

const reviewStatusLabels: Record<OsgbPublicClientPortalSnapshot["uploads"][number]["reviewStatus"], string> = {
  pending: "İncelemede",
  approved: "Onaylandı",
  rejected: "Revize gerekli",
};

const getVisitStatusClass = (status: string) => {
  if (status === "completed") return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  if (status === "cancelled" || status === "missed") return "border-rose-400/30 bg-rose-500/15 text-rose-100";
  if (status === "in_progress") return "border-cyan-400/30 bg-cyan-500/15 text-cyan-100";
  return "border-blue-400/30 bg-blue-500/15 text-blue-100";
};

const getDocumentStatusClass = (status: string, delayDays = 0) => {
  if (status === "approved") return "border-emerald-400/30 bg-emerald-500/15 text-emerald-100";
  if (status === "rejected" || delayDays > 0) return "border-rose-400/30 bg-rose-500/15 text-rose-100";
  if (status === "uploaded" || status === "pending") return "border-amber-400/30 bg-amber-500/15 text-amber-100";
  return "border-slate-600 bg-slate-800 text-slate-200";
};

const getReviewStatusClass = (status: OsgbPublicClientPortalSnapshot["uploads"][number]["reviewStatus"]) => {
  if (status === "approved") return "bg-emerald-500/15 text-emerald-200";
  if (status === "rejected") return "bg-rose-500/15 text-rose-200";
  return "bg-amber-500/15 text-amber-200";
};

export default function ClientCompanyPortal() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [data, setData] = useState<OsgbPublicClientPortalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [requiredDocumentId, setRequiredDocumentId] = useState<string>("none");
  const [submittedByName, setSubmittedByName] = useState("");
  const [submittedByEmail, setSubmittedByEmail] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const {
    clearDraft: clearUploadDraft,
    restoreDraft: restoreUploadDraft,
  } = usePersistentDraft<UploadDraft>({
    key: `client-company-portal:upload:${token || "unknown"}`,
    enabled: Boolean(token),
    autoRestore: false,
    version: 1,
    storage: "localStorage",
    ttlMs: 7 * 24 * 60 * 60 * 1000,
    debounceMs: 400,
    value: {
      requiredDocumentId,
      submittedByName,
      submittedByEmail,
      note,
    },
  });

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Geçersiz portal bağlantısı.");
      return;
    }

    setLoading(true);
    try {
      const snapshot = await getOsgbClientPortalSnapshot(token);
      if (!snapshot) {
        setError("Bu portal linki pasif, silinmiş veya süresi dolmuş olabilir.");
        setData(null);
      } else {
        setData(snapshot);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal bilgisi okunamadı.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token) return;

    const draft = restoreUploadDraft();
    if (!draft) return;
    const hasContent = Boolean(
      draft.requiredDocumentId !== "none" ||
        draft.submittedByName.trim() ||
        draft.submittedByEmail.trim() ||
        draft.note.trim(),
    );
    if (!hasContent) return;

    setRequiredDocumentId(draft.requiredDocumentId || "none");
    setSubmittedByName(draft.submittedByName || "");
    setSubmittedByEmail(draft.submittedByEmail || "");
    setNote(draft.note || "");
    toast.info("Belge yükleme taslağı geri yüklendi. Dosyayı güvenlik nedeniyle yeniden seçmeniz gerekir.");
  }, [restoreUploadDraft, token]);

  const missingDocuments = useMemo(
    () => (data?.documents || []).filter((item) => item.status !== "approved"),
    [data],
  );

  const handleUpload = async () => {
    if (!token || !file) {
      toast.error("Yüklemek için dosya seçin.");
      return;
    }

    setUploading(true);
    try {
      await submitOsgbClientPortalUpload({
        token,
        file,
        requiredDocumentId: requiredDocumentId !== "none" ? requiredDocumentId : null,
        submittedByName: submittedByName || null,
        submittedByEmail: submittedByEmail || null,
        note: note || null,
      });
      setFile(null);
      setSubmittedByName("");
      setSubmittedByEmail("");
      setNote("");
      setRequiredDocumentId("none");
      clearUploadDraft();
      await load();
      toast.success("Dosyanız OSGB incelemesine gönderildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="w-full min-w-0 space-y-6">
          <div className="h-40 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/70" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="w-full min-w-0">
          <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Portal açılamadı</AlertTitle>
            <AlertDescription>{error || "Portal linki bulunamadı."}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_26%),linear-gradient(180deg,#020617,#0f172a)] p-4 text-slate-100 md:p-6">
      <div className="mx-auto w-full max-w-[1560px] min-w-0 space-y-6">
        <section className="overflow-hidden rounded-3xl border border-cyan-400/15 bg-slate-900/80 shadow-2xl shadow-black/20">
          <div className="border-b border-slate-800/80 bg-gradient-to-r from-cyan-500/10 via-slate-900 to-emerald-500/10 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-100">{data.meta.organizationName}</Badge>
              <Button
                variant="outline"
                onClick={() => navigate(`/portal/company/${token}/how-to`)}
                className="rounded-xl border-slate-700 bg-slate-950/50 text-slate-100 hover:bg-slate-800 hover:text-white"
              >
                <CircleHelp className="mr-2 h-4 w-4" />
                Nasıl kullanılır?
              </Button>
            </div>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_360px] lg:p-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">Müşteri Portalı</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">{data.company.companyName}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                  OSGB hizmetlerinizi, bekleyen evrakları, yüklediğiniz dosyaların inceleme durumunu ve cari özetinizi tek ekrandan takip edin.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1">Çalışan: {data.company.employeeCount || "-"}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1">Tehlike sınıfı: {data.company.hazardClass || "-"}</span>
                <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1">Link geçerlilik: {formatDate(data.meta.expiresAt)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">OSGB iletişim</div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div><span className="text-slate-500">Yetkili:</span> {data.meta.contactName || "-"}</div>
                <div><span className="text-slate-500">E-posta:</span> {data.meta.contactEmail || "-"}</div>
              </div>
              <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs leading-5 text-cyan-100">
                Dosya yüklediğinizde OSGB ekibi inceleme yapar; sonuç bu portalda “Son gönderimler” alanına düşer.
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900/75"><CardHeader><CardDescription>Geciken belge</CardDescription><CardTitle className="text-white">{data.documents.filter((item) => item.status === "missing" && item.delayDays > 0).length}</CardTitle></CardHeader><CardContent className="text-xs text-slate-400">Vadesi geçmiş ve halen tamamlanmamış evraklar.</CardContent></Card>
          <Card className="border-slate-800 bg-slate-900/75"><CardHeader><CardDescription>Son planlı hizmet</CardDescription><CardTitle className="text-white">{data.visits[0] ? formatDate(data.visits[0].plannedAt) : "-"}</CardTitle></CardHeader><CardContent className="text-xs text-slate-400">OSGB tarafından görünen son hizmet veya ziyaret kaydı.</CardContent></Card>
          <Card className="border-slate-800 bg-slate-900/75"><CardHeader><CardDescription>Gecikmiş bakiye</CardDescription><CardTitle className="text-white">{formatCurrency(data.finance.overdueBalance)}</CardTitle></CardHeader><CardContent className="text-xs text-slate-400">Vadesi geçmiş cari tutar.</CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-cyan-300" /> Bekleyen belgeler</CardTitle>
                <CardDescription>Eksik veya incelemede olan belgeleriniz burada görünür.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.documents.length ? data.documents.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{document.documentType}</div>
                        <div className="mt-1 text-sm text-slate-400">{document.requiredReason}</div>
                        <div className="mt-2 text-xs text-slate-500">{document.riskIfMissing || "Yasal uyum riski doğurabilir."}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={getDocumentStatusClass(document.status, document.delayDays)}>
                          {documentStatusLabels[document.status] || document.status}
                        </Badge>
                        <Badge className={document.delayDays > 0 ? "bg-rose-500/15 text-rose-200" : "bg-amber-500/15 text-amber-200"}>
                          {document.delayDays > 0 ? `${document.delayDays} gün gecikme` : `Vade ${formatDate(document.dueDate)}`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                    Bekleyen belge görünmüyor.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><UploadCloud className="h-5 w-5 text-cyan-300" /> Belge yükle</CardTitle>
                <CardDescription>Eksik evrağı yükleyin; dosya önce OSGB ekibi tarafından incelenip onaylanır.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>İlgili belge</Label>
                  <Select value={requiredDocumentId} onValueChange={setRequiredDocumentId}>
                    <SelectTrigger><SelectValue placeholder="Belge seçin" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Genel dosya</SelectItem>
                      {missingDocuments.map((document) => (
                        <SelectItem key={document.id} value={document.id}>
                          {document.documentType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Gönderen adı</Label>
                    <Input value={submittedByName} onChange={(event) => setSubmittedByName(event.target.value)} placeholder="Ad soyad" />
                  </div>
                  <div className="space-y-2">
                    <Label>Gönderen e-postası</Label>
                    <Input type="email" value={submittedByEmail} onChange={(event) => setSubmittedByEmail(event.target.value)} placeholder="ornek@firma.com" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Not</Label>
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bu dosya hangi belgeyi kapatır veya ek notunuz nedir?" />
                </div>
                <div className="space-y-2">
                  <Label>Dosya</Label>
                  <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                </div>
                <Button onClick={() => void handleUpload()} disabled={uploading || !file}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {uploading ? "Yükleniyor" : "Dosyayı gönder"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><CalendarClock className="h-5 w-5 text-cyan-300" /> Son hizmetler</CardTitle>
                <CardDescription>OSGB ekibinin sizin için planladığı veya tamamladığı son hizmetler.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.visits.length ? data.visits.map((visit) => (
                  <div key={visit.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{visitTypeLabels[visit.visitType] || visit.visitType}</div>
                      <Badge variant="outline" className={getVisitStatusClass(visit.status)}>
                        {visitStatusLabels[visit.status] || visit.status}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{visit.serviceSummary || "Hizmet özeti henüz eklenmedi."}</div>
                    {visit.nextActionSummary ? (
                      <div className="mt-2 rounded-xl border border-cyan-400/15 bg-cyan-400/10 p-3 text-xs text-cyan-100">
                        Sonraki aksiyon: {visit.nextActionSummary}
                      </div>
                    ) : null}
                    <div className="mt-2 text-xs text-slate-500">Planlanan tarih: {formatDate(visit.plannedAt)}</div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                    Kayıtlı hizmet ziyareti görünmüyor.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><CreditCard className="h-5 w-5 text-cyan-300" /> Cari özet</CardTitle>
                <CardDescription>OSGB ile cari durumunuzun kısa görünümü.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-sm text-slate-400">Toplam bakiye</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{formatCurrency(data.finance.currentBalance)}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-sm text-slate-400">Gecikmiş bakiye</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{formatCurrency(data.finance.overdueBalance)}</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <ShieldCheck className="h-4 w-4 text-cyan-300" />
                    Finansal risk skoru
                  </div>
                  <div className="mt-1 text-xl font-semibold text-white">{data.finance.collectionRiskScore}</div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="text-white">Son gönderimler</CardTitle>
                <CardDescription>Yüklediğiniz dosyaların inceleme durumu burada görünür.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.uploads.length ? data.uploads.map((upload) => (
                  <div key={upload.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{upload.fileName}</div>
                      <Badge className={getReviewStatusClass(upload.reviewStatus)}>
                        {reviewStatusLabels[upload.reviewStatus]}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{upload.documentType || "Genel dosya"}</div>
                    <div className="mt-2 text-xs text-slate-500">{formatDate(upload.createdAt)} {upload.reviewNote ? `• ${upload.reviewNote}` : ""}</div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                    Henüz portal üzerinden dosya gönderilmedi.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
