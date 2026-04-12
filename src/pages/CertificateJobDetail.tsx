import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { CertificatePreviewCard } from "@/components/certificates/CertificatePreviewCard";
import { generateCertificateJob, getCertificateDownload, getCertificateStatus } from "@/lib/certificateApi";
import type { CertificateFormValues, CertificateJobItem, CertificateJobRecord, CertificateParticipantInput, CertificateRecord } from "@/types/certificates";

function getDetailStatusMeta(job: CertificateJobRecord | null) {
  if (!job || job.status === "draft") {
    return {
      label: "Henüz iş başlatılmadı",
      tone: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-200",
      summary: "Bu kayıt için henüz toplu üretim başlatılmadı.",
      detail: "İsterseniz bu sayfadan tekrar basım butonuyla üretim kuyruğunu başlatabilirsiniz.",
    };
  }

  if (job.status === "queued") {
    return {
      label: "Kuyrukta bekliyor",
      tone: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      summary: "Worker havuzu işi sıraya aldı.",
      detail: "Kısa süre içinde PDF üretimi başlayacaktır.",
    };
  }

  if (job.status === "processing") {
    return {
      label: "Üretim sürüyor",
      tone: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      summary: "Katılımcı sertifikaları üretiliyor.",
      detail: "İlerleme tamamlanan dosya sayısına göre güncellenir.",
    };
  }

  if (job.status === "processing_with_errors") {
    return {
      label: "Üretim sürüyor, hata var",
      tone: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      summary: "Bazı katılımcılarda üretim hatası oluştu.",
      detail: "Aşağıdaki katılımcı listesinde hata alan kayıtları görebilirsiniz.",
    };
  }

  if (job.status === "completed") {
    return {
      label: job.zip_path ? "ZIP indirilebilir" : "ZIP hazırlanıyor",
      tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      summary: job.zip_path ? "Tüm sertifikalar tamamlandı ve ZIP paketi hazır." : "PDF üretimi tamamlandı, ZIP paketi hazırlanıyor.",
      detail: job.zip_path ? "İsterseniz toplu ZIP dosyasını hemen indirebilirsiniz." : "Sayfayı yenilediğinizde ZIP bağlantısı görünür hale gelecektir.",
    };
  }

  if (job.status === "completed_with_errors") {
    return {
      label: job.zip_path ? "Kısmen tamamlandı, ZIP hazır" : "Kısmen tamamlandı",
      tone: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
      summary: "Bazı sertifikalar üretildi, bazı kayıtlar hatalı kaldı.",
      detail: job.zip_path ? "Hazır olan sertifikaları indirebilir, sonra hatalı kayıtları düzeltebilirsiniz." : "Başarılı kayıtlar üretildi. ZIP hazırlığı tamamlanırken hatalı kayıtları inceleyin.",
    };
  }

  if (job.status === "failed") {
    return {
      label: "Üretim başarısız",
      tone: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
      summary: "Bu işte hiçbir sertifika başarıyla üretilemedi.",
      detail: job.error_message || "Worker loglarını ve katılımcı verilerini kontrol edin.",
    };
  }

  return {
    label: "İşlem başarısız",
    tone: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
    summary: "Üretim bu işte tamamlanamadı.",
    detail: job.error_message || "Lütfen katılımcı verilerini kontrol edip tekrar deneyin.",
  };
}

