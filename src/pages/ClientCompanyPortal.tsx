import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CreditCard, FileText, ShieldCheck, UploadCloud } from "lucide-react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getOsgbClientPortalSnapshot, submitOsgbClientPortalUpload, type OsgbPublicClientPortalSnapshot } from "@/lib/osgbOrchestration";

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("tr-TR");
};

export default function ClientCompanyPortal() {
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

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Gecersiz portal baglantisi.");
      return;
    }

    setLoading(true);
    try {
      const snapshot = await getOsgbClientPortalSnapshot(token);
      if (!snapshot) {
        setError("Bu portal linki pasif, silinmis veya suresi dolmus olabilir.");
        setData(null);
      } else {
        setData(snapshot);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portal bilgisi okunamadi.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingDocuments = useMemo(
    () => (data?.documents || []).filter((item) => item.status !== "approved"),
    [data],
  );

  const handleUpload = async () => {
    if (!token || !file) {
      toast.error("Yuklemek icin dosya secin.");
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
      await load();
      toast.success("Dosyaniz OSGB incelemesine gonderildi.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Dosya yuklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <div className="mx-auto max-w-6xl space-y-6">
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
        <div className="mx-auto max-w-4xl">
          <Alert variant="destructive" className="border-red-500/20 bg-red-500/10 text-red-100">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Portal acilamadi</AlertTitle>
            <AlertDescription>{error || "Portal linki bulunamadi."}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,#020617,#0f172a)] p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/75 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <Badge className="border border-cyan-500/20 bg-cyan-500/10 text-cyan-200">{data.meta.organizationName}</Badge>
              <h1 className="text-3xl font-bold tracking-tight text-white">{data.company.companyName} Musteri Portali</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                Son hizmetleri, bekleyen belgeleri ve cari ozetinizi buradan takip edebilir; istenen dosyalari dogrudan yukleyebilirsiniz.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-300">
              <div>Yetkili: {data.meta.contactName || "-"}</div>
              <div className="mt-1">E-posta: {data.meta.contactEmail || "-"}</div>
              <div className="mt-1">Link gecerlilik: {formatDate(data.meta.expiresAt)}</div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900/75"><CardHeader><CardDescription>Geciken belge</CardDescription><CardTitle className="text-white">{data.documents.filter((item) => item.status === "missing" && item.delayDays > 0).length}</CardTitle></CardHeader></Card>
          <Card className="border-slate-800 bg-slate-900/75"><CardHeader><CardDescription>Son hizmet kaydi</CardDescription><CardTitle className="text-white">{data.visits[0] ? formatDate(data.visits[0].plannedAt) : "-"}</CardTitle></CardHeader></Card>
          <Card className="border-slate-800 bg-slate-900/75"><CardHeader><CardDescription>Gecikmis bakiye</CardDescription><CardTitle className="text-white">{data.finance.overdueBalance.toLocaleString("tr-TR")} TL</CardTitle></CardHeader></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><FileText className="h-5 w-5 text-cyan-300" /> Bekleyen belgeler</CardTitle>
                <CardDescription>Hangi belge neden gerekiyor ve gecikirse ne risk doguyor burada gorunur.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.documents.length ? data.documents.map((document) => (
                  <div key={document.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{document.documentType}</div>
                        <div className="mt-1 text-sm text-slate-400">{document.requiredReason}</div>
                        <div className="mt-2 text-xs text-slate-500">{document.riskIfMissing || "Yasal uyum riski dogurabilir."}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{document.status}</Badge>
                        <Badge className={document.delayDays > 0 ? "bg-rose-500/15 text-rose-200" : "bg-amber-500/15 text-amber-200"}>
                          {document.delayDays > 0 ? `${document.delayDays} gun gecikme` : `Vade ${formatDate(document.dueDate)}`}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                    Bekleyen belge gorunmuyor.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><UploadCloud className="h-5 w-5 text-cyan-300" /> Belge yukle</CardTitle>
                <CardDescription>Eksik evragi yukleyin; dosya once OSGB ekibi tarafindan incelenip onaylanir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Ilgili belge</Label>
                  <Select value={requiredDocumentId} onValueChange={setRequiredDocumentId}>
                    <SelectTrigger><SelectValue placeholder="Belge secin" /></SelectTrigger>
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
                    <Label>Gonderen adi</Label>
                    <Input value={submittedByName} onChange={(event) => setSubmittedByName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Gonderen e-postasi</Label>
                    <Input type="email" value={submittedByEmail} onChange={(event) => setSubmittedByEmail(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Not</Label>
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Bu dosya hangi belgeyi kapatir veya ek notunuz nedir?" />
                </div>
                <div className="space-y-2">
                  <Label>Dosya</Label>
                  <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
                </div>
                <Button onClick={() => void handleUpload()} disabled={uploading || !file}>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  {uploading ? "Yukleniyor" : "Dosyayi gonder"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><CalendarClock className="h-5 w-5 text-cyan-300" /> Son hizmetler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.visits.length ? data.visits.map((visit) => (
                  <div key={visit.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{visit.visitType}</div>
                      <Badge variant="outline">{visit.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{visit.serviceSummary || "Hizmet ozeti henuz eklenmedi."}</div>
                    <div className="mt-2 text-xs text-slate-500">Planlanan tarih: {formatDate(visit.plannedAt)}</div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                    Kayitli hizmet ziyareti gorunmuyor.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900/75">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white"><CreditCard className="h-5 w-5 text-cyan-300" /> Cari ozet</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-sm text-slate-400">Toplam bakiye</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{data.finance.currentBalance.toLocaleString("tr-TR")} TL</div>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-sm text-slate-400">Gecikmis bakiye</div>
                  <div className="mt-1 text-2xl font-semibold text-white">{data.finance.overdueBalance.toLocaleString("tr-TR")} TL</div>
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
                <CardTitle className="text-white">Son gonderimler</CardTitle>
                <CardDescription>Yuklediginiz dosyalarin inceleme durumu burada gorunur.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.uploads.length ? data.uploads.map((upload) => (
                  <div key={upload.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{upload.fileName}</div>
                      <Badge className={
                        upload.reviewStatus === "approved"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : upload.reviewStatus === "rejected"
                            ? "bg-rose-500/15 text-rose-200"
                            : "bg-amber-500/15 text-amber-200"
                      }>
                        {upload.reviewStatus === "approved" ? "Onaylandi" : upload.reviewStatus === "rejected" ? "Reddedildi" : "Bekliyor"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{upload.documentType || "Genel dosya"}</div>
                    <div className="mt-2 text-xs text-slate-500">{formatDate(upload.createdAt)} {upload.reviewNote ? `• ${upload.reviewNote}` : ""}</div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-400">
                    Henuz portal uzerinden dosya gonderilmedi.
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
