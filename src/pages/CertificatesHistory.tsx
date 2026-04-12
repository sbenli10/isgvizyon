import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Download, Eye, Filter, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCertificateDownload } from "@/lib/certificateApi";
import type { CertificateJobRecord, CertificateRecord } from "@/types/certificates";

type CertificateHistoryRow = CertificateRecord & {
  latestJob: CertificateJobRecord | null;
  participantCount: number;
};

function getHistoryStatusMeta(job: CertificateJobRecord | null) {
  if (!job || job.status === "draft") {
    return {
      label: "Henüz iş başlatılmadı",
      description: "Kayıt oluşturulmuş ancak toplu üretim henüz tetiklenmemiş.",
      tone: "bg-slate-500/10 text-slate-700 dark:text-slate-200",
    };
  }

  if (job.status === "queued") {
    return {
      label: "Kuyrukta",
      description: "Worker sırası bekleniyor.",
      tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (job.status === "processing") {
    return {
      label: "Üretiliyor",
      description: "PDF dosyaları hazırlanıyor.",
      tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    };
  }

  if (job.status === "processing_with_errors") {
    return {
      label: "Üretiliyor, hata var",
      description: "Bazı katılımcılar işlenemedi.",
      tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    };
  }

  if (job.status === "completed") {
    return {
      label: job.zip_path ? "ZIP hazır" : "Üretim tamamlandı",
      description: job.zip_path ? "Toplu indirme dosyası hazır." : "PDF üretimi bitti, ZIP hazırlanıyor olabilir.",
      tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    };
  }

  if (job.status === "completed_with_errors") {
    return {
      label: job.zip_path ? "Kısmen tamamlandı, ZIP hazır" : "Kısmen tamamlandı",
      description: "Bazı kayıtlar başarısız olsa da indirilebilir dosyalar mevcut olabilir.",
      tone: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    };
  }

  return {
    label: "Başarısız",
    description: job.error_message || "Üretim tamamlanamadı.",
    tone: "bg-red-500/10 text-red-700 dark:text-red-300",
  };
}

export default function CertificatesHistory() {
  const [rows, setRows] = useState<CertificateHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    void loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    try {
      const { data: certificates, error } = await (supabase as any)
        .from("certificates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const mapped = await Promise.all(
        (certificates || []).map(async (certificate: any) => {
          const [{ data: jobs }, { count }] = await Promise.all([
            (supabase as any)
              .from("certificate_jobs")
              .select("*")
              .eq("certificate_id", certificate.id)
              .order("created_at", { ascending: false })
              .limit(1),
            (supabase as any)
              .from("certificate_participants")
              .select("*", { count: "exact", head: true })
              .eq("certificate_id", certificate.id),
          ]);

          return {
            ...certificate,
            latestJob: jobs?.[0] || null,
            participantCount: count || 0,
          } as CertificateHistoryRow;
        })
      );

      setRows(mapped);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(certificateId: string) {
    try {
      const payload = await getCertificateDownload(certificateId);
      if (!payload.downloadUrl) {
        toast.info("Bu iş için indirilebilir ZIP henüz hazır değil.");
        return;
      }
      window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(`ZIP indirilemedi: ${error.message}`);
    }
  }

  const companyOptions = useMemo(() => Array.from(new Set(rows.map((row) => row.company_name).filter(Boolean))), [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch = [row.training_name, row.company_name, row.certificate_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === "all" || (row.latestJob?.status || "draft") === statusFilter;
      const matchesTemplate = templateFilter === "all" || row.template_type === templateFilter;
      const matchesCompany = companyFilter === "all" || row.company_name === companyFilter;
      const matchesDateFrom = !dateFrom || row.training_date >= dateFrom;
      const matchesDateTo = !dateTo || row.training_date <= dateTo;
      return matchesSearch && matchesStatus && matchesTemplate && matchesCompany && matchesDateFrom && matchesDateTo;
    });
  }, [rows, search, statusFilter, templateFilter, companyFilter, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-56 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-80 animate-pulse rounded bg-slate-900" />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-lg bg-slate-900" />
        </div>

        <div className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-800 bg-slate-900/70" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sertifika Geçmişi</h1>
          <p className="text-sm text-muted-foreground mt-1">Tarih aralığı, firma ve durum bazlı filtreleme ile geçmiş işleri yönetin.</p>
        </div>
        <Button onClick={() => void loadHistory()} variant="outline" className="gap-2"><RefreshCw className="h-4 w-4" /> Yenile</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5 text-primary" /> Gelişmiş Filtreler</CardTitle>
          <CardDescription>Geçmiş işleri durum, tema, firma ve tarih aralığına göre daraltın.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Eğitim veya firma ara" />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger><SelectValue placeholder="Firma" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm firmalar</SelectItem>
              {companyOptions.map((company) => (
                <SelectItem key={company} value={company!}>{company}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              <SelectItem value="draft">Henüz iş başlatılmadı</SelectItem>
              <SelectItem value="queued">Kuyrukta</SelectItem>
              <SelectItem value="processing">Üretiliyor</SelectItem>
              <SelectItem value="processing_with_errors">Üretiliyor, hata var</SelectItem>
              <SelectItem value="completed">Tamamlandı</SelectItem>
              <SelectItem value="completed_with_errors">Kısmen tamamlandı</SelectItem>
              <SelectItem value="failed">Başarısız</SelectItem>
            </SelectContent>
          </Select>
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger><SelectValue placeholder="Tema" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm temalar</SelectItem>
              <SelectItem value="classic">Klasik</SelectItem>
              <SelectItem value="academy">Akademi Mavi</SelectItem>
              <SelectItem value="executive">Yönetici Altın</SelectItem>
              <SelectItem value="compliance">Mevzuat Uyum</SelectItem>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredRows.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-base font-medium">Filtrelere uygun sertifika bulunamadı.</p>
              <p className="mt-2 text-sm text-muted-foreground">Tarih aralığını genişletebilir veya durum filtresini temizleyebilirsiniz.</p>
            </CardContent>
          </Card>
        ) : filteredRows.map((row) => {
          const statusMeta = getHistoryStatusMeta(row.latestJob);
          return (
            <Card key={row.id} className="border-border/70">
              <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{row.training_name}</p>
                    <Badge variant="secondary">{row.template_type}</Badge>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusMeta.tone}`}>{statusMeta.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{row.company_name || "Firma girilmedi"}</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {row.training_date}</span>
                    <span>{row.participantCount} katılımcı</span>
                    <span>%{Math.round(row.latestJob?.progress || 0)} ilerleme</span>
                  </div>
                  <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Durum Özeti</p>
                    <p className="mt-1">{statusMeta.description}</p>
                    {!row.latestJob?.zip_path && (row.latestJob?.status === "completed" || row.latestJob?.status === "completed_with_errors") && (
                      <p className="mt-2 text-xs">ZIP paketi henüz hazır değil. Sistem arka planda paketleme yapıyor olabilir.</p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" asChild className="gap-2"><Link to={`/dashboard/certificates/${row.id}`}><Eye className="h-4 w-4" /> Detay</Link></Button>
                  <Button variant="outline" className="gap-2" onClick={() => row.id && void handleDownload(row.id)} disabled={!row.latestJob?.zip_path}><Download className="h-4 w-4" /> ZIP</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