export default function CertificateJobDetail() {
  const { id } = useParams();
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [form, setForm] = useState<CertificateFormValues | null>(null);
  const [participants, setParticipants] = useState<CertificateParticipantInput[]>([]);
  const [job, setJob] = useState<CertificateJobRecord | null>(null);
  const [items, setItems] = useState<CertificateJobItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const statusMeta = useMemo(() => getDetailStatusMeta(job), [job]);

  useEffect(() => {
    if (id) void loadDetail(id);
  }, [id]);

  async function loadDetail(certificateId: string) {
    setLoading(true);
    try {
      const { data: certificateData, error } = await (supabase as any).from("certificates").select("*").eq("id", certificateId).single();
      if (error) throw error;
      setCertificate(certificateData);
      setForm({
        company_id: certificateData.company_id,
        company_name: certificateData.company_name || "",
        company_address: certificateData.company_address || "",
        company_phone: certificateData.company_phone || "",
        training_name: certificateData.training_name,
        training_date: certificateData.training_date,
        training_duration: certificateData.training_duration,
        certificate_type: certificateData.certificate_type,
        validity_date: certificateData.validity_date || "",
        logo_url: certificateData.logo_url || "",
        template_type: certificateData.template_type,
        frame_style: certificateData.frame_style,
        trainer_names: certificateData.trainer_names || [],
        notes: certificateData.notes || "",
      });

      const { data: participantRows } = await (supabase as any).from("certificate_participants").select("*").eq("certificate_id", certificateId).order("created_at", { ascending: true });
      setParticipants(participantRows || []);

      const statusPayload = await getCertificateStatus(certificateId);
      setJob(statusPayload.job);
      setItems(statusPayload.items || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!certificate) return;
    setSubmitting(true);
    try {
      await generateCertificateJob(certificate.id);
      await loadDetail(certificate.id);
      toast.success("Tekrar basım kuyruğa alındı");
    } catch (error: any) {
      toast.error(`Tekrar basım başarısız: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadZip() {
    if (!certificate) return;
    const payload = await getCertificateDownload(certificate.id);
    if (!payload.downloadUrl) {
      toast.info("ZIP paketi henüz hazır değil.");
      return;
    }
    window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
  }

  const filteredParticipants = useMemo(() => participants.filter((participant) => participant.name.toLowerCase().includes(search.toLowerCase())), [participants, search]);
  const failedItems = useMemo(() => items.filter((item) => item.status === "failed"), [items]);

  if (loading || !certificate || !form) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-80 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-10 w-28 animate-pulse rounded-lg bg-slate-900" />
            ))}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-6">
            <div className="h-64 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
            <div className="h-72 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          </div>
          <div className="h-[560px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-2 px-0 text-muted-foreground"><Link to="/dashboard/certificates/history"><ArrowLeft className="mr-2 h-4 w-4" /> Geçmişe dön</Link></Button>
          <h1 className="text-3xl font-bold">Sertifika İş Detayı</h1>
          <p className="text-sm text-muted-foreground mt-1">{certificate.training_name} • {certificate.company_name || "Firma girilmedi"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => id && void loadDetail(id)}><RefreshCw className="h-4 w-4" /> Yenile</Button>
          <Button variant="outline" className="gap-2" onClick={() => void handleDownloadZip()} disabled={!job?.zip_path}><Download className="h-4 w-4" /> ZIP İndir</Button>
          <Button className="gap-2" onClick={() => void handleRegenerate()} disabled={submitting}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Tekrar Bas</Button>
        </div>
      </div>

      <div className={`rounded-2xl border px-5 py-4 ${statusMeta.tone}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{statusMeta.label}</p>
            <p className="mt-1 text-sm">{statusMeta.summary}</p>
          </div>
          <Badge variant="secondary" className="bg-background/70">%{Math.round(job?.progress || 0)}</Badge>
        </div>
        <p className="mt-3 text-xs opacity-90">{statusMeta.detail}</p>
      </div>

      {job?.error_message && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-red-800 dark:text-red-200">
          <p className="text-sm font-semibold">Hata Özeti</p>
          <p className="mt-1 break-words text-sm">{job.error_message}</p>
        </div>
      )}

      {failedItems.length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-5 py-4 text-orange-800 dark:text-orange-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Hata içeren katılımcılar bulundu</p>
              <p className="mt-1 text-sm">{failedItems.length} katılımcı için üretim başarısız oldu. Aşağıdaki listede hata durumlarını kontrol edebilirsiniz.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Şablon Önizleme</CardTitle>
            <CardDescription>Kaydın üretileceği premium tema görünümü.</CardDescription>
          </CardHeader>
          <CardContent>
            <CertificatePreviewCard form={form} participant={participants[0]} className="min-h-[540px]" />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>İş Özeti</CardTitle>
              <CardDescription>Worker havuzu ve ZIP üretim durumunu izleyin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Durum</p><p className="mt-2 text-lg font-semibold">{statusMeta.label}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Toplam Katılımcı</p><p className="mt-2 text-lg font-semibold">{participants.length}</p></div>
              </div>
              <Progress value={job?.progress || 0} className="h-3" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">ZIP Durumu</p>
                  <p className="mt-1 text-sm font-medium">{job?.zip_path ? "İndirilebilir durumda" : "Henüz hazır değil"}</p>
                </div>
                <div className="rounded-xl border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Tamamlanan Dosya</p>
                  <p className="mt-1 text-sm font-medium">{job?.completed_files || 0} / {job?.total_files || participants.length}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Tema: {certificate.template_type}</Badge>
                <Badge variant="secondary">Çerçeve: {certificate.frame_style}</Badge>
                <Badge variant="secondary">Tamamlanan: {job?.completed_files || 0}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Katılımcılar</CardTitle>
              <CardDescription>Arama ve üretim durumu takibi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Katılımcı ara" />
              <div className="max-h-[360px] overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad Soyad</TableHead>
                      <TableHead>Görev</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParticipants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">Aramaya uygun katılımcı bulunamadı.</TableCell>
                      </TableRow>
                    ) : filteredParticipants.map((participant) => {
                      const item = items.find((entry) => entry.participant_id === participant.id);
                      return (
                        <TableRow key={participant.id || participant.name}>
                          <TableCell>{participant.name}</TableCell>
                          <TableCell>{participant.job_title || "Belirtilmedi"}</TableCell>
                          <TableCell><Badge variant="secondary">{item?.status || "Beklemede"}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

